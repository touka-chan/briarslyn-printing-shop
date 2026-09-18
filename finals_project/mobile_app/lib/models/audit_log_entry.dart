/// Mirrors the web `AuditLogEntry` in `web/src/types/index.ts`.
/// Immutable trail in the `audit_logs` collection (append-only; rules deny
/// update/delete, Owner-only read).
class AuditLogEntry {
  final String? id;
  final String actorUid;
  final String actorEmail;
  final String actorName;
  final String actorRole;
  final String action;
  final String module;
  final String recordId;
  final String recordLabel;
  final dynamic oldValue;
  final dynamic newValue;
  final String source;
  final String? ip;
  final DateTime? createdAt;

  const AuditLogEntry({
    this.id,
    required this.actorUid,
    required this.actorEmail,
    required this.actorName,
    required this.actorRole,
    required this.action,
    required this.module,
    required this.recordId,
    required this.recordLabel,
    this.oldValue,
    this.newValue,
    this.source = 'mobile',
    this.ip,
    this.createdAt,
  });

  factory AuditLogEntry.fromJson(String id, Map<String, dynamic> json) =>
      AuditLogEntry(
        id: id,
        actorUid: json['actor_uid'] as String? ?? '',
        actorEmail: json['actor_email'] as String? ?? '',
        actorName: json['actor_name'] as String? ?? '',
        actorRole: json['actor_role'] as String? ?? 'unknown',
        action: json['action'] as String? ?? '',
        module: json['module'] as String? ?? '',
        recordId: json['record_id'] as String? ?? '',
        recordLabel: json['record_label'] as String? ?? '',
        oldValue: json['old_value'],
        newValue: json['new_value'],
        source: json['source'] as String? ?? 'mobile',
        ip: json['ip'] as String?,
        createdAt: _parseDate(json['created_at']),
      );
}

DateTime? _parseDate(dynamic raw) {
  if (raw == null) return null;
  if (raw is DateTime) return raw;
  if (raw is String) return DateTime.tryParse(raw);
  try {
    return (raw as dynamic).toDate() as DateTime;
  } catch (_) {
    return null;
  }
}
