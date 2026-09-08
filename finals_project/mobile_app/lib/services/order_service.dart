import 'package:cloud_firestore/cloud_firestore.dart' hide Order;
import 'package:flutter/foundation.dart';

import '../auth/auth_service.dart';
import '../models/order.dart';
import 'firebase_orders.dart' as fb;

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
    try {
      await fb.updatePaymentStatus(orderId, newPaymentStatus);
      debugPrint('[OrderService] Updated payment for $orderId to $newPaymentStatus');
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
    debugPrint('[OrderService] Advanced $orderId from $currentStatus to $next');
  }

  /// Cancels an order.
  ///
  /// Requires [Permission.orderCancel].
  /// Throws [PermissionDeniedException] if the user lacks permission.
  /// Throws [StateError] if the order is in production or completed.
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
    if (currentStatus == 'In Production' ||
        currentStatus == 'Ready for Pickup' ||
        currentStatus == 'Completed') {
      throw StateError('Cannot cancel order $orderId: already in production or completed');
    }
    await fb.cancelOrder(orderId);
    debugPrint('[OrderService] Cancelled order $orderId');
  }

  /// Creates a new order. Returns the persisted order id.
  ///
  /// Requires [Permission.orderCreate] (cashier role).
  static Future<String> createOrder({
    required Order order,
    required AuthService auth,
  }) async {
    auth.assertCan(Permission.orderCreate);
    final id = await fb.createOrder(order);
    debugPrint('[OrderService] Created new order $id');
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
