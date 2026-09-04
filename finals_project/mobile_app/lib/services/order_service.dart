import 'package:flutter/material.dart';

import '../auth/auth_service.dart';
import '../models/order.dart';
import '../utils/mock_data.dart';

/// Service layer for order operations with permission enforcement.
///
/// All write operations check permissions via [AuthService] before mutating data.
/// In a real app, these would be API calls to a backend that also enforces permissions.
class OrderService {
  OrderService._();

  static final OrderService _instance = OrderService._();
  static OrderService get instance => _instance;

  /// Updates the payment status of an order.
  ///
  /// Requires [Permission.orderUpdatePayment] (cashier role).
  /// Throws [PermissionDeniedException] if the user lacks permission.
  static Future<void> updatePaymentStatus({
    required String orderId,
    required String newPaymentStatus,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.orderUpdatePayment);

    // Find and update the order in mock data
    final index = mockOrders.indexWhere((o) => o.orderId == orderId);
    if (index == -1) {
      throw ArgumentError('Order not found: $orderId');
    }

    // Simulate network latency
    await Future.delayed(const Duration(milliseconds: 300));

    final order = mockOrders[index];
    mockOrders[index] = Order(
      orderId: order.orderId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      customerRegion: order.customerRegion,
      customerProvince: order.customerProvince,
      customerCity: order.customerCity,
      customerBarangay: order.customerBarangay,
      customerZip: order.customerZip,
      itemType: order.itemType,
      quantity: order.quantity,
      layoutFile: order.layoutFile,
      targetDate: order.targetDate,
      paymentAmount: order.paymentAmount,
      paymentStatus: newPaymentStatus,
      status: order.status,
      priority: order.priority,
      estimatedCompletion: order.estimatedCompletion,
      basedOn: order.basedOn,
      createdAt: order.createdAt,
    );

    debugPrint('[OrderService] Updated payment status for $orderId to $newPaymentStatus');
  }

  /// Advances an order to the next production status.
  ///
  /// Requires [Permission.orderUpdateStatus] (production role).
  /// Throws [PermissionDeniedException] if the user lacks permission.
  static Future<void> advanceStatus({
    required String orderId,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.orderUpdateStatus);

    final index = mockOrders.indexWhere((o) => o.orderId == orderId);
    if (index == -1) {
      throw ArgumentError('Order not found: $orderId');
    }

    await Future.delayed(const Duration(milliseconds: 300));

    final order = mockOrders[index];
    final nextStatus = _nextProductionStatus(order.status);

    if (nextStatus == null) {
      throw StateError('Order $orderId is already at final status: ${order.status}');
    }

    mockOrders[index] = Order(
      orderId: order.orderId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      customerRegion: order.customerRegion,
      customerProvince: order.customerProvince,
      customerCity: order.customerCity,
      customerBarangay: order.customerBarangay,
      customerZip: order.customerZip,
      itemType: order.itemType,
      quantity: order.quantity,
      layoutFile: order.layoutFile,
      targetDate: order.targetDate,
      paymentAmount: order.paymentAmount,
      paymentStatus: order.paymentStatus,
      status: nextStatus,
      priority: order.priority,
      estimatedCompletion: order.estimatedCompletion,
      basedOn: order.basedOn,
      createdAt: order.createdAt,
    );

    debugPrint('[OrderService] Advanced $orderId from ${order.status} to $nextStatus');
  }

  /// Cancels an order.
  ///
  /// Requires [Permission.orderCancel] (both roles can cancel before production).
  /// Throws [PermissionDeniedException] if the user lacks permission.
  static Future<void> cancelOrder({
    required String orderId,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.orderCancel);

    final index = mockOrders.indexWhere((o) => o.orderId == orderId);
    if (index == -1) {
      throw ArgumentError('Order not found: $orderId');
    }

    final order = mockOrders[index];

    // Only allow cancellation if not yet in production
    if (order.status == 'In Production' || order.status == 'Ready for Pickup' || order.status == 'Completed') {
      throw StateError('Cannot cancel order $orderId: already in production or completed');
    }

    await Future.delayed(const Duration(milliseconds: 300));

    mockOrders[index] = Order(
      orderId: order.orderId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      customerRegion: order.customerRegion,
      customerProvince: order.customerProvince,
      customerCity: order.customerCity,
      customerBarangay: order.customerBarangay,
      customerZip: order.customerZip,
      itemType: order.itemType,
      quantity: order.quantity,
      layoutFile: order.layoutFile,
      targetDate: order.targetDate,
      paymentAmount: order.paymentAmount,
      paymentStatus: order.paymentStatus,
      status: 'Cancelled',
      priority: order.priority,
      estimatedCompletion: order.estimatedCompletion,
      basedOn: order.basedOn,
      createdAt: order.createdAt,
    );

    debugPrint('[OrderService] Cancelled order $orderId');
  }

  /// Creates a new order.
  ///
  /// Requires [Permission.orderCreate] (cashier role).
  /// Throws [PermissionDeniedException] if the user lacks permission.
  static Future<Order> createOrder({
    required Order order,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.orderCreate);

    await Future.delayed(const Duration(milliseconds: 600));

    mockOrders.insert(0, order);

    debugPrint('[OrderService] Created new order ${order.orderId}');
    return order;
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
