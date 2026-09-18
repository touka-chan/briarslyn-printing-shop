// PrintFlow Mobile - Firestore service for the `inventory` collection.
//
// Mirrors the web `web/src/lib/services/inventory.ts` contract exactly.
// Field shape (snake_case <-> Dart `InventoryItem`):
//   material_variant_id          <-> materialVariantId
//   item_type                    <-> itemType
//   category                     <-> category
//   tag_uid                      <-> tagUid
//   sensor_id                    <-> sensorId
//   current_stock                <-> currentStock
//   reorder_point                <-> reorderPoint
//   forecasted_demand_next_7_days<-> forecastedDemandNext7Days
//   model                        <-> model
//   status                       <-> status
//   last_updated                 <-> lastUpdated (Timestamp)
//   last_checkout_at             <-> lastCheckoutAt (Timestamp, optional)
//
// Permission-gated writes belong in `InventoryService` - this file is the
// raw Firestore transport only. RFID check-out events are written by the
// ESP32 station directly to `rfid_events`; the mobile app does NOT call
// `recordRfidEvent`.
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

import '../models/inventory_item.dart';

const String _kInventoryCollection = 'inventory';

/// Subscribes to the live `inventory` collection.
///
/// Emits an empty list until the first snapshot arrives.
Stream<List<InventoryItem>> subscribeInventoryStream() {
  return FirebaseFirestore.instance
      .collection(_kInventoryCollection)
      .snapshots()
      .map(
        (snap) => snap.docs
            .map(
              (doc) {
                final raw = doc.data();
                // `InventoryItem.fromJson` reads the camelCase
                // `lastCheckoutAt` key (legacy from the model), while
                // Firestore stores the snake_case `last_checkout_at`
                // (matches the web service contract). Forward the
                // snake_case value under the camelCase alias so the
                // model resolves it correctly.
                if (raw['last_checkout_at'] != null &&
                    raw['lastCheckoutAt'] == null) {
                  raw['lastCheckoutAt'] = raw['last_checkout_at'];
                }
                try {
                  return InventoryItem.fromJson(<String, dynamic>{
                    ...raw,
                    'id': doc.id,
                    'material_variant_id':
                        (raw['material_variant_id'] as String?) ?? doc.id,
                  });
                } catch (e) {
                  // One malformed doc must not kill the whole list.
                  debugPrint('[inventory] Skipping malformed doc ${doc.id}: $e');
                  return null;
                }
              },
            )
            .whereType<InventoryItem>()
            .toList(growable: false),
      );
}

/// Creates a new material variant. The Dart `materialVariantId` is used as
/// the doc id (matches the web `INV-XXXXXX` convention). Stamps
/// `last_updated` and computes the initial `status` from current_stock
/// vs. reorder_point so the dashboard's status filter shows the right
/// pill without a follow-up write.
Future<void> createVariant(InventoryItem item) async {
  final FirebaseFirestore db = FirebaseFirestore.instance;
  final String id = item.materialVariantId;

  await db.collection(_kInventoryCollection).doc(id).set(<String, dynamic>{
    'material_variant_id': id,
    'item_type': item.itemType,
    'category': item.category,
    'tag_uid': item.tagUid,
    'sensor_id': item.sensorId,
    'current_stock': item.currentStock,
    'reorder_point': item.reorderPoint,
    'forecasted_demand_next_7_days': item.forecastedDemandNext7Days,
    'model': item.model,
    'status': item.status,
    'last_updated': FieldValue.serverTimestamp(),
    'last_checkout_at': null,
  });
}

/// Updates the variant's `current_stock` and recomputes `status` based on
/// the new stock against the existing reorder point. `last_updated` is
/// stamped server-side. The single-doc read+write happens in a transaction
/// so a concurrent update can't race the status recompute.
Future<void> updateStock(String materialVariantId, int newStock) async {
  final FirebaseFirestore db = FirebaseFirestore.instance;
  final DocumentReference<Map<String, dynamic>> ref =
      db.collection(_kInventoryCollection).doc(materialVariantId);

  await db.runTransaction((transaction) async {
    final DocumentSnapshot<Map<String, dynamic>> snap = await transaction.get(ref);
    final Map<String, dynamic> current =
        snap.data() ?? <String, dynamic>{};
    final int rop = (current['reorder_point'] as num?)?.toInt() ?? 0;
    final String newStatus = _statusForStock(newStock, rop);

    transaction.update(ref, <String, dynamic>{
      'current_stock': newStock,
      'status': newStatus,
      'last_updated': FieldValue.serverTimestamp(),
    });
  });
}

/// Updates the variant's `reorder_point` and recomputes `status` based on
/// the existing `current_stock` against the new ROP. `last_updated` is
/// stamped server-side.
Future<void> updateReorderPoint(
  String materialVariantId,
  int newReorderPoint,
) async {
  final FirebaseFirestore db = FirebaseFirestore.instance;
  final DocumentReference<Map<String, dynamic>> ref =
      db.collection(_kInventoryCollection).doc(materialVariantId);

  await db.runTransaction((transaction) async {
    final DocumentSnapshot<Map<String, dynamic>> snap = await transaction.get(ref);
    final Map<String, dynamic> current =
        snap.data() ?? <String, dynamic>{};
    final int stock = (current['current_stock'] as num?)?.toInt() ?? 0;
    final String newStatus = _statusForStock(stock, newReorderPoint);

    transaction.update(ref, <String, dynamic>{
      'reorder_point': newReorderPoint,
      'status': newStatus,
      'last_updated': FieldValue.serverTimestamp(),
    });
  });
}

/// Deletes a material variant document.
Future<void> deleteVariant(String materialVariantId) async {
  await FirebaseFirestore.instance
      .collection(_kInventoryCollection)
      .doc(materialVariantId)
      .delete();
}

// ---- internal helpers --------------------------------------------------

/// Recomputes the inventory status pill string from the new stock and ROP.
///
/// Mirrors the web `getInventoryStatus` in `web/src/lib/derived.ts` exactly:
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
