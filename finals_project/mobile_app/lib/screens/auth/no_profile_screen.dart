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
class NoProfileScreen extends StatefulWidget {
  const NoProfileScreen({super.key});

  @override
  State<NoProfileScreen> createState() => _NoProfileScreenState();
}

class _NoProfileScreenState extends State<NoProfileScreen> {
  AuthService? _auth;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final auth = AuthProvider.of(context);
    if (!identical(_auth, auth)) {
      _auth?.removeListener(_maybeAdvance);
      _auth = auth;
      auth.addListener(_maybeAdvance);
      _maybeAdvance();
    }
  }

  @override
  void dispose() {
    _auth?.removeListener(_maybeAdvance);
    super.dispose();
  }

  /// Dead-end guard: if the profile lands (or gets activated) while this
  /// screen is open, move forward automatically instead of stranding the
  /// user here until a manual sign out/in cycle.
  void _maybeAdvance() {
    final auth = _auth;
    if (auth == null || !mounted) return;
    final role = auth.currentRole;
    if (auth.isLoggedIn && role != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        Navigator.pushReplacementNamed(context, role.homeRoute);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = AuthProvider.of(context);
    final email = auth.currentUser?.email ?? auth.currentUser?.name ?? '';
    final role = auth.currentRole;
    final uid = auth.currentUid ?? '';
    // A profile doc that exists but is inactive means "awaiting Owner
    // approval" - different message from a genuinely missing profile.
    final awaitingApproval = auth.currentUser != null;

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
                      child: Icon(
                        Icons.person_off_rounded,
                        color: AppTheme.statusUrgent,
                        size: AppIconSize.xl,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    awaitingApproval ? 'Awaiting approval' : 'Profile not found',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    awaitingApproval
                        ? 'Your account is signed in but an Owner has not activated it yet. Ask the Owner to approve you on the Users page, then sign in again.'
                        : 'Your account is signed in but no Brialyns Art Sign profile is linked to it. Ask an administrator to create your user record.',
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
                        _kv('Email', email.isEmpty ? '-' : email),
                        const SizedBox(height: 4),
                        _kv('Role',
                            role == null ? 'Unassigned' : role.label),
                        if (uid.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          _kv('UID', uid),
                        ],
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
                        AppRoutes.login,
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
            style: TextStyle(
              color: AppTheme.onSurfaceVariant,
              fontSize: 13,
            ),
          ),
        ),
        Expanded(
          child: Text(
            v,
            style: TextStyle(
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
