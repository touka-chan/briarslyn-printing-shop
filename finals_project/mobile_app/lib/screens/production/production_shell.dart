import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../components/components.dart';
import '../../components/logout_dialog.dart';
import '../../widgets/role_home_shell.dart';
import 'production_queue.dart';
import 'production_inventory.dart';
import 'production_sensor.dart';

/// The top-level shell for the Production role.
///
/// Wraps the [RoleHomeShell] with the three main bottom-nav destinations:
/// Queue, Inventory, and Sensor.
class ProductionShellScreen extends StatelessWidget {
  const ProductionShellScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return RoleHomeShell(
      appBarTitle: 'Production',
      appBarSubtitle: 'Brialyns Art Sign',
      initialIndex: 0,
      appBarTrailing: IconButton(
        icon: const Icon(Icons.notifications_outlined),
        onPressed: () {
          HapticFeedback.selectionClick();
          // TODO: navigate to notifications
        },
        tooltip: 'Notifications',
      ),
      appBarTrailingActions: [
        IconButton(
          icon: const Icon(Icons.logout_rounded),
          onPressed: () {
            HapticFeedback.mediumImpact();
            showLogoutConfirmation(context);
          },
          tooltip: 'Log out',
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