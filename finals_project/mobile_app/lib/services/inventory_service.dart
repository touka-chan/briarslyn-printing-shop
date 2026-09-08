import 'package:flutter/foundation.dart';

import '../auth/auth_service.dart';
import '../models/inventory_item.dart';
import 'firebase_inventory.dart' as fb;

/// Service layer for inventory operations with permission enforcement.
///
/// All write operations check permissions via [AuthService] before
/// delegating to the Firestore-backed `firebase_inventory` service.
///
/// Note: `recordRfidEvent` was removed — RFID events are written by the
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
    try {
      await fb.updateStock(materialVariantId, newStock);
      debugPrint('[InventoryService] Updated stock for $materialVariantId to $newStock');
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
    try {
      await fb.updateReorderPoint(materialVariantId, newReorderPoint);
      debugPrint('[InventoryService] Updated reorder point for $materialVariantId to $newReorderPoint');
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
      debugPrint('[InventoryService] Created new variant ${item.materialVariantId}');
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
    try {
      await fb.deleteVariant(materialVariantId);
      debugPrint('[InventoryService] Deleted variant $materialVariantId');
    } catch (e) {
      rethrow;
    }
  }
}
