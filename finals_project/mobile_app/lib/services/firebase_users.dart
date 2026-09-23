// PrintFlow Mobile - Firestore service for the `users` collection.
//
// Mirrors the web `web/src/lib/services/users.ts` contract. The mobile
// `AuthService` (see `auth_service.dart`) does its own single-doc
// subscription on `users/{uid}` for the signed-in user, so this file is
// a defensive read-only helper used by future screens that need the full
// roster (e.g., a future "team" tab). It is exported from the services
// barrel so any screen can `import '../../services/services.dart'` and
// pick it up.
//
// Field shape (snake_case <-> Dart `AppUser`):
//   email       <-> AppUser.email
//   name        <-> AppUser.name
//   role        <-> AppUser.role   ('Owner' | 'Admin' | 'POS_Cashier' | 'Production Staff')
//   status      <-> AppUser.status ('active' | 'inactive')
//   region      <-> AppUser.region
//   province    <-> AppUser.province
//   city        <-> AppUser.city
//   barangay    <-> AppUser.barangay
//   zip         <-> AppUser.zip
//   last_login_at <-> AppUser.lastLogin (ISO string after format)
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

import '../models/app_user.dart';

const String _kUsersCollection = 'users';

/// Normalises a Firestore `users/{uid}` doc to match the keys
/// `AppUser.fromJson` expects.
///
/// The web `web/src/lib/services/users.ts` writes the address as a
/// nested `address` sub-object (`{ region, province, city, barangay,
/// zip }`) and the last-login timestamp as a `Timestamp` under
/// `last_login_at`. The mobile `AppUser` model reads the address
/// fields at the top level and the last-login as an ISO string under
/// `lastLogin`. This helper performs the field-level translation so
/// both the collection subscription and the single-user auth bootstrap
/// see the same shape.
///
/// Mutates the input map in place and returns it for chaining.
Map<String, dynamic> normaliseUserDoc(Map<String, dynamic> raw) {
  // Flatten nested `address` to top-level fields.
  final nested = raw['address'];
  if (nested is Map) {
    for (final key in const [
      'region',
      'province',
      'city',
      'barangay',
      'zip',
    ]) {
      if (raw[key] == null && nested[key] != null) {
        raw[key] = nested[key];
      }
    }
  }
  // Translate `last_login_at` (Timestamp) to `lastLogin` (ISO string).
  if (raw['last_login_at'] != null && raw['lastLogin'] == null) {
    final v = raw['last_login_at'];
    if (v is Timestamp) {
      raw['lastLogin'] = v.toDate().toIso8601String();
    } else if (v is String) {
      raw['lastLogin'] = v;
    }
  }
  return raw;
}

/// Finds a sign-in account uid by email (forgot-password existence
/// check). Returns null when no account uses that address.
Future<String?> findUserByEmail(String email) async {
  try {
    final snap = await FirebaseFirestore.instance
        .collection(_kUsersCollection)
        .where('email', isEqualTo: email)
        .limit(1)
        .get();
    return snap.docs.isEmpty ? null : snap.docs.first.id;
  } catch (_) {
    return null;
  }
}

/// Result of an email lookup: the account uid, stored display name and
/// role (`Owner` | `Admin` | `POS_Cashier` | `Production Staff`).
class UserEmailMatch {
  const UserEmailMatch({
    required this.uid,
    required this.name,
    required this.role,
  });

  final String uid;
  final String name;
  final String role;
}

/// Same lookup as [findUserByEmail], but also returns the account's
/// display name and role. Used by the forgot-password flow: the name
/// personalises the branded reset email, and the role keeps the reset
/// flow on the app for Cashier/Production accounts only (Owner/Admin
/// accounts reset on the web panel).
Future<UserEmailMatch?> findUserByEmailAndName(String email) async {
  try {
    final snap = await FirebaseFirestore.instance
        .collection(_kUsersCollection)
        .where('email', isEqualTo: email)
        .limit(1)
        .get();
    if (snap.docs.isEmpty) return null;
    final data = snap.docs.first.data();
    return UserEmailMatch(
      uid: snap.docs.first.id,
      name: (data['name'] as String? ?? '').trim(),
      role: data['role'] as String? ?? 'POS_Cashier',
    );
  } catch (_) {
    return null;
  }
}

/// Subscribes to the live `users` collection.
///
/// Emits an empty list until the first snapshot arrives. Note: the
/// Owner row is included - callers that want to filter the Owner out
/// (e.g., the employees roster on the web admin) should drop
/// `role == 'Owner'` themselves.
Stream<List<AppUser>> subscribeUsersStream() {
  return FirebaseFirestore.instance
      .collection(_kUsersCollection)
      .snapshots()
      .map(
        (snap) => snap.docs
            .map(
              (doc) {
                try {
                  return AppUser.fromJson(<String, dynamic>{
                    ...normaliseUserDoc(doc.data()),
                    'id': doc.id,
                  });
                } catch (e) {
                  // One malformed doc must not kill the whole roster.
                  debugPrint('[users] Skipping malformed doc ${doc.id}: $e');
                  return null;
                }
              },
            )
            .whereType<AppUser>()
            .toList(growable: false),
      );
}
