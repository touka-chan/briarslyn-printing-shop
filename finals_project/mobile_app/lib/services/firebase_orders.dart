// PrintFlow Mobile — Firestore service for the `orders` collection.
//
// Mirrors the web `web/src/lib/services/orders.ts` contract exactly:
//   - Reads via `Order.fromJson` use the same snake_case field names the
//     dashboard writes (customer_name, customer_region, etc.).
//   - Writes use `Timestamp` for the two date fields the web dashboard
//     expects (target_date, created_at, estimated_completion, started_at,
//     completed_at). The mobile `Order` carries `DateTime`, so we convert
//     to Firestore Timestamps on the way out and back to DateTime on the
//     way in via `Order.fromJson`'s `toDate()` fallback.
//
// Permission-gated writes belong in `OrderService` — this file is the raw
// Firestore transport only.
//
// Field shape (snake_case ↔ Dart):
//   customer_name       ↔ Order.customerName
//   customer_email      ↔ Order.customerEmail
//   customer_phone      ↔ Order.customerPhone
//   customer_region     ↔ Order.customerRegion
//   customer_province   ↔ Order.customerProvince
//   customer_city       ↔ Order.customerCity
//   customer_barangay   ↔ Order.customerBarangay
//   customer_zip        ↔ Order.customerZip
//   item_type           ↔ Order.itemType
//   quantity            ↔ Order.quantity
//   layout_file         ↔ Order.layoutFile
//   target_date         ↔ Order.targetDate (Timestamp)
//   payment_amount      ↔ Order.paymentAmount
//   payment_status      ↔ Order.paymentStatus
//   payment_method      ↔ (not on Order — UI-only, read back as null)
//   status              ↔ Order.status
//   priority            ↔ Order.priority
//   estimated_completion↔ Order.estimatedCompletion (Timestamp)
//   based_on            ↔ Order.basedOn
//   created_at          ↔ Order.createdAt (Timestamp)
//   started_at          ↔ optional Timestamp (added on "In Production")
//   completed_at        ↔ optional Timestamp (added on "Completed")
//   cashier_id          ↔ Order.cashierId
import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/order.dart';

const String _kOrdersCollection = 'orders';

/// Subscribes to the live `orders` collection, sorted by `created_at` desc.
///
/// Emits an empty list until the first snapshot arrives.
Stream<List<Order>> subscribeOrdersStream() {
  return FirebaseFirestore.instance
      .collection(_kOrdersCollection)
      .orderBy('created_at', descending: true)
      .snapshots()
      .map(
        (snap) => snap.docs
            .map((doc) {
              // Stamp the doc id onto the data so `Order.fromJson` can read
              // it as `order_id` — matches the web contract where the doc
              // id IS the human order id.
              final raw = doc.data();
              raw['order_id'] = raw['order_id'] ?? doc.id;
              raw['id'] = doc.id;
              return Order.fromJson(raw);
            })
            .toList(growable: false),
      );
}

/// Creates a new order document and returns the persisted order id.
///
/// `Order.orderId` is used as the doc id when non-empty (matches the web
/// `ORD-XXXXXX` convention); otherwise Firestore assigns a new id and we
/// return it. `created_at` is stamped server-side via `FieldValue.serverTimestamp()`
/// so all clients see the same canonical time.
Future<String> createOrder(Order order) async {
  final db = FirebaseFirestore.instance;
  final String id =
      order.orderId.isNotEmpty ? order.orderId : db.collection(_kOrdersCollection).doc().id;

  // Build the payload with snake_case field names. We omit `id` and
  // `orderId` from the Dart class — the web service writes `customer_*`
  // fields and never persists the doc id inside the document.
  final Map<String, dynamic> data = {
    'customer_name': order.customerName,
    'customer_email': order.customerEmail,
    'customer_phone': order.customerPhone,
    'customer_region': order.customerRegion,
    'customer_province': order.customerProvince,
    'customer_city': order.customerCity,
    'customer_barangay': order.customerBarangay,
    'customer_zip': order.customerZip,
    'item_type': order.itemType,
    'quantity': order.quantity,
    'layout_file': order.layoutFile,
    'target_date': Timestamp.fromDate(order.targetDate),
    'payment_amount': order.paymentAmount,
    'payment_status': order.paymentStatus ?? 'Unpaid',
    'status': order.status,
    'priority': order.priority,
    'estimated_completion': Timestamp.fromDate(order.estimatedCompletion),
    'based_on': order.basedOn,
    'cashier_id': order.cashierId,
    'created_at': FieldValue.serverTimestamp(),
  };

  await db.collection(_kOrdersCollection).doc(id).set(data);
  return id;
}

/// Updates the order's `status` field. Stamps `started_at`/`completed_at`
/// server-side when the new status is a transition boundary, mirroring the
/// web `updateOrderStatus` behaviour.
Future<void> updateOrderStatus(String orderId, String status) async {
  final Map<String, dynamic> patch = <String, dynamic>{'status': status};
  if (status == 'In Production') {
    patch['started_at'] = FieldValue.serverTimestamp();
  }
  if (status == 'Completed') {
    patch['completed_at'] = FieldValue.serverTimestamp();
  }
  await FirebaseFirestore.instance
      .collection(_kOrdersCollection)
      .doc(orderId)
      .update(patch);
}

/// Updates the order's `payment_status` field.
Future<void> updatePaymentStatus(String orderId, String newPaymentStatus) async {
  await FirebaseFirestore.instance
      .collection(_kOrdersCollection)
      .doc(orderId)
      .update(<String, dynamic>{'payment_status': newPaymentStatus});
}

/// Marks the order as `Cancelled`. We never delete orders — history is kept.
Future<void> cancelOrder(String orderId) async {
  await FirebaseFirestore.instance
      .collection(_kOrdersCollection)
      .doc(orderId)
      .update(<String, dynamic>{'status': 'Cancelled'});
}
