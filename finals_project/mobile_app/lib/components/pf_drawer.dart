import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../theme/app_theme.dart';
import 'pf_avatar.dart';

/// A simple app-level drawer for navigation and user account actions.
///
/// Displays a header with the user's avatar, name, email, and role chip,
/// followed by a list of navigation options and a sign-out action.
///
/// This is used in screens that don't have a bottom navigation bar (e.g.,
/// on smaller screens or as an alternative navigation pattern).
class PfDrawer extends StatelessWidget {
  const PfDrawer({
    super.key,
    required this.userName,
    required this.userEmail,
    required this.role,
    required this.onSignOut,
  });

  /// The user's display name.
  final String userName;

  /// The user's email address.
  final String userEmail;

  /// The user's role (e.g., "POS / Cashier", "Production Staff").
  final String role;

  /// Callback fired when the user taps "Sign out".
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header with user info
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.xl,
                AppSpacing.xxl,
                AppSpacing.xl,
                AppSpacing.lg,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Avatar
                  PfAvatar(
                    name: userName,
                    size: 56,
                  ),
                  const SizedBox(height: AppSpacing.md),

                  // Name
                  Text(
                    userName,
                    style: Theme.of(context).textTheme.titleLarge,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.xxs),

                  // Email
                  Text(
                    userEmail,
                    style: Theme.of(context).textTheme.bodySmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.sm),

                  // Role chip
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xxs,
                    ),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceContainer,
                      borderRadius: AppRadius.rSm,
                    ),
                    child: Text(
                      role,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppTheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const Divider(height: 1),

            const Spacer(),

            // Sign out
            ListTile(
              leading: const Icon(
                Icons.logout_rounded,
                size: AppIconSize.md,
              ),
              title: Text(
                'Sign out',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  fontWeight: FontWeight.w500,
                ),
              ),
              onTap: onSignOut,
            ),

            const SizedBox(height: AppSpacing.sm),
          ],
        ),
      ),
    );
  }
}
