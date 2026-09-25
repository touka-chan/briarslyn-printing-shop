import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../app_router.dart';
import '../auth/auth.dart';
import '../design/tokens.dart';
import '../theme/app_theme.dart';

/// Shows a SweetAlert-style logout confirmation dialog.
///
/// Returns `true` when the user confirms, `false` (or `null`) when they cancel.
/// On confirm, it calls AuthService.logout() and pushes a replacement route
/// back to the login screen so the current role's state is cleared from the
/// navigation stack.
Future<bool> showLogoutConfirmation(BuildContext context) async {
  final auth = AuthProvider.of(context);
  final result = await showGeneralDialog<bool>(
    context: context,
    barrierLabel: 'logout-confirm',
    barrierDismissible: true,
    barrierColor: Colors.black.withValues(alpha: 0.45),
    transitionDuration: const Duration(milliseconds: 220),
    pageBuilder: (ctx, anim, sec) => const _LogoutDialog(),
    transitionBuilder: (ctx, anim, sec, child) {
      final scale = Tween<double>(begin: 0.92, end: 1.0).animate(
        CurvedAnimation(parent: anim, curve: Curves.easeOutCubic),
      );
      final fade = CurvedAnimation(parent: anim, curve: Curves.easeOut);
      return FadeTransition(
        opacity: fade,
        child: ScaleTransition(scale: scale, child: child),
      );
    },
  );

  if (result == true && context.mounted) {
    HapticFeedback.mediumImpact();
    // Await sign-out BEFORE navigating: pushing while the role shell is
    // still mounted lets its gate schedule a competing push, stacking
    // logins and replaying the transition. The gate usually navigates
    // first once sign-out completes - push only if we're not already
    // heading to login.
    await auth.logout();
    if (!context.mounted) return true;
    if (ModalRoute.of(context)?.settings.name != AppRoutes.login) {
      Navigator.pushNamedAndRemoveUntil(context, AppRoutes.login, (route) => false);
    }
  }
  return result ?? false;
}

class _LogoutDialog extends StatelessWidget {
  const _LogoutDialog();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360),
        child: Material(
          color: Colors.transparent,
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            padding: const EdgeInsets.all(AppSpacing.xl),
            decoration: BoxDecoration(
              color: AppTheme.surface,
              borderRadius: AppRadius.rLg,
              boxShadow: AppShadow.lg,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Icon with double ring
                Container(
                  width: 84,
                  height: 84,
                  decoration: BoxDecoration(
                    color: AppTheme.statusUrgent.withValues(alpha: 0.08),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Container(
                      width: 60,
                      height: 60,
                      decoration: BoxDecoration(
                        color: AppTheme.statusUrgent.withValues(alpha: 0.14),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.logout_rounded,
                        color: AppTheme.statusUrgent,
                        size: 30,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                // Title
                Text(
                  'Log out?',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.3,
                      ),
                ),
                const SizedBox(height: AppSpacing.xs),
                // Body
                Text(
                  'You will be returned to the login screen. Any unsaved changes will be lost.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppTheme.onSurfaceVariant,
                        height: 1.45,
                      ),
                ),
                const SizedBox(height: AppSpacing.xl),
                // Actions - destructive confirm first in reading order
                Row(
                  children: [
                    Expanded(
                      child: _DialogButton(
                        label: 'Cancel',
                        isPrimary: false,
                        onTap: () => Navigator.of(context).pop(false),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      flex: 2,
                      child: _DialogButton(
                        label: 'Log out',
                        isPrimary: true,
                        isDestructive: true,
                        icon: Icons.logout_rounded,
                        onTap: () => Navigator.of(context).pop(true),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DialogButton extends StatelessWidget {
  const _DialogButton({
    required this.label,
    required this.isPrimary,
    required this.onTap,
    this.isDestructive = false,
    this.icon,
  });

  final String label;
  final bool isPrimary;
  final bool isDestructive;
  final IconData? icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bg = isPrimary
        ? (isDestructive ? AppTheme.statusUrgent : AppTheme.primary)
        : AppTheme.surfaceContainerLow;
    final fg = isPrimary ? AppTheme.onPrimary : AppTheme.onSurface;
    final border = isPrimary
        ? null
        : Border.all(
            color: Theme.of(context).colorScheme.outlineVariant,
            width: 1.2,
          );

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        borderRadius: AppRadius.rLg,
        child: AnimatedContainer(
          duration: AppMotion.fast,
          height: 50,
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: AppRadius.rLg,
            border: border,
            boxShadow: isPrimary
                ? [
                    BoxShadow(
                      color: (isDestructive
                              ? AppTheme.statusUrgent
                              : AppTheme.primary)
                          .withValues(alpha: 0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18, color: fg),
                const SizedBox(width: AppSpacing.xs),
              ],
              Flexible(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: AppTypography.bodyMd,
                    color: fg,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}