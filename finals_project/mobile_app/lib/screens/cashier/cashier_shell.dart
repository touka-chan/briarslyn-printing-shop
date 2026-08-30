import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../components/components.dart';
import '../../components/logout_dialog.dart';
import '../../widgets/role_home_shell.dart';
import 'cashier_home.dart';
import 'cashier_new_order.dart';
import 'cashier_orders.dart';
import 'cashier_customers.dart';

/// The top-level shell for the Cashier / POS role.
///
/// Wraps the [RoleHomeShell] with the four main bottom-nav destinations:
/// Home, New Order, Orders, and Customers.
class CashierShellScreen extends StatelessWidget {
  const CashierShellScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return RoleHomeShell(
      appBarTitle: 'POS',
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