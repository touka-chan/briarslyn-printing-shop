/// Mirrors `RfidCheckoutEvent` from the web. Aligned to /api/rfid/checkout.
class RfidCheckoutEvent {
  final String materialVariantId;
  final String tagUid;
  final String sensorId;
  final DateTime timestamp;

  const RfidCheckoutEvent({
    required this.materialVariantId,
    required this.tagUid,
    required this.sensorId,
    required this.timestamp,
  });

  factory RfidCheckoutEvent.fromJson(Map<String, dynamic> json) =>
      RfidCheckoutEvent(
        materialVariantId: json['material_variant_id'] as String,
        tagUid: json['tag_uid'] as String,
        sensorId: json['sensor_id'] as String,
        timestamp: _parseRfidDate(json['timestamp']),
      );
}

DateTime _parseRfidDate(dynamic raw) {
  if (raw == null) return DateTime.now();
  if (raw is DateTime) return raw;
  if (raw is String) return DateTime.parse(raw);
  try {
    return (raw as dynamic).toDate() as DateTime;
  } catch (_) {
    return DateTime.now();
  }
}
