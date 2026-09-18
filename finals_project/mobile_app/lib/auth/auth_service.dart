import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/app_user.dart';
import '../services/audit_service.dart';
import '../services/firebase_users.dart' as fb_users;
import 'role.dart';

/// Permissions that can be granted to roles.
///
/// Atomic permissions controlling what actions a user can perform.
/// Composed into role capabilities via [RolePermissions].
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
/// Single source of truth for what each role can do. UI checks this to
/// conditionally render actions; service layer checks it to gate writes.
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
  ///
  /// Admin/Owner: All permissions.
  static const Map<Role, Set<Permission>> _rolePermissions = {
    Role.owner: {
      Permission.orderCreate,
      Permission.orderRead,
      Permission.orderUpdatePayment,
      Permission.orderUpdateStatus,
      Permission.orderCancel,
      Permission.orderDelete,
      Permission.customerRead,
      Permission.customerCreate,
      Permission.customerUpdate,
      Permission.customerDelete,
      Permission.productionQueueRead,
      Permission.productionQueueAdvance,
      Permission.productionQueueReorder,
      Permission.inventoryRead,
      Permission.inventoryUpdate,
      Permission.inventoryCreate,
      Permission.inventoryDelete,
      Permission.sensorRead,
      Permission.sensorConfigure,
    },
    Role.admin: {
      Permission.orderCreate,
      Permission.orderRead,
      Permission.orderUpdatePayment,
      Permission.orderUpdateStatus,
      Permission.orderCancel,
      Permission.orderDelete,
      Permission.customerRead,
      Permission.customerCreate,
      Permission.customerUpdate,
      Permission.customerDelete,
      Permission.productionQueueRead,
      Permission.productionQueueAdvance,
      Permission.productionQueueReorder,
      Permission.inventoryRead,
      Permission.inventoryUpdate,
      Permission.inventoryCreate,
      Permission.inventoryDelete,
      Permission.sensorRead,
      Permission.sensorConfigure,
    },
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

/// FirebaseAuth-backed authentication/session service.
///
/// Public API (preserved from the in-memory version):
///   - `currentRole`         (Role? - null when signed out or no profile)
///   - `isLoggedIn`          (true iff Firebase user is signed in AND the
///                            Firestore `users/{uid}` doc exists with
///                            `status: 'active'`)
///   - `isCashier`           (current role == cashier)
///   - `isProduction`        (current role == production)
///   - `isAdminOrOwner`      (current role in {admin, owner})
///   - `signIn(email, pwd)`  (replaces `login(Role)`)
///   - `signOut()`           (replaces `logout()`)
///   - `can(Permission)`, `assertCan(Permission)`
class AuthService extends ChangeNotifier {
  final fb.FirebaseAuth _auth = fb.FirebaseAuth.instance;
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  fb.User? _user;
  AppUser? _profile;
  StreamSubscription<fb.User?>? _authSub;
  StreamSubscription<DocumentSnapshot>? _profileSub;

  /// The currently logged-in user, or null if not signed in.
  AppUser? get currentUser => _profile;

  /// Firebase Auth uid even when no profile doc exists (shown on the
  /// blocked screens so the Owner can identify the account in-app).
  String? get currentUid => _user?.uid;

  /// The currently logged-in role, or null if not signed in.
  Role? get currentRole {
    final role = _profile?.role;
    if (role == null) return null;
    return _roleFromServer(role);
  }

  /// True if a user is currently signed in with an active profile.
  bool get isLoggedIn => _user != null && _profile?.status == 'active';

  /// True if the current user is a cashier.
  bool get isCashier => currentRole == Role.cashier;

  /// True if the current user is production staff.
  bool get isProduction => currentRole == Role.production;

  /// True if the current user is an admin or owner.
  bool get isAdminOrOwner => currentRole == Role.admin || currentRole == Role.owner;

  /// Map Title 1 server role strings to the mobile `Role` enum.
  /// Web/admin writes one of four strings; the mobile app consumes them.
  static Role? _roleFromServer(String serverRole) {
    switch (serverRole) {
      case 'Owner':
        return Role.owner;
      case 'Admin':
        return Role.admin;
      case 'POS_Cashier':
        return Role.cashier;
      case 'Production Staff':
        return Role.production;
      default:
        return null;
    }
  }

  /// Bootstrap auth state at app launch. Should be called from `main()` before
  /// `runApp`. Subscribes to Firebase auth state changes and resolves the
  /// `users/{uid}` profile on sign-in.
  Future<void> bootstrap() async {
    _authSub = _auth.authStateChanges().listen((user) async {
      _user = user;
      _profileSub?.cancel();
      if (user == null) {
        _profile = null;
        notifyListeners();
        return;
      }
      _profileSub = _db.collection('users').doc(user.uid).snapshots().listen((doc) async {
        if (!doc.exists) {
          // Self-healing onboarding: console-created or orphaned Auth
          // accounts get a minimal ACTIVE profile so sign-in just
          // works - no console UID hunting. Safe because Auth accounts
          // only exist when an admin creates them (no public sign-up);
          // the Owner can still deactivate anyone from the Users page.
          // Rules allow self-create of your own doc. Falls back to
          // null (existing "profile not found" behavior) on failure.
          try {
            final email = user.email ?? '';
            final prefix = email.contains('@') ? email.split('@').first : '';
            await _db.collection('users').doc(user.uid).set({
              'email': email,
              'name': (user.displayName?.trim().isNotEmpty ?? false)
                  ? user.displayName!.trim()
                  : (prefix.isNotEmpty ? prefix : 'Staff'),
              'role': 'POS_Cashier',
              'status': 'active',
              'created_at': FieldValue.serverTimestamp(),
              'updated_at': FieldValue.serverTimestamp(),
              'last_login_at': null,
            });
          } catch (_) {
            _profile = null;
            notifyListeners();
          }
          return;
        }
        final data = doc.data() as Map<String, dynamic>;
        data['id'] = doc.id;
        // Flatten the web's nested `address` sub-object and translate
        // `last_login_at` (Timestamp) to `lastLogin` (ISO string) so
        // the mobile `AppUser.fromJson` can parse the doc the same
        // way it does in `subscribeUsersStream`.
        fb_users.normaliseUserDoc(data);
        try {
          _profile = AppUser.fromJson(data);
        } catch (e) {
          // A malformed profile must not crash auth - treat as missing.
          debugPrint('[auth] Skipping malformed profile ${doc.id}: $e');
          _profile = null;
        }
        notifyListeners();
      }, onError: (_) {
        _profile = null;
        notifyListeners();
      });
    });
  }

  /// Sign in with email + password.
  /// Throws [fb.FirebaseAuthException] on failure.
  Future<void> signIn(String email, String password) async {
    HapticFeedback.mediumImpact();
    await _auth.signInWithEmailAndPassword(email: email, password: password);
    // Audit in the background: the profile snapshot trails sign-in by a
    // moment, so wait briefly (bounded) to attribute the role correctly.
    // Never blocks, never throws.
    () async {
      try {
        for (var i = 0; i < 20 && _profile == null; i++) {
          await Future.delayed(const Duration(milliseconds: 100));
        }
        AuditService.log(
          actor: _profile ??
              AppUser(
                id: _user?.uid ?? '',
                name: '',
                email: email,
                role: 'unknown',
              ),
          action: 'user_login',
          module: 'auth',
          recordId: _user?.uid ?? email,
          recordLabel: 'Login $email',
          newValue: 'signed in',
        );
      } catch (_) {}
    }();
  }

  /// Send a password reset email. The link opens the shared web
  /// reset page (works for mobile users too — tap in Gmail, set the
  /// new password in the browser, sign back in on the app).
  static const String passwordResetUrl =
      'https://brialyns-art-sign-services.web.app/reset-password';

  Future<void> sendPasswordResetEmail(String email) async {
    await _auth.sendPasswordResetEmail(
      email: email,
      actionCodeSettings: fb.ActionCodeSettings(
        url: passwordResetUrl,
        handleCodeInApp: false,
      ),
    );
  }

  /// Sign out and clear profile.
  Future<void> signOut() async {
    HapticFeedback.selectionClick();
    // Log BEFORE signing out - afterwards there is no user to attribute.
    final who = _profile;
    if (who != null) {
      AuditService.log(
        actor: who,
        action: 'user_logout',
        module: 'auth',
        recordId: who.id,
        recordLabel: 'Logout ${who.email}',
        oldValue: 'signed in',
      );
    }
    await _auth.signOut();
  }

  /// Backwards-compatible alias for [signOut]. Pre-FirebaseAuth shells and
  /// the logout dialog call `auth.logout()`; this keeps the public surface
  /// intact without forcing every consumer to rename.
  Future<void> logout() => signOut();

  /// Check if the current user has [permission].
  /// Returns false if not signed in.
  bool can(Permission permission) {
    final role = currentRole;
    if (role == null) return false;
    return RolePermissions.can(role, permission);
  }

  /// Assert that the current user has [permission], throwing if not.
  /// Throws [PermissionDeniedException] if the user lacks the permission.
  void assertCan(Permission permission) {
    if (!can(permission)) {
      throw PermissionDeniedException(
        'Permission denied: $permission required, current role: ${currentRole?.label ?? 'none'}',
      );
    }
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _profileSub?.cancel();
    super.dispose();
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
class PermissionGate extends StatelessWidget {
  const PermissionGate({
    super.key,
    required this.permission,
    required this.child,
    this.fallback,
  });

  final Permission permission;
  final Widget child;
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
class RoleGate extends StatelessWidget {
  const RoleGate({
    super.key,
    required this.allowedRoles,
    required this.child,
    this.fallback,
  });

  final List<Role> allowedRoles;
  final Widget child;
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
