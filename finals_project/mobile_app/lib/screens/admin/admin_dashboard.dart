import 'package:flutter/material.dart';
import '../../app_router.dart';
import '../../auth/auth.dart';
import '../../theme/app_theme.dart';

class AdminDashboard extends StatelessWidget {
  const AdminDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin / Owner'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign out',
            onPressed: () async {
              final auth = AuthProvider.of(context);
              try {
                await auth.signOut();
              } catch (_) {
                // Stay put on failure (previously the finally block
                // navigated to login even while still signed in).
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Sign out failed. Try again.'),
                    ),
                  );
                }
                return;
              }
              if (!context.mounted) return;
              // The shell gate usually navigates first once sign-out
              // completes - push only if we're not already heading there.
              if (ModalRoute.of(context)?.settings.name != AppRoutes.login) {
                Navigator.pushNamedAndRemoveUntil(
                  context,
                  AppRoutes.login,
                  (_) => false,
                );
              }
            },
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.admin_panel_settings, color: AppTheme.primary),
                        const SizedBox(width: 8),
                        const Text('Admin Mobile Preview',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'The full Admin / Owner dashboard (inventory, forecasting, analytics, user management) lives in the web application.',
                      style: TextStyle(fontSize: 12, color: AppTheme.onSurfaceVariant),
                    ),
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                              'Open the web Admin dashboard from your deployed web app URL.',
                            ),
                          ),
                        );
                      },
                      icon: const Icon(Icons.open_in_new),
                      label: const Text('Open Web Dashboard'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Quick links', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    _quickLink(context, Icons.receipt_long, 'POS / Cashier', AppRoutes.cashierHome),
                    _quickLink(context, Icons.precision_manufacturing, 'Production Queue', AppRoutes.productionHome),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _quickLink(BuildContext context, IconData icon, String label, String route) {
    return ListTile(
      leading: Icon(icon, color: AppTheme.primary),
      title: Text(label),
      trailing: const Icon(Icons.chevron_right),
      onTap: () {
        // Role-gated: an Admin session can't enter the cashier/production
        // shells, so the link explains instead of pushing a dead route.
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$label lives at $route - switch role from the login screen.'),
          ),
        );
      },
    );
  }
}
