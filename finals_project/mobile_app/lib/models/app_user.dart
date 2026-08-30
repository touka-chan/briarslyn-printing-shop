/// Mirrors the web `User` interface. Three roles only (Title 1 VI):
/// Admin/Owner, POS/Cashier, Production Staff (Firebase Auth).
class AppUser {
  final String id;
  final String name;
  final String email;
  final String role; // 'Admin' | 'POS_Cashier' | 'Production Staff'
  final String status; // 'active' | 'inactive'
  final String? lastLogin;

  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.status = 'active',
    this.lastLogin,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as String,
        name: json['name'] as String,
        email: json['email'] as String,
        role: json['role'] as String,
        status: json['status'] as String? ?? 'active',
        lastLogin: json['lastLogin'] as String?,
      );
}
