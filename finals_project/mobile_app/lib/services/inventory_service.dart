import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

import '../auth/auth_service.dart';
import '../models/inventory_item.dart';
import 'audit_service.dart';
import 'firebase_inventory.dart' as fb;
import 'live_activity_marks.dart';

/// Service layer for inventory operations with permission enforcement.
///
/// All write operations check permissions via [AuthService] before
/// delegating to the Firestore-backed `firebase_inventory` service.
///
/// Note: `recordRfidEvent` was removed - RFID events are written by the
/// ESP32 station (or a Cloud Function) directly to Firestore, never by the
/// mobile app. The production sensor screen subscribes to the `rfid_events`
/// collection via `firebase_rfid.subscribeRfidEvents`.
class InventoryService {
  InventoryService._();

  static final InventoryService _instance = InventoryService._();
  static InventoryService get instance => _instance;

  /// Updates the stock level of a material variant.
  ///
  /// Requires [Permission.inventoryUpdate].
  /// Throws [PermissionDeniedException] if the user lacks permission.
  static Future<void> updateStock({
    required String materialVariantId,
    required int newStock,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.inventoryUpdate);
    final prev = await _readVariant(materialVariantId);
    try {
      await fb.updateStock(materialVariantId, newStock);
      LiveActivityMarks.mark('inventory', materialVariantId);
      debugPrint('[InventoryService] Updated stock for $materialVariantId to $newStock');
      AuditService.log(
        actor: auth.currentUser,
        action: 'stock_adjusted',
        module: 'inventory',
        recordId: materialVariantId,
        recordLabel: 'Material $materialVariantId',
        oldValue: prev?['current_stock'],
        newValue: newStock,
      );
    } catch (e) {
      debugPrint('[InventoryService] updateStock failed: $e');
      rethrow;
    }
  }

  /// Updates the reorder point for a material variant.
  ///
  /// Requires [Permission.inventoryUpdate].
  static Future<void> updateReorderPoint({
    required String materialVariantId,
    required int newReorderPoint,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.inventoryUpdate);
    final prev = await _readVariant(materialVariantId);
    try {
      await fb.updateReorderPoint(materialVariantId, newReorderPoint);
      LiveActivityMarks.mark('inventory', materialVariantId);
      debugPrint('[InventoryService] Updated reorder point for $materialVariantId to $newReorderPoint');
      AuditService.log(
        actor: auth.currentUser,
        action: 'reorder_point_updated',
        module: 'inventory',
        recordId: materialVariantId,
        recordLabel: 'Material $materialVariantId',
        oldValue: prev?['reorder_point'],
        newValue: newReorderPoint,
      );
    } catch (e) {
      rethrow;
    }
  }

  /// Creates a new material variant.
  ///
  /// Requires [Permission.inventoryCreate].
  static Future<void> createVariant({
    required InventoryItem item,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.inventoryCreate);
    try {
      await fb.createVariant(item);
      LiveActivityMarks.mark('inventory', item.materialVariantId);
      debugPrint('[InventoryService] Created new variant ${item.materialVariantId}');
      AuditService.log(
        actor: auth.currentUser,
        action: 'variant_created',
        module: 'inventory',
        recordId: item.materialVariantId,
        recordLabel: 'Material ${item.materialVariantId} (${item.itemType})',
        newValue: 'stock=${item.currentStock}, ROP=${item.reorderPoint}',
      );
    } catch (e) {
      rethrow;
    }
  }

  /// Deletes a material variant.
  ///
  /// Requires [Permission.inventoryDelete].
  static Future<void> deleteVariant({
    required String materialVariantId,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.inventoryDelete);
    final prev = await _readVariant(materialVariantId);
    try {
      await fb.deleteVariant(materialVariantId);
      LiveActivityMarks.mark('inventory', materialVariantId);
      debugPrint('[InventoryService] Deleted variant $materialVariantId');
      AuditService.log(
        actor: auth.currentUser,
        action: 'variant_deleted',
        module: 'inventory',
        recordId: materialVariantId,
        recordLabel: 'Material $materialVariantId (${prev?['item_type'] ?? '?'})',
        oldValue: prev?['item_type'] as String?,
      );
    } catch (e) {
      rethrow;
    }
  }

  /// Finds the variant a physical tag is currently bound to (null when
  /// the tag is free). Used by the scan-to-confirm flow so a tap can
  /// never silently move stock into the wrong item.
  static Future<String?> findVariantByTag(String tagUid) async {
    try {
      final snap = await FirebaseFirestore.instance
          .collection('inventory')
          .where('tag_uid', isEqualTo: tagUid)
          .limit(1)
          .get();
      if (snap.docs.isEmpty) return null;
      return snap.docs.first.id;
    } catch (_) {
      return null;
    }
  }

  /// Binds (or replaces) a tag on a variant.
  ///
  /// Requires [Permission.inventoryUpdate].
  static Future<void> bindTag({
    required String materialVariantId,
    required String tagUid,
    required AuthService auth,
    String? previousTag,
  }) async {
    auth.assertCan(Permission.inventoryUpdate);
    await FirebaseFirestore.instance
        .collection('inventory')
        .doc(materialVariantId)
        .update(<String, dynamic>{
      'tag_uid': tagUid,
      'last_updated': FieldValue.serverTimestamp(),
    });
    LiveActivityMarks.mark('inventory', materialVariantId);
    debugPrint('[InventoryService] Bound tag $tagUid to $materialVariantId');
    AuditService.log(
      actor: auth.currentUser,
      action: 'tag_bound',
      module: 'inventory',
      recordId: materialVariantId,
      recordLabel: 'Material $materialVariantId tag',
      oldValue: previousTag,
      newValue: tagUid,
    );
  }

  /// Best-effort pre-read for audit old-values. Returns null when the doc
  /// is missing/unreadable - callers still proceed with the write.
  static Future<Map<String, dynamic>?> _readVariant(String id) async {
    try {
      final snap = await FirebaseFirestore.instance
          .collection('inventory')
          .doc(id)
          .get();
      return snap.data();
    } catch (_) {
      return null;
    }
  }
}
