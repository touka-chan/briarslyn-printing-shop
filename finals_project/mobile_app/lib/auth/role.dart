/// User roles in the PrintFlow app.
///
/// Server-side (Firestore `users/{uid}.role`) carries one of the four
/// Title 1 strings: `"Owner"`, `"Admin"`, `"POS_Cashier"`, or
/// `"Production Staff"`. The mobile `Role` enum mirrors the four - the
/// in-app UI uses the enum exclusively; the conversion happens in
/// `AuthService._roleFromServer`.
enum Role {
  /// Owner - full access (admin dashboard, all pages)
  owner,

  /// Admin - admin dashboard access
  admin,

  /// POS / Cashier role - handles orders, payments, and customers
  cashier,

  /// Production Staff role - handles production queue, inventory, and sensors
  production,
}

extension RoleX on Role {
  /// Human-readable label for the role (used in UI).
  String get label {
    switch (this) {
      case Role.owner:
        return 'Owner';
      case Role.admin:
        return 'Admin';
      case Role.cashier:
        return 'POS / Cashier';
      case Role.production:
        return 'Production Staff';
    }
  }

  /// Short label for compact UI (e.g., chips, badges).
  String get shortLabel {
    switch (this) {
      case Role.owner:
        return 'Owner';
      case Role.admin:
        return 'Admin';
      case Role.cashier:
        return 'Cashier';
      case Role.production:
        return 'Production';
    }
  }

  /// Primary color associated with the role.
  int get colorValue {
    switch (this) {
      case Role.owner:
        return 0xFF5B1F8C; // Royal purple
      case Role.admin:
        return 0xFF00479B; // Blue
      case Role.cashier:
        return 0xFF004D53; // Teal
      case Role.production:
        return 0xFF8B4513; // Saddle brown
    }
  }

  /// The default home route for this role.
  String get homeRoute {
    switch (this) {
      case Role.owner:
      case Role.admin:
        return '/admin/home';
      case Role.cashier:
        return '/cashier/home';
      case Role.production:
        return '/production/home';
    }
  }
}
