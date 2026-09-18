// PrintFlow Mobile - Firestore transport for `usage_events` + `bom`.
//
// Raw transport only (no permission checks - those live in
// `UsageService`). Mirrors the web `web/src/lib/services/usage.ts`
// contract: snake_case fields, Timestamps on the way out, model
// classes on the way in.
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

import '../models/bom.dart';
import '../models/usage_event.dart';

const String _kUsageCollection = 'usage_events';
const String _kBomCollection = 'bom';

/// Subscribes to the `usage_events` audit log, newest first.
///
/// Emits an empty list until the first snapshot arrives. Callers that
/// feed the forecast model pass a larger window (28+ days of history).
Stream<List<UsageEvent>> subscribeUsageEventsStream({int limit = 500}) {
  return FirebaseFirestore.instance
      .collection(_kUsageCollection)
      .orderBy('timestamp', descending: true)
      .limit(limit)
      .snapshots()
      .map(
        (snap) => snap.docs
            .map((doc) {
              try {
                return UsageEvent.fromJson(<String, dynamic>{
                  ...doc.data(),
                  'id': doc.id,
                });
              } catch (e) {
                // One malformed doc must not kill the whole log.
                debugPrint('[usage] Skipping malformed doc ${doc.id}: $e');
                return null;
              }
            })
            .whereType<UsageEvent>()
            .toList(growable: false),
      );
}

/// Reads one recipe by normalized item type. Returns null when the
/// product has no mapped BOM - or when the doc is malformed (a bad
/// recipe must skip auto-deduct, never crash order advancement).
Future<Bom?> fetchBom(String normalizedItemType) async {
  final doc = await FirebaseFirestore.instance
      .collection(_kBomCollection)
      .doc(normalizedItemType)
      .get();
  if (!doc.exists) return null;
  try {
    return Bom.fromJson(
        (<String, dynamic>{...doc.data()!, 'item_type': normalizedItemType}));
  } catch (e) {
    debugPrint('[bom] Skipping malformed doc $normalizedItemType: $e');
    return null;
  }
}
