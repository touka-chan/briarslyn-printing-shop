/// Mirrors the web `User` interface. Three roles only (Title 1 VI):
/// Admin/Owner, POS/Cashier, Production Staff (Firebase Auth).
///
/// Address fields mirror web/src/types/index.ts UserAddress — sourced from
/// the PSGC cascade dropdown in the Add/Edit form. All address fields are
/// optional so legacy data and the Owner row stay valid without an address.
class AppUser {
  final String id;
  final String name;
  final String email;
  final String role; // 'Admin' | 'POS_Cashier' | 'Production Staff'
  final String status; // 'active' | 'inactive'
  final String? lastLogin;
  final String? region;
  final String? province;
  final String? city;
  final String? barangay;
  final String? zip;

  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.status = 'active',
    this.lastLogin,
    this.region,
    this.province,
    this.city,
    this.barangay,
    this.zip,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as String,
        name: json['name'] as String,
        email: json['email'] as String,
        role: json['role'] as String,
        status: json['status'] as String? ?? 'active',
        lastLogin: json['lastLogin'] as String?,
        region: json['region'] as String?,
        province: json['province'] as String?,
        city: json['city'] as String?,
        barangay: json['barangay'] as String?,
        zip: json['zip'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'role': role,
        'status': status,
        'lastLogin': lastLogin,
        'region': region,
        'province': province,
        'city': city,
        'barangay': barangay,
        'zip': zip,
      };
}
