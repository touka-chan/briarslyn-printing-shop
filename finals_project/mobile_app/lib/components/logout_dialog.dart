import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../app_router.dart';
import '../design/tokens.dart';
import '../theme/app_theme.dart';

/// Shows a SweetAlert-style logout confirmation dialog.
///
/// Returns `true` when the user confirms, `false` (or `null`) when they cancel.
/// On confirm, it pushes a replacement route back to the login screen so the
/// current role's state is cleared from the navigation stack.
Future<bool> showLogoutConfirmation(BuildContext context) async {
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
    Navigator.pushNamedAndRemoveUntil(context, AppRoutes.login, (route) => false);
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
                // Icon
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: AppTheme.statusUrgent.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.logout_rounded,
                    color: AppTheme.statusUrgent,
                    size: 32,
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                // Title
                Text(
                  'Log out?',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: AppSpacing.sm),
                // Body
                Text(
                  'You will be returned to the login screen. Any unsaved changes will be lost.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppTheme.onSurfaceVariant,
                      ),
                ),
                const SizedBox(height: AppSpacing.xl),
                // Actions
                Row(
                  children: [
                    Expanded(
                      child: _DialogButton(
                        label: 'Cancel',
                        isPrimary: false,
                        onTap: () => Navigator.of(context).pop(false),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: _DialogButton(
                        label: 'Log out',
                        isPrimary: true,
                        isDestructive: true,
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
  });

  final String label;
  final bool isPrimary;
  final bool isDestructive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bg = isPrimary
        ? (isDestructive ? AppTheme.statusUrgent : AppTheme.primary)
        : AppTheme.surface;
    final fg = isPrimary ? AppTheme.onPrimary : AppTheme.onSurface;
    final border = isPrimary
        ? null
        : Border.all(color: AppTheme.surfaceContainer, width: 1);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.rMd,
        child: AnimatedContainer(
          duration: AppMotion.fast,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: bg,
            borderRadius: AppRadius.rMd,
            border: border,
          ),
          child: Text(
            label,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 14,
              color: fg,
            ),
          ),
        ),
      ),
    );
  }
}