import 'package:flutter/material.dart';

import '../../app_router.dart';
import '../../auth/auth.dart';
import '../../widgets/role_home_shell.dart';
import '../profile/profile_screen.dart';
import 'admin_dashboard.dart';

/// The top-level shell for Owner / Admin users on the mobile app.
///
/// The full admin experience (inventory, forecasting, analytics, user
/// management) lives in the web app. On mobile we show a single
/// [AdminDashboard] panel plus a profile tab, behind the standard
/// [RoleHomeShell] chrome.
class AdminShellScreen extends StatelessWidget {
  const AdminShellScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = AuthProvider.of(context);

    if (!auth.isAdminOrOwner) {
      // Mismatched role — bounce back to login. Should not happen in
      // practice because login routes to the role's homeRoute, but guards
      // against deep links.
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
      appBarTitle: auth.currentRole == Role.owner ? 'Owner' : 'Admin',
      appBarSubtitle: 'Brialyns Art Sign',
      initialIndex: 0,
      navItems: [
        NavItem(
          label: 'Dashboard',
          icon: Icons.dashboard_outlined,
          iconActive: Icons.dashboard_rounded,
          screen: const AdminDashboard(),
        ),
        NavItem(
          label: 'Profile',
          icon: Icons.person_outline_rounded,
          iconActive: Icons.person_rounded,
          screen: const ProfileScreen(),
        ),
      ],
    );
  }
}
