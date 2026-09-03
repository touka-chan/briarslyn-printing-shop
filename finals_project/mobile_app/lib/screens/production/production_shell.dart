import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app_router.dart';
import '../../auth/auth.dart';
import '../../widgets/role_home_shell.dart';
import '../notifications/notifications_screen.dart';
import '../profile/profile_screen.dart';
import 'production_queue.dart';
import 'production_inventory.dart';
import 'production_sensor.dart';

/// The top-level shell for the Production role.
///
/// Wraps the [RoleHomeShell] with the three main bottom-nav destinations:
/// Queue, Inventory, and Sensor.
///
/// This shell enforces that the current user is a production staff. If a cashier
/// somehow lands here, they are redirected to the login screen.
class ProductionShellScreen extends StatelessWidget {
  const ProductionShellScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = AuthProvider.of(context);

    // Server-side gate: enforce that only production staff can access this shell
    if (!auth.isProduction) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) {
          auth.logout();
          Navigator.pushNamedAndRemoveUntil(
            context,
            AppRoutes.login,
            (route) => false,
          );
        }
      });
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return RoleHomeShell(
      appBarTitle: 'Production',
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