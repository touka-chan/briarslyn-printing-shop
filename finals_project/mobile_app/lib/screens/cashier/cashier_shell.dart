import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app_router.dart';
import '../../auth/auth.dart';
import '../../widgets/role_home_shell.dart';
import '../notifications/notifications_screen.dart';
import '../profile/profile_screen.dart';
import 'cashier_home.dart';
import 'cashier_new_order.dart';
import 'cashier_orders.dart';
import 'cashier_customers.dart';

/// The top-level shell for the Cashier / POS role.
///
/// Wraps the [RoleHomeShell] with the four main bottom-nav destinations:
/// Home, New Order, Orders, and Customers.
///
/// This shell enforces that the current user is a cashier. If a production
/// user somehow lands here, they are redirected to their own home.
class CashierShellScreen extends StatefulWidget {
  const CashierShellScreen({super.key});

  @override
  State<CashierShellScreen> createState() => _CashierShellScreenState();
}

class _CashierShellScreenState extends State<CashierShellScreen> {
  /// Fires at most once per shell instance. Without this, every rebuild
  /// while signed out schedules another post-frame push (each one calling
  /// logout again, which notifies again) and the login screen stacks /
  /// replays its transition nonstop.
  bool _redirectScheduled = false;

  @override
  Widget build(BuildContext context) {
    final auth = AuthProvider.of(context);

    // Gate only on definitive states. A transient null profile (offline
    // blip while the Firebase session is alive) shows a spinner instead
    // of bouncing a signed-in user to login. The gate never mutates auth
    // (no logout() here) - navigation only.
    final signedOut = auth.currentUid == null;
    final wrongRole = auth.currentUser != null && !auth.isCashier;
    if ((signedOut || wrongRole) && !_redirectScheduled) {
      _redirectScheduled = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        // A wrong-role session belongs on its own home, not login
        // (login has no auto-advance for signed-in users).
        final target = wrongRole && auth.currentRole != null
            ? auth.currentRole!.homeRoute
            : AppRoutes.login;
        if (ModalRoute.of(context)?.settings.name == target) return;
        Navigator.pushNamedAndRemoveUntil(
          context,
          target,
          (route) => false,
        );
      });
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return RoleHomeShell(
      appBarTitle: 'POS',
      appBarSubtitle: 'Brialyns Art Sign',
      initialIndex: 0,
      appBarTrailing: IconButton(
        icon: const Icon(Icons.notifications_outlined),
        onPressed: () {
          HapticFeedback.selectionClick();
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const NotificationsScreen()),
          );
        },
        tooltip: 'Notifications',
      ),
      appBarTrailingActions: [
        IconButton(
          icon: const Icon(Icons.account_circle_outlined),
          onPressed: () {
            HapticFeedback.selectionClick();
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ProfileScreen()),
            );
          },
          tooltip: 'Profile',
        ),
      ],
      navItems: [
        NavItem(
          label: 'Home',
          icon: Icons.home_outlined,
          iconActive: Icons.home_rounded,
          screen: const CashierHomeScreen(),
        ),
        NavItem(
          label: 'New Order',
          icon: Icons.add_circle_outline,
          iconActive: Icons.add_circle_rounded,
          screen: const CashierNewOrderScreen(),
        ),
        NavItem(
          label: 'Orders',
          icon: Icons.list_alt_outlined,
          iconActive: Icons.list_alt_rounded,
          screen: const CashierOrdersScreen(),
        ),
        NavItem(
          label: 'Customers',
          icon: Icons.people_outline,
          iconActive: Icons.people_rounded,
          screen: const CashierCustomersScreen(),
        ),
      ],
    );
  }
}