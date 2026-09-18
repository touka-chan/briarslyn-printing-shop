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
class AdminShellScreen extends StatefulWidget {
  const AdminShellScreen({super.key});

  @override
  State<AdminShellScreen> createState() => _AdminShellScreenState();
}

class _AdminShellScreenState extends State<AdminShellScreen> {
  /// Fires at most once per shell instance. Without this, every rebuild
  /// while signed out schedules another post-frame push (each one calling
  /// logout again, which notifies again) and the login screen stacks /
  /// replays its transition nonstop.
  bool _redirectScheduled = false;

  @override
  Widget build(BuildContext context) {
    final auth = AuthProvider.of(context);

    // Mismatched role - bounce to the session's own home (or login when
    // signed out). Should not happen in practice because login routes to
    // the role's homeRoute, but guards against deep links. Only acts on
    // definitive states so a transient null profile never bounces a
    // signed-in user, and never mutates auth - navigation only.
    final signedOut = auth.currentUid == null;
    final wrongRole = auth.currentUser != null && !auth.isAdminOrOwner;
    if ((signedOut || wrongRole) && !_redirectScheduled) {
      _redirectScheduled = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
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
