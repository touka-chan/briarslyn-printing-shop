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
        timestamp: DateTime.parse(json['timestamp'] as String),
      );
}
