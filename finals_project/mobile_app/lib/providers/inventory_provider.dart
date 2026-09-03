import 'package:flutter/material.dart';
import 'package:printflow_mobile/models/inventory_item.dart';
import 'package:printflow_mobile/utils/mock_data.dart';

/// Reactive mock data source for inventory.
/// Replace with Firebase implementation later — UI stays the same.
class InventoryProvider extends ChangeNotifier {
  // ──────────────────────────────────────────────
  // State
  // ──────────────────────────────────────────────
  List<InventoryItem> _items = [];
  bool _isLoading = false;
  String? _error;
  InventoryFilter _activeFilter = InventoryFilter.all;

  // ──────────────────────────────────────────────
  // Getters
  // ──────────────────────────────────────────────
  List<InventoryItem> get items => List.unmodifiable(_items);
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasError => _error != null;
  InventoryFilter get activeFilter => _activeFilter;

  // Derived lists
  List<InventoryItem> get filteredItems {
    switch (_activeFilter) {
      case InventoryFilter.inStock:
        return _items.where((i) => i.status == StockStatus.inStock).toList();
      case InventoryFilter.lowStock:
        return _items.where((i) => i.status == StockStatus.lowStock).toList();
      case InventoryFilter.insufficient:
        return _items.where((i) => i.status == StockStatus.insufficient).toList();
      case InventoryFilter.all:
      default:
        return List.from(_items);
    }
  }

  // KPIs
  int get totalItems => _items.length;
  int get inStockCount => _items.where((i) => i.status == StockStatus.inStock).length;
  int get lowStockCount => _items.where((i) => i.status == StockStatus.lowStock).length;
  int get insufficientCount => _items.where((i) => i.status == StockStatus.insufficient).length;

  // ──────────────────────────────────────────────
  // Init
  // ──────────────────────────────────────────────
  Future<void> initialize() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    await Future.delayed(const Duration(milliseconds: 300));

    _items = MockData.mockInventory;
    _isLoading = false;
    notifyListeners();
  }

  // ──────────────────────────────────────────────
  // Mutations
  // ──────────────────────────────────────────────

  /// Set active filter tab
  void setFilter(InventoryFilter filter) {
    _activeFilter = filter;
    notifyListeners();
  }

  /// Update stock quantity (from RFID checkout or manual adjustment)
  Future<void> updateStock(String itemId, int newQuantity, {String? rfidTag}) async {
    final idx = _items.indexWhere((i) => i.id == itemId);
    if (idx == -1) return;

    final item = _items[idx];
    final updated = item.copyWith(
      currentStock: newQuantity,
      rfidTag: rfidTag ?? item.rfidTag,
      lastUpdated: DateTime.now(),
    );
    _items[idx] = updated;
    notifyListeners();
  }

  /// Consume stock (when material used in production)
  Future<void> consumeStock(String itemId, int quantity) async {
    final idx = _items.indexWhere((i) => i.id == itemId);
    if (idx == -1) return;

    final item = _items[idx];
    final newStock = (item.currentStock - quantity).clamp(0, item.maxCapacity);
    _items[idx] = item.copyWith(
      currentStock: newStock,
      lastUpdated: DateTime.now(),
    );
    notifyListeners();
  }

  /// Reorder stock (simulate purchase order)
  Future<void> reorderStock(String itemId, int quantity) async {
    final idx = _items.indexWhere((i) => i.id == itemId);
    if (idx == -1) return;

    // Simulate order placed - in real app this would create a PO
    await Future.delayed(const Duration(milliseconds: 500));

    // For demo, immediately "receive" the stock
    final item = _items[idx];
    _items[idx] = item.copyWith(
      currentStock: (item.currentStock + quantity).clamp(0, item.maxCapacity),
      lastUpdated: DateTime.now(),
      status: StockStatus.inStock,
    );
    notifyListeners();
  }

  /// Get single item by ID
  InventoryItem? getItem(String id) {
    try {
      return _items.firstWhere((i) => i.id == id);
    } catch (_) {
      return null;
    }
  }

  /// Search items
  List<InventoryItem> search(String query) {
    if (query.isEmpty) return filteredItems;
    final q = query.toLowerCase();
    return _items.where((i) =>
        i.name.toLowerCase().contains(q) ||
        i.materialType.toLowerCase().contains(q) ||
        i.rfidTag?.toLowerCase().contains(q) ?? false
    ).toList();
  }
}

/// Filter tabs for inventory screen
enum InventoryFilter {
  all,
  inStock,
  lowStock,
  insufficient,
}