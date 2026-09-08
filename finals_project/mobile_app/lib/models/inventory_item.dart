/// Mirrors the web `InventoryItem` interface.
/// Aligned to /api/inventory/check, /api/inventory/alert,
/// /api/rfid/checkout, /api/inventory/forecast.
class InventoryItem {
  final String materialVariantId;
  final String itemType;
  final String category;
  final String? tagUid;
  final String? sensorId;
  final int currentStock;
  final int threshold;
  final int reorderPoint;
  final int forecastedDemandNext7Days;
  final String? model; // 'Holt-Winters' | 'Exponential Smoothing'
  final String status; // 'In Stock' | 'Low Stock' | 'Insufficient Stock'
  final bool isStale;
  final DateTime lastUpdated;
  final DateTime? lastCheckoutAt;

  const InventoryItem({
    required this.materialVariantId,
    required this.itemType,
    required this.category,
    this.tagUid,
    this.sensorId,
    required this.currentStock,
    required this.threshold,
    required this.reorderPoint,
    required this.forecastedDemandNext7Days,
    this.model,
    required this.status,
    this.isStale = false,
    required this.lastUpdated,
    this.lastCheckoutAt,
  });

  factory InventoryItem.fromJson(Map<String, dynamic> json) => InventoryItem(
        materialVariantId: json['material_variant_id'] as String,
        itemType: json['item_type'] as String,
        category: json['category'] as String,
        tagUid: json['tag_uid'] as String?,
        sensorId: json['sensor_id'] as String?,
        currentStock: json['current_stock'] as int,
        threshold: json['threshold'] as int,
        reorderPoint: json['reorder_point'] as int,
        forecastedDemandNext7Days: json['forecasted_demand_next_7_days'] as int,
        model: json['model'] as String?,
        status: json['status'] as String,
        isStale: json['isStale'] as bool? ?? false,
        lastUpdated: _parseInventoryDate(json['last_updated']),
        lastCheckoutAt: _parseInventoryDate(json['lastCheckoutAt']),
      );

  Map<String, dynamic> toJson() => {
        'material_variant_id': materialVariantId,
        'item_type': itemType,
        'category': category,
        'tag_uid': tagUid,
        'sensor_id': sensorId,
        'current_stock': currentStock,
        'threshold': threshold,
        'reorder_point': reorderPoint,
        'forecasted_demand_next_7_days': forecastedDemandNext7Days,
        'model': model,
        'status': status,
        'isStale': isStale,
        'last_updated': lastUpdated.toIso8601String(),
        'lastCheckoutAt': lastCheckoutAt?.toIso8601String(),
      };
}

DateTime _parseInventoryDate(dynamic raw) {
  if (raw == null) return DateTime.now();
  if (raw is DateTime) return raw;
  if (raw is String) return DateTime.parse(raw);
  try {
    return (raw as dynamic).toDate() as DateTime;
  } catch (_) {
    return DateTime.now();
  }
}
