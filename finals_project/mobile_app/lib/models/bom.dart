// PrintFlow Mobile - Bill of Materials (recipe) model.
//
// Mirrors the `bom` Firestore collection: one doc per order item_type,
// keyed by the normalized item type. Each line states how much of a
// material variant a single ordered unit consumes when the order enters
// production (auto-deduct engine). Fractional quantities are allowed
// (e.g. ink per shirt); consumption is rounded UP per line so partial
// units never under-deduct.

/// Normalizes an order item_type into a `bom` doc id.
///
/// MUST match `normalizeItemType` in `web/src/lib/services/usage.ts`.
String normalizeItemType(String itemType) =>
    itemType.toLowerCase().trim().replaceAll(RegExp(r'\s+'), '_');

/// One recipe line: variant + quantity consumed per ordered unit.
class BomLine {
  final String materialVariantId;
  final double qtyPerUnit;

  const BomLine({required this.materialVariantId, required this.qtyPerUnit});

  factory BomLine.fromJson(Map<String, dynamic> json) => BomLine(
        materialVariantId: json['material_variant_id'] as String,
        qtyPerUnit: (json['qty_per_unit'] as num).toDouble(),
      );

  Map<String, dynamic> toJson() => {
        'material_variant_id': materialVariantId,
        'qty_per_unit': qtyPerUnit,
      };
}

/// A full recipe for one order item_type.
class Bom {
  final String itemType;
  final List<BomLine> lines;

  const Bom({required this.itemType, required this.lines});

  /// Whole units consumed for an order of [orderQty] units.
  /// Rounded UP per line - partial units always count as one.
  Map<String, int> consumptionFor(int orderQty) {
    final out = <String, int>{};
    for (final line in lines) {
      if (line.qtyPerUnit <= 0) continue;
      out[line.materialVariantId] =
          (out[line.materialVariantId] ?? 0) + (line.qtyPerUnit * orderQty).ceil();
    }
    return out;
  }

  factory Bom.fromJson(Map<String, dynamic> json) => Bom(
        itemType: json['item_type'] as String,
        lines: ((json['lines'] as List?) ?? const [])
            .map((e) => BomLine.fromJson((e as Map).cast<String, dynamic>()))
            .toList(growable: false),
      );

  Map<String, dynamic> toJson() => {
        'item_type': itemType,
        'lines': lines.map((l) => l.toJson()).toList(),
      };
}
