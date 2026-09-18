// PrintFlow Mobile - usage_events model (immutable audit log).
//
// EVERY stock movement writes exactly one entry here: auto-deducts
// (confirmed orders), manual logs (wastage/sample/correction) and
// station entries (stock-in taps, check-ins). Because auto-deduct is
// locked to its order id and manual/scan entries are standalone, the
// three sources can never double-count each other.
class UsageEvent {
  final String materialVariantId;
  final int qty;

  /// 'in' (stock received) or 'out' (stock consumed).
  final String direction;

  /// 'auto-deduct' | 'manual' | 'rfid'.
  final String source;

  /// Set for auto-deducts and order-linked manual logs, else null.
  final String? orderId;

  /// Free-text reason for manual entries (wastage, sample, ...).
  final String? reason;

  final String? byUid;
  final DateTime timestamp;

  /// True when consumption drove stock to zero (partial fulfillment).
  /// Mirrors the web contract, which persists and reads this flag.
  final bool shortfall;

  const UsageEvent({
    required this.materialVariantId,
    required this.qty,
    required this.direction,
    required this.source,
    this.orderId,
    this.reason,
    this.byUid,
    required this.timestamp,
    this.shortfall = false,
  });

  factory UsageEvent.fromJson(Map<String, dynamic> json) => UsageEvent(
        materialVariantId: json['material_variant_id'] as String,
        qty: (json['qty'] as num).toInt(),
        direction: json['direction'] as String,
        source: json['source'] as String,
        orderId: json['order_id'] as String?,
        reason: json['reason'] as String?,
        byUid: json['by_uid'] as String?,
        timestamp: _parseDate(json['timestamp']),
        shortfall: json['shortfall'] as bool? ?? false,
      );

  Map<String, dynamic> toJson() => {
        'material_variant_id': materialVariantId,
        'qty': qty,
        'direction': direction,
        'source': source,
        'order_id': orderId,
        'reason': reason,
        'by_uid': byUid,
        'timestamp': timestamp.toIso8601String(),
        'shortfall': shortfall,
      };
}

DateTime _parseDate(dynamic raw) {
  if (raw == null) return DateTime.now();
  if (raw is DateTime) return raw;
  if (raw is String) return DateTime.parse(raw);
  try {
    return (raw as dynamic).toDate() as DateTime;
  } catch (_) {
    return DateTime.now();
  }
}
