/// User roles in the PrintFlow app.
///
/// The app supports exactly two roles:
/// - [Role.cashier] — POS/Cashier: creates orders, manages payments, views customers
/// - [Role.production] — Production Staff: manages production queue, inventory, sensors
enum Role {
  /// POS / Cashier role — handles orders, payments, and customers
  cashier,

  /// Production Staff role — handles production queue, inventory, and sensors
  production,
}

extension RoleX on Role {
  /// Human-readable label for the role (used in UI).
  String get label {
    switch (this) {
      case Role.cashier:
        return 'POS / Cashier';
      case Role.production:
        return 'Production Staff';
    }
  }

  /// Short label for compact UI (e.g., chips, badges).
  String get shortLabel {
    switch (this) {
      case Role.cashier:
        return 'Cashier';
      case Role.production:
        return 'Production';
    }
  }

  /// Icon representing the role.
  String get icon {
    switch (this) {
      case Role.cashier:
        return '💳';
      case Role.production:
        return '🏭';
    }
  }

  /// Primary color associated with the role.
  int get colorValue {
    switch (this) {
      case Role.cashier:
        return 0xFF004D53; // Teal
      case Role.production:
        return 0xFF8B4513; // Saddle brown
    }
  }

  /// The default home route for this role.
  String get homeRoute {
    switch (this) {
      case Role.cashier:
        return '/cashier/home';
      case Role.production:
        return '/production/home';
    }
  }
}