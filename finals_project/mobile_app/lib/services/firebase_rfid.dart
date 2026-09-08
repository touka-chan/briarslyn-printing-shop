// PrintFlow Mobile — Firestore service for RFID events and sensor state.
//
// The `rfid_events` collection is written by the ESP32 station directly
// (or a Cloud Function) — the mobile app only reads. The `sensors`
// collection holds the online/offline state the production staff toggle
// from the Sensor screen.
//
// Field shape (snake_case ↔ Dart `RfidCheckoutEvent`):
//   material_variant_id ↔ materialVariantId
//   tag_uid             ↔ tagUid
//   sensor_id           ↔ sensorId
//   timestamp           ↔ timestamp (Timestamp)
//
// Sensor doc shape:
//   sensor_id     ↔ document id
//   is_online     ↔ bool
//   last_event_at ↔ optional Timestamp
import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/rfid_event.dart';

const String _kRfidEventsCollection = 'rfid_events';
const String _kSensorsCollection = 'sensors';

/// Subscribes to the live `rfid_events` collection, newest first.
///
/// Emits an empty list until the first snapshot arrives. The `limit(50)`
/// cap matches the production sensor screen which only renders the
/// most-recent activity.
Stream<List<RfidCheckoutEvent>> subscribeRfidEventsStream() {
  return FirebaseFirestore.instance
      .collection(_kRfidEventsCollection)
      .orderBy('timestamp', descending: true)
      .limit(50)
      .snapshots()
      .map(
        (snap) => snap.docs
            .map((doc) => RfidCheckoutEvent.fromJson(<String, dynamic>{
                  ...doc.data(),
                  'id': doc.id,
                }))
            .toList(growable: false),
      );
}

/// Toggles the sensor's online state. Idempotent — safe to call from the
/// Sensor screen's play/pause button.
Future<void> setSensorOnline(String sensorId, bool online) async {
  await FirebaseFirestore.instance
      .collection(_kSensorsCollection)
      .doc(sensorId)
      .set(<String, dynamic>{
    'sensor_id': sensorId,
    'is_online': online,
    'last_event_at': FieldValue.serverTimestamp(),
  }, SetOptions(merge: true));
}
