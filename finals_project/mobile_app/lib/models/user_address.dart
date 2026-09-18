/// Mirrors the web `UserAddress` interface in `web/src/types/index.ts` and the
/// PSGC cascade dropdown output. All fields are optional so legacy rows
/// and the Owner row stay valid without an address.
class UserAddress {
  final String? region;
  final String? province;
  final String? city;
  final String? barangay;
  final String? zip;

  const UserAddress({
    this.region,
    this.province,
    this.city,
    this.barangay,
    this.zip,
  });

  /// Returns true when at least one address component is set.
  bool get isNotEmpty =>
      (region != null && region!.isNotEmpty) ||
      (province != null && province!.isNotEmpty) ||
      (city != null && city!.isNotEmpty) ||
      (barangay != null && barangay!.isNotEmpty) ||
      (zip != null && zip!.isNotEmpty);

  /// Composes a single-line summary, omitting empty parts. Used in the order
  /// detail card and the cashier's Schedule summary.
  String summary() {
    final parts = <String>[
      if (barangay != null && barangay!.isNotEmpty) barangay!,
      if (city != null && city!.isNotEmpty) city!,
      if (province != null && province!.isNotEmpty) province!,
      if (zip != null && zip!.isNotEmpty) zip!,
    ];
    return parts.join(', ');
  }

  factory UserAddress.fromJson(Map<String, dynamic> json) => UserAddress(
        region: json['region'] as String?,
        province: json['province'] as String?,
        city: json['city'] as String?,
        barangay: json['barangay'] as String?,
        zip: json['zip'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'region': region,
        'province': province,
        'city': city,
        'barangay': barangay,
        'zip': zip,
      };
}
