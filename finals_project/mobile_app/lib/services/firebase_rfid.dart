// PrintFlow Mobile - Firestore service for RFID events and sensor state.
//
// The `rfid_events` collection is written by the ESP32 station directly
// (or a Cloud Function) - the mobile app only reads. The `sensors`
// collection holds the online/offline state the production staff toggle
// from the Sensor screen.
//
// Field shape (snake_case <-> Dart `RfidCheckoutEvent`):
//   material_variant_id <-> materialVariantId
//   tag_uid             <-> tagUid
//   sensor_id           <-> sensorId
//   timestamp           <-> timestamp (Timestamp)
//
// Sensor doc shape:
//   sensor_id     <-> document id
//   is_online     <-> bool
//   last_event_at <-> optional Timestamp
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

import '../models/app_user.dart';
import '../models/rfid_event.dart';
import 'audit_service.dart';
import 'live_activity_marks.dart';

const String _kRfidEventsCollection = 'rfid_events';
const String _kSensorsCollection = 'sensors';

/// Subscribes to the live `rfid_events` collection, newest first.
///
/// Emits an empty list until the first snapshot arrives. The default
/// `limit` of 50 matches the production sensor screen which only renders
/// the most-recent activity; forecasting callers pass a larger window.
Stream<List<RfidCheckoutEvent>> subscribeRfidEventsStream({int limit = 50}) {
  return FirebaseFirestore.instance
      .collection(_kRfidEventsCollection)
      .orderBy('timestamp', descending: true)
      .limit(limit)
      .snapshots()
      .map(
        (snap) => snap.docs
            .map((doc) {
              try {
                return RfidCheckoutEvent.fromJson(<String, dynamic>{
                  ...doc.data(),
                  'id': doc.id,
                });
              } catch (e) {
                // One malformed doc must not kill the whole feed.
                debugPrint('[rfid] Skipping malformed doc ${doc.id}: $e');
                return null;
              }
            })
            .whereType<RfidCheckoutEvent>()
            .toList(growable: false),
      );
}

/// Station tap mode: 'check-in' | 'stock-in' | 'stock-out'.
///
/// Decides what an ESP32 tap means once the station is online: presence
/// proof (check-in), receiving (stock-in) or manual deduction (stock-out).
/// Taps never change stock by themselves - the mode only tells the
/// station (and staff) which sheet to open for the tapped tag.
Stream<String> subscribeTapModeStream(String sensorId) {
  return FirebaseFirestore.instance
      .collection(_kSensorsCollection)
      .doc(sensorId)
      .snapshots()
      .map((snap) => (snap.data()?['tap_mode'] as String?) ?? 'check-in');
}

/// Live sensor states keyed by sensor id (online + tap mode).
///
/// Used by [LiveActivityService] to announce staff toggles made from
/// another device; the Sensor screen keeps its own per-sensor stream.
Stream<Map<String, SensorState>> subscribeSensorsStream() {
  return FirebaseFirestore.instance
      .collection(_kSensorsCollection)
      .snapshots()
      .map((snap) {
        final out = <String, SensorState>{};
        for (final doc in snap.docs) {
          final data = doc.data();
          out[doc.id] = SensorState(
            online: (data['is_online'] as bool?) ??
                (data['online'] as bool?) ??
                false,
            tapMode: (data['tap_mode'] as String?) ?? '',
          );
        }
        return out;
      });
}

/// Snapshot of one sensor doc used for change detection.
class SensorState {
  const SensorState({required this.online, required this.tapMode});

  final bool online;
  final String tapMode;
}

/// Persists the station tap mode. Merge-write: safe on first use when
/// the sensor doc does not exist yet.
Future<void> setTapMode(String sensorId, String mode,
    {AppUser? actor}) async {
  assert(
    mode == 'check-in' || mode == 'stock-in' || mode == 'stock-out',
    'Unknown tap mode: $mode',
  );
  final prev = await _readSensor(sensorId);
  await FirebaseFirestore.instance
      .collection(_kSensorsCollection)
      .doc(sensorId)
      .set(<String, dynamic>{
    'tap_mode': mode,
    'last_event_at': FieldValue.serverTimestamp(),
  }, SetOptions(merge: true));
  LiveActivityMarks.mark('sensor', sensorId);
  AuditService.log(
    actor: actor,
    action: 'sensor_toggled',
    module: 'system',
    recordId: sensorId,
    recordLabel: 'Sensor $sensorId tap mode',
    oldValue: prev?['tap_mode'] as String?,
    newValue: mode,
  );
}

/// Toggles the sensor's online state. Idempotent - safe to call from the
/// Sensor screen's play/pause button.
Future<void> setSensorOnline(String sensorId, bool online,
    {AppUser? actor}) async {
  final prev = await _readSensor(sensorId);
  await FirebaseFirestore.instance
      .collection(_kSensorsCollection)
      .doc(sensorId)
      .set(<String, dynamic>{
    'sensor_id': sensorId,
    'is_online': online,
    'last_event_at': FieldValue.serverTimestamp(),
  }, SetOptions(merge: true));
  LiveActivityMarks.mark('sensor', sensorId);
  AuditService.log(
    actor: actor,
    action: 'sensor_toggled',
    module: 'system',
    recordId: sensorId,
    recordLabel: 'Sensor $sensorId online state',
    oldValue: (prev?['is_online'] as bool?)?.toString(),
    newValue: online.toString(),
  );
}

/// Best-effort pre-read for audit old-values. Null when missing/unreadable.
Future<Map<String, dynamic>?> _readSensor(String sensorId) async {
  try {
    final snap = await FirebaseFirestore.instance
        .collection(_kSensorsCollection)
        .doc(sensorId)
        .get();
    return snap.data();
  } catch (_) {
    return null;
  }
}
