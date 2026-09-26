import 'package:cloud_firestore/cloud_firestore.dart' hide Order;
import 'package:flutter/foundation.dart';

import '../auth/auth_service.dart';
import '../models/bom.dart';
import '../models/order.dart';
import 'audit_service.dart';
import 'firebase_orders.dart' as fb;
import 'live_activity_marks.dart';
import 'usage_service.dart';

/// Service layer for order operations with permission enforcement.
///
/// All write operations check permissions via [AuthService] before
/// delegating to the Firestore-backed `firebase_orders` service. Errors
/// (permission denied, network, missing doc) propagate to the caller.
class OrderService {
  OrderService._();

  static final OrderService _instance = OrderService._();
  static OrderService get instance => _instance;

  /// Updates the payment status of an order.
  ///
  /// Requires [Permission.orderUpdatePayment].
  /// Throws [PermissionDeniedException] if the user lacks permission.
  static Future<void> updatePaymentStatus({
    required String orderId,
    required String newPaymentStatus,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.orderUpdatePayment);
    Map<String, dynamic>? prev;
    try {
      final prevSnap = await FirebaseFirestore.instance
          .collection('orders')
          .doc(orderId)
          .get();
      prev = prevSnap.data();
    } catch (_) {
      prev = null;
    }
    try {
      await fb.updatePaymentStatus(orderId, newPaymentStatus);
      LiveActivityMarks.mark('order', orderId);
      debugPrint('[OrderService] Updated payment for $orderId to $newPaymentStatus');
      AuditService.log(
        actor: auth.currentUser,
        action: 'payment_updated',
        module: 'payments',
        recordId: orderId,
        recordLabel: 'Order $orderId',
        oldValue: prev == null
            ? null
            : '${prev['payment_status'] ?? '-'} via ${prev['payment_method'] ?? '-'}',
        newValue: '$newPaymentStatus via ${prev?['payment_method'] ?? '-'}',
      );
    } catch (e) {
      debugPrint('[OrderService] updatePaymentStatus failed: $e');
      rethrow;
    }
  }

  /// Advances an order to the next production status.
  ///
  /// Requires [Permission.orderUpdateStatus] (production role).
  /// Throws [PermissionDeniedException] if the user lacks permission.
  /// Throws [StateError] if the order is already at the final status.
  static Future<void> advanceStatus({
    required String orderId,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.orderUpdateStatus);
    final snap = await FirebaseFirestore.instance
        .collection('orders')
        .doc(orderId)
        .get();
    if (!snap.exists) {
      throw ArgumentError('Order not found: $orderId');
    }
    final currentStatus = (snap.data() as Map<String, dynamic>)['status'] as String? ?? 'Pending';
    final next = _nextProductionStatus(currentStatus);
    if (next == null) {
      throw StateError('Order $orderId is already at final status: $currentStatus');
    }
    await fb.updateOrderStatus(orderId, next);
    LiveActivityMarks.mark('order', orderId);
    debugPrint('[OrderService] Advanced $orderId from $currentStatus to $next');
    AuditService.log(
      actor: auth.currentUser,
      action: 'order_status_updated',
      module: 'orders',
      recordId: orderId,
      recordLabel: 'Order $orderId',
      oldValue: currentStatus,
      newValue: next,
    );
    // Entering production = materials pulled: auto-deduct the recipe.
    // Idempotent via the order's stock_deducted flag - re-entering
    // In Production later deducts nothing. A missing BOM only warns;
    // the status change itself always stands.
    if (next == 'In Production') {
      try {
        final res =
            await UsageService.autoDeductForOrder(orderId: orderId, auth: auth);
        if (res.skipped) {
          debugPrint('[OrderService] Auto-deduct skipped for $orderId (no BOM or already deducted)');
        }
      } catch (e) {
        // Stock problems must never block the production flow - the
        // order is already In Production. Nothing is half-written
        // (transaction), so a later re-entry still deducts correctly.
        debugPrint('[OrderService] Auto-deduct failed for $orderId: $e');
      }
    }
  }

  /// Cancels an order.
  ///
  /// Allowed until handover: Pending, In Production, Ready for Pickup.
  /// Completed is terminal (a delivered order is a refund, not a cancel);
  /// already-Cancelled is an idempotent no-op. When nothing was deducted
  /// (Pending), this only flips the status - see [cancelOrderWithReturn]
  /// for returning already-deducted stock.
  /// Requires [Permission.orderCancel].
  /// Throws [PermissionDeniedException] if the user lacks permission.
  /// Throws [StateError] if the order is completed.
  static Future<void> cancelOrder({
    required String orderId,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.orderCancel);
    final snap = await FirebaseFirestore.instance
        .collection('orders')
        .doc(orderId)
        .get();
    if (!snap.exists) {
      throw ArgumentError('Order not found: $orderId');
    }
    final currentStatus = (snap.data() as Map<String, dynamic>)['status'] as String? ?? 'Pending';
    if (currentStatus == 'Completed') {
      throw StateError('Cannot cancel order $orderId: already completed');
    }
    if (currentStatus == 'Cancelled') return;
    await fb.cancelOrder(orderId);
    LiveActivityMarks.mark('order', orderId);
    debugPrint('[OrderService] Cancelled order $orderId');
    AuditService.log(
      actor: auth.currentUser,
      action: 'order_cancelled',
      module: 'orders',
      recordId: orderId,
      recordLabel: 'Order $orderId',
      oldValue: currentStatus,
      newValue: 'Cancelled',
    );
  }

  /// Cancels a deducted order and returns stock. The [returns] map holds
  /// per-variant return quantities (0 = keep deducted). Requires
  /// [Permission.orderCancel] plus [Permission.inventoryUpdate] (via the
  /// reversal) - cashiers without it get a PermissionDeniedException and
  /// should fall back to plain [cancelOrder].
  static Future<Map<String, int>> cancelOrderWithReturn({
    required String orderId,
    required Map<String, int> returns,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.orderCancel);
    final applied = await UsageService.reverseDeductionForCancel(
      orderId: orderId,
      returns: returns,
      auth: auth,
    );
    AuditService.log(
      actor: auth.currentUser,
      action: 'order_cancelled',
      module: 'orders',
      recordId: orderId,
      recordLabel: 'Order $orderId',
      newValue: applied.isEmpty
          ? 'Cancelled (no stock returned)'
          : 'Cancelled (returned: ${applied.entries.map((e) => '${e.key} +${e.value}').join(', ')})',
    );
    return applied;
  }

  /// Updates an order's pinned materials list. Only while the order is
  /// Pending - post-production the plan is locked (use the movement
  /// sheets instead).
  /// Requires [Permission.orderUpdateMaterials].
  /// Throws [PermissionDeniedException] if the user lacks permission.
  /// Throws [StateError] if the order is no longer Pending.
  static Future<void> updateOrderMaterials({
    required String orderId,
    required List<OrderMaterial> materials,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.orderUpdateMaterials);
    final snap = await FirebaseFirestore.instance
        .collection('orders')
        .doc(orderId)
        .get();
    if (!snap.exists) {
      throw ArgumentError('Order not found: $orderId');
    }
    final status =
        (snap.data() as Map<String, dynamic>)['status'] as String? ??
            'Pending';
    if (status != 'Pending') {
      throw StateError(
          'Materials can only be edited while the order is Pending');
    }
    for (final m in materials) {
      if (m.materialVariantId.trim().isEmpty || m.qty <= 0) {
        throw ArgumentError(
            'Each material needs a variant and a positive quantity');
      }
    }
    await FirebaseFirestore.instance.collection('orders').doc(orderId).update({
      'materials': materials.map((m) => m.toJson()).toList(growable: false),
    });
    LiveActivityMarks.mark('order', orderId);
    debugPrint('[OrderService] Updated materials for $orderId');
    AuditService.log(
      actor: auth.currentUser,
      action: 'order_materials_updated',
      module: 'orders',
      recordId: orderId,
      recordLabel: 'Order $orderId materials',
      newValue:
          materials.map((m) => '${m.materialVariantId} x${m.qty}').join(', '),
    );
  }

  /// Creates a new order. Returns the persisted order id.
  ///
  /// Requires [Permission.orderCreate] (cashier role).
  static Future<String> createOrder({
    required Order order,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.orderCreate);
    // Pin the BOM recipe (scaled to the order quantity) onto the order so
    // the deduct step and the detail screen show the same plan even if the
    // recipe changes later. A missing BOM yields an empty list - the deduct
    // then falls back to the live BOM at production entry. The lookup must
    // never block order creation.
    List<OrderMaterial> materials = const [];
    try {
      final bom =
          await UsageService.fetchBom(normalizeItemType(order.itemType));
      if (bom != null && order.quantity > 0) {
        materials = bom.lines
            .where((l) => l.qtyPerUnit > 0)
            .map((l) => OrderMaterial(
                  materialVariantId: l.materialVariantId,
                  qty: (l.qtyPerUnit * order.quantity).ceil(),
                ))
            .toList(growable: false);
      }
    } catch (_) {
      materials = const [];
    }
    final id = await fb.createOrder(order.copyWith(materials: materials));
    LiveActivityMarks.mark('order', id);
    debugPrint('[OrderService] Created new order $id');
    AuditService.log(
      actor: auth.currentUser,
      action: 'order_created',
      module: 'orders',
      recordId: id,
      recordLabel: 'Order $id (${order.itemType} x ${order.quantity})',
      newValue: 'status=${order.status}, amount=${order.paymentAmount}',
    );
    return id;
  }

  /// Returns the next production status in the workflow.
  static String? _nextProductionStatus(String currentStatus) {
    switch (currentStatus) {
      case 'Pending':
        return 'In Production';
      case 'In Production':
        return 'Ready for Pickup';
      case 'Ready for Pickup':
        return 'Completed';
      case 'Completed':
      case 'Cancelled':
      default:
        return null;
    }
  }
}
