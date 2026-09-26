// PrintFlow Mobile - audit trail writer for the `audit_logs` collection.
//
// Mirrors `web/src/lib/services/audit.ts`. Append-only: clients may create
// well-formed entries as themselves, never update/delete (firestore.rules),
// Owner-only read. Logging NEVER throws and never blocks the user action.

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

import '../models/app_user.dart';

const String _kAuditCollection = 'audit_logs';

/// Human labels for action ids (mirrors web AUDIT_ACTION_LABELS).
const Map<String, String> auditActionLabels = {
  'order_created': 'Order Created',
  'order_status_updated': 'Order Status Updated',
  'order_materials_updated': 'Order Materials Updated',
  'order_cancelled': 'Order Cancelled',
  'payment_updated': 'Payment Updated',
  'stock_in': 'Stock In',
  'stock_usage': 'Stock Usage Logged',
  'stock_deducted_auto': 'Stock Deducted (Auto)',
  'stock_adjusted': 'Stock Adjusted',
  'stock_returned': 'Stock Returned (Cancel)',
  'reorder_point_updated': 'Reorder Point Updated',
  'variant_created': 'Variant Created',
  'variant_deleted': 'Variant Deleted',
  'tag_bound': 'Tag Bound',
  'user_created': 'User Created',
  'user_role_updated': 'User Role Updated',
  'user_status_updated': 'User Status Updated',
  'user_login': 'User Login',
  'user_logout': 'User Logout',
  'sensor_toggled': 'Sensor Toggled',
  'employee_archived': 'Employee Archived',
  'employee_unarchived': 'Employee Unarchived',
  'employee_deleted': 'Employee Deleted',
};

class AuditService {
  AuditService._();

  static String? _cachedIp;
  static bool _ipResolved = false;

  /// Best-effort client IP (cached process-wide, null on failure).
  static Future<String?> resolveIp() async {
    if (_ipResolved) return _cachedIp;
    try {
      final res = await http
          .get(Uri.parse('https://api.ipify.org?format=json'))
          .timeout(const Duration(seconds: 3));
      if (res.statusCode == 200) {
        final json = jsonDecode(res.body) as Map<String, dynamic>;
        final ip = json['ip'];
        _cachedIp = ip is String ? ip : null;
      } else {
        _cachedIp = null;
      }
    } catch (_) {
      _cachedIp = null;
    }
    _ipResolved = true;
    return _cachedIp;
  }

  /// Append one audit entry. Fire-and-forget safe: returns void immediately
  /// and never throws - callers must NOT await so logging can never gate
  /// the user action. IP resolves first (cached after the first lookup);
  /// rules deny updates, so the entry is written once, complete.
  static void log({
    required AppUser? actor,
    required String action,
    required String module,
    required String recordId,
    required String recordLabel,
    dynamic oldValue,
    dynamic newValue,
  }) {
    final a = actor;
    if (a == null) return; // signed out - nothing attributable
    () async {
      try {
        final ip = await resolveIp();
        await FirebaseFirestore.instance.collection(_kAuditCollection).add({
          'actor_uid': a.id,
          'actor_email': a.email,
          'actor_name': a.name,
          'actor_role': a.role,
          'action': action,
          'module': module,
          'record_id': recordId,
          'record_label': recordLabel,
          'old_value': oldValue,
          'new_value': newValue,
          'source': 'mobile',
          'ip': ip,
          'created_at': FieldValue.serverTimestamp(),
        });
      } catch (e) {
        debugPrint('[audit] log write failed: $e');
      }
    }();
  }
}
