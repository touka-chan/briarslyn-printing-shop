import 'package:flutter/material.dart';

import '../auth/auth_service.dart';
import '../models/inventory_item.dart';
import '../models/rfid_event.dart';
import '../utils/mock_data.dart';

/// Service layer for inventory operations with permission enforcement.
///
/// All write operations require production role permissions.
/// Cashier role has read-only access to inventory.
class InventoryService {
  InventoryService._();

  static final InventoryService _instance = InventoryService._();
  static InventoryService get instance => _instance;

  /// Updates the stock level of a material variant.
  ///
  /// Requires [Permission.inventoryUpdate] (production role).
  /// Throws [PermissionDeniedException] if the user lacks permission.
  static Future<void> updateStock({
    required String materialVariantId,
    required int newStock,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.inventoryUpdate);

    final index = mockInventory.indexWhere((i) => i.materialVariantId == materialVariantId);
    if (index == -1) {
      throw ArgumentError('Inventory variant not found: $materialVariantId');
    }

    await Future.delayed(const Duration(milliseconds: 300));

    final item = mockInventory[index];
    mockInventory[index] = InventoryItem(
      materialVariantId: item.materialVariantId,
      itemType: item.itemType,
      category: item.category,
      tagUid: item.tagUid,
      sensorId: item.sensorId,
      currentStock: newStock,
      threshold: item.threshold,
      reorderPoint: item.reorderPoint,
      forecastedDemandNext7Days: item.forecastedDemandNext7Days,
      model: item.model,
      status: _computeStatus(newStock, item.threshold, item.reorderPoint),
      isStale: item.isStale,
      lastUpdated: DateTime.now(),
      lastCheckoutAt: item.lastCheckoutAt,
    );

    debugPrint('[InventoryService] Updated stock for $materialVariantId to $newStock');
  }

  /// Updates the reorder point for a material variant.
  ///
  /// Requires [Permission.inventoryUpdate] (production role).
  static Future<void> updateReorderPoint({
    required String materialVariantId,
    required int newReorderPoint,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.inventoryUpdate);

    final index = mockInventory.indexWhere((i) => i.materialVariantId == materialVariantId);
    if (index == -1) {
      throw ArgumentError('Inventory variant not found: $materialVariantId');
    }

    await Future.delayed(const Duration(milliseconds: 300));

    final item = mockInventory[index];
    mockInventory[index] = InventoryItem(
      materialVariantId: item.materialVariantId,
      itemType: item.itemType,
      category: item.category,
      tagUid: item.tagUid,
      sensorId: item.sensorId,
      currentStock: item.currentStock,
      threshold: item.threshold,
      reorderPoint: newReorderPoint,
      forecastedDemandNext7Days: item.forecastedDemandNext7Days,
      model: item.model,
      status: _computeStatus(item.currentStock, item.threshold, newReorderPoint),
      isStale: item.isStale,
      lastUpdated: DateTime.now(),
      lastCheckoutAt: item.lastCheckoutAt,
    );

    debugPrint('[InventoryService] Updated reorder point for $materialVariantId to $newReorderPoint');
  }

  /// Creates a new material variant.
  ///
  /// Requires [Permission.inventoryCreate] (production role).
  static Future<InventoryItem> createVariant({
    required InventoryItem item,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.inventoryCreate);

    await Future.delayed(const Duration(milliseconds: 500));

    mockInventory.add(item);

    debugPrint('[InventoryService] Created new variant ${item.materialVariantId}');
    return item;
  }

  /// Deletes a material variant.
  ///
  /// Requires [Permission.inventoryDelete] (production role, but not typically used).
  static Future<void> deleteVariant({
    required String materialVariantId,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.inventoryDelete);

    final index = mockInventory.indexWhere((i) => i.materialVariantId == materialVariantId);
    if (index == -1) {
      throw ArgumentError('Inventory variant not found: $materialVariantId');
    }

    await Future.delayed(const Duration(milliseconds: 300));

    mockInventory.removeAt(index);

    debugPrint('[InventoryService] Deleted variant $materialVariantId');
  }

  /// Records an RFID checkout event (simulates sensor reading).
  ///
  /// Requires [Permission.sensorConfigure] (production role).
  static Future<void> recordRfidEvent({
    required String materialVariantId,
    required String tagUid,
    required int quantityChange,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.sensorConfigure);

    await Future.delayed(const Duration(milliseconds: 200));

    final index = mockInventory.indexWhere((i) => i.materialVariantId == materialVariantId);
    if (index != -1) {
      final item = mockInventory[index];
      final newStock = (item.currentStock + quantityChange).clamp(0, 9999);
      mockInventory[index] = InventoryItem(
        materialVariantId: item.materialVariantId,
        itemType: item.itemType,
        category: item.category,
        tagUid: item.tagUid,
        sensorId: item.sensorId,
        currentStock: newStock,
        threshold: item.threshold,
        reorderPoint: item.reorderPoint,
        forecastedDemandNext7Days: item.forecastedDemandNext7Days,
        model: item.model,
        status: _computeStatus(newStock, item.threshold, item.reorderPoint),
        isStale: false,
        lastUpdated: DateTime.now(),
        lastCheckoutAt: DateTime.now(),
      );
    }

    // Also add to mock activity
    mockActivity.insert(0, RfidCheckoutEvent(
      materialVariantId: materialVariantId,
      tagUid: tagUid,
      sensorId: 'ESP32-01',
      timestamp: DateTime.now(),
    ));

    debugPrint('[InventoryService] Recorded RFID event for $materialVariantId: $quantityChange');
  }

  /// Computes inventory status based on stock levels.
  static String _computeStatus(int currentStock, int threshold, int reorderPoint) {
    if (currentStock <= 0) return 'Insufficient Stock';
    if (currentStock <= reorderPoint) return 'Low Stock';
    if (currentStock <= threshold) return 'Low Stock';
    return 'In Stock';
  }
}