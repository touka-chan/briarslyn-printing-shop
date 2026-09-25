import 'package:flutter/material.dart';

import '../../app_router.dart';
import '../../auth/auth.dart';
import '../../widgets/account_menu.dart';
import '../../widgets/activity_bell.dart';
import '../../widgets/role_home_shell.dart';
import 'production_queue.dart';
import 'production_inventory.dart';
import 'production_sensor.dart';

/// The top-level shell for the Production role.
///
/// Wraps the [RoleHomeShell] with the three main bottom-nav destinations:
/// Queue, Inventory, and Sensor.
///
/// This shell enforces that the current user is a production staff. If a
/// cashier somehow lands here, they are redirected to their own home.
class ProductionShellScreen extends StatefulWidget {
  const ProductionShellScreen({super.key});

  @override
  State<ProductionShellScreen> createState() => _ProductionShellScreenState();
}

class _ProductionShellScreenState extends State<ProductionShellScreen> {
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
    final wrongRole = auth.currentUser != null && !auth.isProduction;
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
      appBarTitle: 'Production',
      appBarSubtitle: 'Brialyns Art Sign',
      initialIndex: 0,
      darkChrome: true,
      prefsKey: 'last_tab_production',
      appBarTrailing: const ActivityBellButton(),
      appBarTrailingActions: [
        // Profile, appearance and Sign out live in one dropdown so the
        // bar keeps its breathing room on narrow phones.
        AccountMenuButton(uid: auth.currentUid),
      ],
      navItems: [
        NavItem(
          label: 'Queue',
          icon: Icons.precision_manufacturing_outlined,
          iconActive: Icons.precision_manufacturing_rounded,
          screen: const ProductionQueueScreen(),
        ),
        NavItem(
          label: 'Inventory',
          icon: Icons.inventory_2_outlined,
          iconActive: Icons.inventory_2_rounded,
          screen: const ProductionInventoryScreen(),
        ),
        NavItem(
          label: 'Sensor',
          icon: Icons.sensors_outlined,
          iconActive: Icons.sensors_rounded,
          screen: const ProductionSensorScreen(),
        ),
      ],
    );
  }
}