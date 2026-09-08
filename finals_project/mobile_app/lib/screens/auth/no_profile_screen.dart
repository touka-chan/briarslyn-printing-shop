import 'package:flutter/material.dart';

import '../../app_router.dart';
import '../../auth/auth.dart';
import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../theme/app_theme.dart';

/// Shown when a Firebase Auth user signs in but has no matching
/// `users/{uid}` profile document, or the profile has no recognised role.
///
/// The most common reason is that the account exists in Firebase Auth but
/// the admin hasn't created a profile doc for it yet. The user is asked to
/// contact an administrator and given a sign-out button.
class NoProfileScreen extends StatelessWidget {
  const NoProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = AuthProvider.of(context);
    final email = auth.currentUser?.email ?? auth.currentUser?.name ?? '';
    final role = auth.currentRole;

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: AppSpacing.xl),
                  Center(
                    child: Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: AppTheme.statusUrgent.withValues(alpha: 0.1),
                        borderRadius: AppRadius.rLg,
                      ),
                      child: const Icon(
                        Icons.person_off_rounded,
                        color: AppTheme.statusUrgent,
                        size: AppIconSize.xl,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const Text(
                    'Profile not found',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  const Text(
                    'Your account is signed in but no PrintFlow profile is linked to it. Ask an administrator to create your user record.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppTheme.onSurfaceVariant),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceContainer,
                      borderRadius: AppRadius.rMd,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _kv('Email', email.isEmpty ? '—' : email),
                        const SizedBox(height: 4),
                        _kv('Role',
                            role == null ? 'Unassigned' : role.label),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  PfButton.outlined(
                    label: 'Sign out',
                    icon: Icons.logout_rounded,
                    fullWidth: true,
                    onPressed: () async {
                      await auth.signOut();
                      if (!context.mounted) return;
                      Navigator.pushNamedAndRemoveUntil(
                        context,
                        AppRoutes.loginKey,
                        (_) => false,
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _kv(String k, String v) {
    return Row(
      children: [
        SizedBox(
          width: 64,
          child: Text(
            k,
            style: const TextStyle(
              color: AppTheme.onSurfaceVariant,
              fontSize: 13,
            ),
          ),
        ),
        Expanded(
          child: Text(
            v,
            style: const TextStyle(
              color: AppTheme.onSurface,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
