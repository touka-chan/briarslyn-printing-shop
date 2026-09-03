import 'package:flutter/material.dart';
import 'package:printflow_mobile/models/order.dart';
import 'package:printflow_mobile/models/inventory_item.dart';
import 'package:printflow_mobile/utils/mock_data.dart';

/// Reactive mock data source for orders.
/// Replace with Firebase implementation later — UI stays the same.
class OrderProvider extends ChangeNotifier {
  // ──────────────────────────────────────────────
  // State
  // ──────────────────────────────────────────────
  List<Order> _orders = [];
  bool _isLoading = false;
  String? _error;

  // ──────────────────────────────────────────────
  // Getters
  // ──────────────────────────────────────────────
  List<Order> get orders => List.unmodifiable(_orders);
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasError => _error != null;

  // Derived lists for specific screens
  List<Order> get cashierOrders => _orders
      .where((o) => o.status != OrderStatus.completed)
      .toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

  List<Order> get productionQueue => _orders
      .where((o) => o.status != OrderStatus.completed)
      .toList()
        ..sort((a, b) {
          // Priority: overdue > urgent > upcoming > pending > in_production > ready
          final aPri = _priorityWeight(a);
          final bPri = _priorityWeight(b);
          if (aPri != bPri) return bPri.compareTo(aPri); // higher weight first
          return a.targetDate.compareTo(b.targetDate); // sooner dates first
        });

  List<Order> get pendingOrders => _orders
      .where((o) => o.status == OrderStatus.pending)
      .toList()
        ..sort((a, b) => a.targetDate.compareTo(b.targetDate));

  List<Order> get inProductionOrders => _orders
      .where((o) => o.status == OrderStatus.inProduction)
      .toList()
        ..sort((a, b) => a.targetDate.compareTo(b.targetDate));

  List<Order> get readyForPickupOrders => _orders
      .where((o) => o.status == OrderStatus.readyForPickup)
      .toList()
        ..sort((a, b) => a.targetDate.compareTo(b.targetDate));

  List<Order> get completedOrders => _orders
      .where((o) => o.status == OrderStatus.completed)
      .toList()
        ..sort((a, b) => b.completedAt!.compareTo(a.completedAt!));

  // KPIs for cashier home
  int get todayOrdersCount => _orders
      .where((o) => _isToday(o.createdAt))
      .length;

  int get pendingCount => _orders
      .where((o) => o.status == OrderStatus.pending)
      .length;

  int get collectedTodayCount => _orders
      .where((o) => o.status == OrderStatus.completed && _isToday(o.completedAt ?? o.createdAt))
      .length;

  double get avgPrepTimeMinutes {
    final completed = _orders.where((o) => o.status == OrderStatus.completed && o.actualMinutes != null).toList();
    if (completed.isEmpty) return 0;
    final sum = completed.fold<int>(0, (acc, o) => acc + (o.actualMinutes ?? 0));
    return (sum / completed.length).roundToDouble();
  }

  // ──────────────────────────────────────────────
  // Init
  // ──────────────────────────────────────────────
  Future<void> initialize() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    // Simulate network delay
    await Future.delayed(const Duration(milliseconds: 400));

    _orders = MockData.mockOrders;
    _isLoading = false;
    notifyListeners();
  }

  // ──────────────────────────────────────────────
  // Mutations (frontend-only, optimistic)
  // ──────────────────────────────────────────────

  /// Create a new order (from cashier)
  Future<String> createOrder(Order order) async {
    _isLoading = true;
    notifyListeners();
    await Future.delayed(const Duration(milliseconds: 300));
    _orders.insert(0, order); // newest first
    _isLoading = false;
    notifyListeners();
    return order.id;
  }

  /// Update order status (cashier or production)
  Future<void> updateOrderStatus(String orderId, OrderStatus newStatus) async {
    final idx = _orders.indexWhere((o) => o.id == orderId);
    if (idx == -1) return;

    final now = DateTime.now();
    Order updated = _orders[idx].copyWith(
      status: newStatus,
      // Track timestamps for each transition
      startedAt: newStatus == OrderStatus.inProduction ? now : _orders[idx].startedAt,
      completedAt: newStatus == OrderStatus.completed ? now : _orders[idx].completedAt,
      actualMinutes: newStatus == OrderStatus.completed && _orders[idx].startedAt != null
          ? now.difference(_orders[idx].startedAt!).inMinutes
          : _orders[idx].actualMinutes,
    );
    _orders[idx] = updated;
    notifyListeners();
  }

  /// Update production details (notes, actual time)
  Future<void> updateProductionDetails(String orderId, {
    String? notes,
    int? actualMinutes,
  }) async {
    final idx = _orders.indexWhere((o) => o.id == orderId);
    if (idx == -1) return;

    _orders[idx] = _orders[idx].copyWith(
      productionNotes: notes ?? _orders[idx].productionNotes,
      actualMinutes: actualMinutes ?? _orders[idx].actualMinutes,
    );
    notifyListeners();
  }

  /// Delete order (admin)
  Future<void> deleteOrder(String orderId) async {
    _orders.removeWhere((o) => o.id == orderId);
    notifyListeners();
  }

  /// Get single order by ID
  Order? getOrder(String id) {
    try {
      return _orders.firstWhere((o) => o.id == id);
    } catch (_) {
      return null;
    }
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  int _priorityWeight(Order o) {
    final now = DateTime.now();
    final isOverdue = o.targetDate.isBefore(now) && o.status != OrderStatus.completed;

    if (isOverdue) return 4; // Overdue
    if (o.priority == OrderPriority.urgent) return 3; // Urgent
    if (o.priority == OrderPriority.upcoming) return 2; // Upcoming
    if (o.status == OrderStatus.inProduction) return 2;
    if (o.status == OrderStatus.readyForPickup) return 1;
    return 1; // Pending / normal
  }

  bool _isToday(DateTime dt) {
    final now = DateTime.now();
    return dt.year == now.year && dt.month == now.month && dt.day == now.day;
  }

  // ──────────────────────────────────────────────
  // Filtering for cashier orders screen
  // ──────────────────────────────────────────────
  List<Order> getFilteredOrders({
    String? searchQuery,
    OrderStatus? statusFilter,
  }) {
    var result = cashierOrders;

    if (searchQuery != null && searchQuery.isNotEmpty) {
      final q = searchQuery.toLowerCase();
      result = result.where((o) =>
          o.id.toLowerCase().contains(q) ||
          o.customerName.toLowerCase().contains(q) ||
          o.customerPhone.contains(q) ||
          (o.layoutFileName?.toLowerCase().contains(q) ?? false)
      ).toList();
    }

    if (statusFilter != null) {
      result = result.where((o) => o.status == statusFilter).toList();
    }

    return result;
  }
}