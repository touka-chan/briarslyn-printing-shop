import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'role.dart';

/// Permissions that can be granted to roles.
///
/// These are the atomic permissions that control what actions a user can perform.
/// They are intentionally granular so we can compose role capabilities precisely.
enum Permission {
  // Order permissions
  orderCreate,           // Create new orders
  orderRead,             // View orders (list + detail)
  orderUpdatePayment,    // Update payment status (cashier)
  orderUpdateStatus,     // Advance production status (production)
  orderCancel,           // Cancel orders (before production)
  orderDelete,           // Delete orders (admin only, not used yet)

  // Customer permissions
  customerRead,          // View customer list and details
  customerCreate,        // Add new customers (from POS)
  customerUpdate,        // Edit customer info
  customerDelete,        // Delete customers (not allowed in spec)

  // Production permissions
  productionQueueRead,   // View production queue
  productionQueueAdvance, // Advance order to next production stage
  productionQueueReorder, // Reorder queue priority

  // Inventory permissions
  inventoryRead,         // View materials/inventory
  inventoryUpdate,       // Update stock levels, reorder points
  inventoryCreate,       // Add new material variants
  inventoryDelete,       // Remove material variants

  // Sensor permissions
  sensorRead,            // View sensor status
  sensorConfigure,       // Configure sensor settings
}

/// Maps roles to their permissions.
///
/// This is the single source of truth for what each role can do.
/// Think of this as the "policy" layer — the UI checks this to conditionally
/// render actions, and the service layer checks this to gate writes.
class RolePermissions {
  /// Returns true if [role] has [permission].
  static bool can(Role role, Permission permission) {
    return _rolePermissions[role]?.contains(permission) ?? false;
  }

  /// Returns all permissions for a given [role].
  static Set<Permission> permissionsFor(Role role) {
    return _rolePermissions[role] ?? <Permission>{};
  }

  /// The permission matrix.
  ///
  /// Cashier: Can create orders, read orders/customers, update payment status,
  /// and create customers. Cannot advance production status or touch inventory/sensors.
  ///
  /// Production: Can read orders, advance production status, reorder queue,
  /// read/update/create inventory, and read/configure sensors.
  static const Map<Role, Set<Permission>> _rolePermissions = {
    Role.cashier: {
      // Orders
      Permission.orderCreate,
      Permission.orderRead,
      Permission.orderUpdatePayment,
      Permission.orderCancel, // Can cancel before production starts
      // Customers
      Permission.customerRead,
      Permission.customerCreate,
      // Production (read-only)
      Permission.productionQueueRead,
    },
    Role.production: {
      // Orders
      Permission.orderRead,
      Permission.orderUpdateStatus,
      Permission.orderCancel, // Can cancel if needed
      // Production queue
      Permission.productionQueueRead,
      Permission.productionQueueAdvance,
      Permission.productionQueueReorder,
      // Inventory
      Permission.inventoryRead,
      Permission.inventoryUpdate,
      Permission.inventoryCreate,
      // Sensors
      Permission.sensorRead,
      Permission.sensorConfigure,
    },
  };
}

/// A simple authentication/session service that holds the current user's role.
///
/// This is intentionally lightweight — no backend, no tokens, no persistence.
/// It's a [ChangeNotifier] so widgets can listen for role changes (e.g., on logout/login).
///
/// In a real app, this would be replaced by a proper auth provider (Firebase Auth,
/// Supabase, custom JWT, etc.) and would include user identity, token refresh,
/// session expiry, etc. For this frontend-only stage, a simple in-memory role is sufficient.
class AuthService extends ChangeNotifier {
  Role? _currentRole;

  /// The currently logged-in role, or null if not logged in.
  Role? get currentRole => _currentRole;

  /// True if a user is currently logged in.
  bool get isLoggedIn => _currentRole != null;

  /// True if the current user is a cashier.
  bool get isCashier => _currentRole == Role.cashier;

  /// True if the current user is production staff.
  bool get isProduction => _currentRole == Role.production;

  /// Log in with the given [role].
  ///
  /// In a real app, this would validate credentials against a backend.
  /// Here we just set the role and notify listeners.
  void login(Role role) {
    _currentRole = role;
    HapticFeedback.mediumImpact();
    notifyListeners();
  }

  /// Log out the current user.
  void logout() {
    _currentRole = null;
    HapticFeedback.selectionClick();
    notifyListeners();
  }

  /// Check if the current user has [permission].
  ///
  /// Returns false if not logged in.
  bool can(Permission permission) {
    if (_currentRole == null) return false;
    return RolePermissions.can(_currentRole!, permission);
  }

  /// Assert that the current user has [permission], throwing if not.
  ///
  /// Use this in service methods to gate write operations.
  /// Throws [PermissionDeniedException] if the user lacks the permission.
  void assertCan(Permission permission) {
    if (!can(permission)) {
      throw PermissionDeniedException(
        'Permission denied: $permission required, current role: ${_currentRole?.label ?? 'none'}',
      );
    }
  }
}

/// Exception thrown when a permission check fails.
class PermissionDeniedException implements Exception {
  final String message;

  const PermissionDeniedException(this.message);

  @override
  String toString() => 'PermissionDeniedException: $message';
}

/// A widget that provides the [AuthService] to its descendants.
///
/// Wraps the app (or a subtree) and makes the auth service available via
/// `AuthProvider.of(context)`. This is the Flutter-idiomatic way to provide
/// a ChangeNotifier without using the `provider` package.
class AuthProvider extends InheritedNotifier<AuthService> {
  const AuthProvider({
    super.key,
    required AuthService authService,
    required super.child,
  }) : super(notifier: authService);

  /// Get the [AuthService] from the nearest [AuthProvider] ancestor.
  static AuthService of(BuildContext context) {
    final provider = context.dependOnInheritedWidgetOfExactType<AuthProvider>();
    if (provider == null) {
      throw StateError('No AuthProvider found in context');
    }
    return provider.notifier!;
  }
}

/// A widget that gates its child based on a permission check.
///
/// If the current user has [permission], renders [child].
/// If not, renders [fallback] (or nothing if fallback is null).
///
/// Use this for conditional UI rendering (e.g., show "Advance Status" button
/// only for production, show "Mark Paid" only for cashier).
class PermissionGate extends StatelessWidget {
  const PermissionGate({
    super.key,
    required this.permission,
    required this.child,
    this.fallback,
  });

  /// The permission required to show the child.
  final Permission permission;

  /// The widget to show if the permission is granted.
  final Widget child;

  /// Optional widget to show if the permission is denied.
  final Widget? fallback;

  @override
  Widget build(BuildContext context) {
    final auth = AuthProvider.of(context);
    if (auth.can(permission)) {
      return child;
    }
    return fallback ?? const SizedBox.shrink();
  }
}

/// A widget that gates its child based on the current role.
///
/// Renders [child] if the current user's role is in [allowedRoles].
/// Otherwise renders [fallback] (or nothing).
class RoleGate extends StatelessWidget {
  const RoleGate({
    super.key,
    required this.allowedRoles,
    required this.child,
    this.fallback,
  });

  /// The roles that are allowed to see the child.
  final List<Role> allowedRoles;

  /// The widget to show if the role matches.
  final Widget child;

  /// Optional widget to show if the role doesn't match.
  final Widget? fallback;

  @override
  Widget build(BuildContext context) {
    final auth = AuthProvider.of(context);
    if (auth.currentRole != null && allowedRoles.contains(auth.currentRole)) {
      return child;
    }
    return fallback ?? const SizedBox.shrink();
  }
}