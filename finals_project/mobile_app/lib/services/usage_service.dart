// PrintFlow Mobile - stock movement engine (BOM + usage log).
//
// Three movement kinds, one audit collection (`usage_events`):
//   * auto-deduct - a confirmed order (Pending - In Production) consumes
//     its recipe (BOM). Locked to the order id: re-advancing the status
//     never deducts twice.
//   * manual - staff log stock IN (delivery received) or OUT (wastage,
//     sample, correction) with a reason. Optional order link, guarded
//     by the caller when the order is already auto-deducted.
//   * rfid - station taps (stock-in / check-in) recorded with source
//     'rfid'. Taps never auto-deduct; they are presence/receipt proof.
//
// Every write runs in a Firestore transaction: stock decrement/increment
// + status recompute + audit entry commit atomically. Shortfalls floor
// at zero and set `shortfall: true` on the entry instead of going
// negative - the shop decides, the system never invents stock.
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

import '../auth/auth_service.dart';
import '../models/bom.dart';
import 'audit_service.dart';
import 'firebase_usage.dart' as fb_usage;
import 'live_activity_marks.dart';

const String _kInventoryCollection = 'inventory';
const String _kOrdersCollection = 'orders';
const String _kUsageCollection = 'usage_events';

/// Result of a movement: per-variant deltas + whether anything moved.
class MovementResult {
  /// variant - signed delta applied (negative = out, positive = in).
  final Map<String, int> deltas;

  /// True when a variant hit zero while more was requested.
  final bool shortfall;

  /// True when an auto-deduct was skipped (no BOM / already deducted).
  final bool skipped;

  const MovementResult({
    required this.deltas,
    this.shortfall = false,
    this.skipped = false,
  });
}

class UsageService {
  UsageService._();

  /// Reads the recipe for an order item_type. Returns null when the
  /// product has no mapped BOM (caller warns, order still proceeds).
  static Future<Bom?> fetchBom(String itemType) =>
      fb_usage.fetchBom(normalizeItemType(itemType));

  /// Logs a stock IN (delivery received). Requires inventoryUpdate.
  static Future<MovementResult> logStockIn({
    required String materialVariantId,
    required int qty,
    String? note,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.inventoryUpdate);
    if (qty <= 0) throw ArgumentError('Quantity must be positive');
    final byUid = auth.currentUser?.id;
    var shortfall = false;
    final deltas = <String, int>{materialVariantId: qty};
    int? before;
    await FirebaseFirestore.instance.runTransaction((tx) async {
      final ref = FirebaseFirestore.instance
          .collection(_kInventoryCollection)
          .doc(materialVariantId);
      final snap = await tx.get(ref);
      if (!snap.exists) throw ArgumentError('Unknown variant: $materialVariantId');
      final current = snap.data()!;
      final stock = (current['current_stock'] as num?)?.toInt() ?? 0;
      before = stock;
      final rop = (current['reorder_point'] as num?)?.toInt() ?? 0;
      tx.update(ref, <String, dynamic>{
        'current_stock': stock + qty,
        'status': _statusForStock(stock + qty, rop),
        'last_updated': FieldValue.serverTimestamp(),
      });
      tx.set(
        FirebaseFirestore.instance.collection(_kUsageCollection).doc(),
        <String, dynamic>{
          'material_variant_id': materialVariantId,
          'qty': qty,
          'direction': 'in',
          'source': 'manual',
          'order_id': null,
          'reason': note,
          'by_uid': byUid,
          'timestamp': FieldValue.serverTimestamp(),
        },
      );
    });
    debugPrint('[UsageService] Stock IN $qty x $materialVariantId');
    LiveActivityMarks.mark('inventory', materialVariantId);
    AuditService.log(
      actor: auth.currentUser,
      action: 'stock_in',
      module: 'inventory',
      recordId: materialVariantId,
      recordLabel: 'Material $materialVariantId (+$qty)',
      oldValue: before,
      newValue: before == null ? null : before! + qty,
    );
    return MovementResult(deltas: deltas, shortfall: shortfall);
  }

  /// Logs a manual stock OUT (wastage/sample/correction/production-use).
  /// Requires inventoryUpdate. Set [orderId] to link the log to an order
  /// (caller shows the already-deducted guard first).
  static Future<MovementResult> logUsage({
    required String materialVariantId,
    required int qty,
    required String reason,
    String? orderId,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.inventoryUpdate);
    if (qty <= 0) throw ArgumentError('Quantity must be positive');
    final byUid = auth.currentUser?.id;
    var shortfall = false;
    int? before;
    int? after;
    await FirebaseFirestore.instance.runTransaction((tx) async {
      final ref = FirebaseFirestore.instance
          .collection(_kInventoryCollection)
          .doc(materialVariantId);
      final snap = await tx.get(ref);
      if (!snap.exists) throw ArgumentError('Unknown variant: $materialVariantId');
      final current = snap.data()!;
      final stock = (current['current_stock'] as num?)?.toInt() ?? 0;
      before = stock;
      final rop = (current['reorder_point'] as num?)?.toInt() ?? 0;
      var next = stock - qty;
      if (next < 0) {
        shortfall = true;
        next = 0;
      }
      after = next;
      tx.update(ref, <String, dynamic>{
        'current_stock': next,
        'status': _statusForStock(next, rop),
        'last_updated': FieldValue.serverTimestamp(),
      });
      tx.set(
        FirebaseFirestore.instance.collection(_kUsageCollection).doc(),
        <String, dynamic>{
          'material_variant_id': materialVariantId,
          'qty': qty,
          'direction': 'out',
          'source': 'manual',
          'order_id': orderId,
          'reason': reason,
          'shortfall': shortfall,
          'by_uid': byUid,
          'timestamp': FieldValue.serverTimestamp(),
        },
      );
    });
    debugPrint('[UsageService] Manual OUT $qty x $materialVariantId ($reason)');
    LiveActivityMarks.mark('inventory', materialVariantId);
    AuditService.log(
      actor: auth.currentUser,
      action: 'stock_usage',
      module: 'inventory',
      recordId: materialVariantId,
      recordLabel: 'Material $materialVariantId (-$qty, $reason)',
      oldValue: before,
      newValue: after,
    );
    return MovementResult(
      deltas: {materialVariantId: -qty},
      shortfall: shortfall,
    );
  }

  /// Auto-deducts an order's recipe. Called when the order enters
  /// 'In Production'. Idempotent: orders already flagged
  /// `stock_deducted` are skipped. Returns which variants moved.
  ///
  /// Requires orderUpdateStatus (caller) + inventoryUpdate (here).
  static Future<MovementResult> autoDeductForOrder({
    required String orderId,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.inventoryUpdate);
    final db = FirebaseFirestore.instance;
    final orderRef = db.collection(_kOrdersCollection).doc(orderId);
    final orderSnap = await orderRef.get();
    if (!orderSnap.exists) throw ArgumentError('Order not found: $orderId');
    final order = orderSnap.data()!;
    if (order['stock_deducted'] == true) {
      return const MovementResult(deltas: {}, skipped: true);
    }
    final itemType = (order['item_type'] as String?) ?? '';
    final orderQty = (order['quantity'] as num?)?.toInt() ?? 0;
    final bom = await fetchBom(itemType);
    if (bom == null || orderQty <= 0) {
      return const MovementResult(deltas: {}, skipped: true);
    }
    final consumption = bom.consumptionFor(orderQty);
    if (consumption.isEmpty) {
      return const MovementResult(deltas: {}, skipped: true);
    }
    final byUid = auth.currentUser?.id;
    var shortfall = false;
    final moves = <Map<String, dynamic>>[];
    await db.runTransaction((tx) async {
      // Re-check the flag inside the transaction (two staff tapping
      // Advance at once must not double-deduct).
      final fresh = await tx.get(orderRef);
      if ((fresh.data()?['stock_deducted'] as bool?) == true) return;
      for (final entry in consumption.entries) {
        final ref = db.collection(_kInventoryCollection).doc(entry.key);
        final snap = await tx.get(ref);
        if (!snap.exists) continue; // unknown variant: skip line, keep rest
        final current = snap.data()!;
        final stock = (current['current_stock'] as num?)?.toInt() ?? 0;
        final rop = (current['reorder_point'] as num?)?.toInt() ?? 0;
        var next = stock - entry.value;
        if (next < 0) {
          shortfall = true;
          next = 0;
        }
        moves.add({'id': entry.key, 'before': stock, 'after': next});
        tx.update(ref, <String, dynamic>{
          'current_stock': next,
          'status': _statusForStock(next, rop),
          'last_updated': FieldValue.serverTimestamp(),
        });
        tx.set(
          db.collection(_kUsageCollection).doc(),
          <String, dynamic>{
            'material_variant_id': entry.key,
            'qty': entry.value,
            'direction': 'out',
            'source': 'auto-deduct',
            'order_id': orderId,
            'reason': null,
            'shortfall': shortfall,
            'by_uid': byUid,
            'timestamp': FieldValue.serverTimestamp(),
          },
        );
      }
      tx.update(orderRef, <String, dynamic>{
        'stock_deducted': true,
        'deducted_at': FieldValue.serverTimestamp(),
      });
    });
    debugPrint('[UsageService] Auto-deducted $orderId: $consumption');
    for (final m in moves) {
      LiveActivityMarks.mark('inventory', m['id'] as String);
      AuditService.log(
        actor: auth.currentUser,
        action: 'stock_deducted_auto',
        module: 'inventory',
        recordId: m['id'] as String,
        recordLabel: 'Material ${m['id']} (auto-deduct for $orderId)',
        oldValue: m['before'],
        newValue: m['after'],
      );
    }
    return MovementResult(
      deltas: {for (final e in consumption.entries) e.key: -e.value},
      shortfall: shortfall,
    );
  }
}

/// Mirrors `firebase_inventory._statusForStock`, which mirrors web
/// `getInventoryStatus` in `web/src/lib/derived.ts` exactly:
///   stock <= floor(ROP * 0.6) - 'Insufficient Stock'
///   stock <= ROP              - 'Low Stock'
///   else                      - 'In Stock'
/// Both writers must agree or the same stock shows different pills
/// depending on who wrote last.
String _statusForStock(int stock, int reorderPoint) {
  if (stock <= (reorderPoint * 0.6).floor()) return 'Insufficient Stock';
  if (stock <= reorderPoint) return 'Low Stock';
  return 'In Stock';
}
