import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../auth/auth.dart';
import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../theme/app_theme.dart';
import '../../utils/animations.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = AuthProvider.of(context);
    final role = auth.currentRole;
    final isCashier = auth.isCashier;

    final name = isCashier ? 'Maria Santos' : 'Production 01';
    final email = isCashier ? 'maria@brialyns.com' : 'prod01@brialyns.com';
    final initials = isCashier ? 'MS' : 'P1';
    final roleLabel = role?.label ?? 'Guest';
    final lastLogin = isCashier ? '2026-08-20 07:45' : '2026-08-20 08:00';

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Profile'),
        backgroundColor: AppTheme.surface,
        foregroundColor: AppTheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 1,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.md,
            AppSpacing.lg,
            AppSpacing.xxl,
          ),
          children: [
            _ProfileHeader(
              name: name,
              email: email,
              initials: initials,
              roleLabel: roleLabel,
              lastLogin: lastLogin,
            ),
            const SizedBox(height: AppSpacing.lg),
            _SectionTitle(title: 'Preferences'),
            const SizedBox(height: AppSpacing.sm),
            const _SettingsRow(
              icon: Icons.palette_outlined,
              title: 'Appearance',
              subtitle: 'Light mode',
            ),
            _SettingsRow(
              icon: Icons.notifications_outlined,
              title: 'Notifications',
              subtitle: 'Overdue orders, low stock, sensor alerts',
              trailing: Switch(
                value: true,
                onChanged: (_) {},
                activeThumbColor: AppTheme.primary,
              ),
            ),
            _SettingsRow(
              icon: Icons.vibration_rounded,
              title: 'Haptic feedback',
              subtitle: 'Tactile responses on actions',
              trailing: Switch(
                value: true,
                onChanged: (_) {},
                activeThumbColor: AppTheme.primary,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _SectionTitle(title: 'Account'),
            const SizedBox(height: AppSpacing.sm),
            const _SettingsRow(
              icon: Icons.person_outline_rounded,
              title: 'Edit profile',
              subtitle: 'Name, contact details',
            ),
            const _SettingsRow(
              icon: Icons.lock_outline_rounded,
              title: 'Change password',
              subtitle: 'Update your sign-in password',
            ),
            const _SettingsRow(
              icon: Icons.privacy_tip_outlined,
              title: 'Privacy',
              subtitle: 'Data & session controls',
            ),
            const SizedBox(height: AppSpacing.lg),
            _SectionTitle(title: 'About'),
            const SizedBox(height: AppSpacing.sm),
            const _SettingsRow(
              icon: Icons.info_outline_rounded,
              title: 'PrintFlow',
              subtitle: 'Version 1.0.0 • Brialyns Art Sign',
            ),
            const _SettingsRow(
              icon: Icons.help_outline_rounded,
              title: 'Help & support',
              subtitle: 'FAQs and contact information',
            ),
            const SizedBox(height: AppSpacing.lg),
            PfButton.danger(
              label: 'Sign out',
              icon: Icons.logout_rounded,
              fullWidth: true,
              size: PfButtonSize.large,
              onPressed: () {
                HapticFeedback.mediumImpact();
                showLogoutConfirmation(context);
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({
    required this.name,
    required this.email,
    required this.initials,
    required this.roleLabel,
    required this.lastLogin,
  });

  final String name;
  final String email;
  final String initials;
  final String roleLabel;
  final String lastLogin;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppTheme.primary,
            AppTheme.primary.withValues(alpha: 0.85),
          ],
        ),
        borderRadius: AppRadius.rLg,
        boxShadow: [
          BoxShadow(
            color: AppTheme.primary.withValues(alpha: 0.20),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppTheme.onPrimary.withValues(alpha: 0.18),
              shape: BoxShape.circle,
              border: Border.all(
                color: AppTheme.onPrimary.withValues(alpha: 0.4),
                width: 2,
              ),
            ),
            child: Center(
              child: Text(
                initials,
                style: TextStyle(
                  color: AppTheme.onPrimary,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  name,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: AppTheme.onPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  email,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.onPrimary.withValues(alpha: 0.85),
                      ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: AppTheme.onPrimary.withValues(alpha: 0.18),
                    borderRadius: AppRadius.rPill,
                  ),
                  child: Text(
                    roleLabel,
                    style: TextStyle(
                      fontSize: AppTypography.caption,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.onPrimary,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Last login: $lastLogin',
                  style: TextStyle(
                    fontSize: AppTypography.caption,
                    color: AppTheme.onPrimary.withValues(alpha: 0.7),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: AppSpacing.xs, top: AppSpacing.xs),
      child: Text(
        title.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              fontSize: AppTypography.caption,
              letterSpacing: 1.0,
              fontWeight: FontWeight.w700,
              color: AppTheme.onSurfaceVariant,
            ),
      ),
    );
  }
}

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.trailing,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final body = Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.md,
      ),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: AppRadius.rMd,
        border: Border.all(color: AppTheme.surfaceContainer),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppTheme.primary.withValues(alpha: 0.10),
              borderRadius: AppRadius.rSm,
            ),
            child: Icon(icon, color: AppTheme.primary, size: 18),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppTheme.onSurface,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.onSurfaceVariant,
                      ),
                ),
              ],
            ),
          ),
          if (trailing != null) trailing! else
            Icon(
              Icons.chevron_right_rounded,
              color: AppTheme.onSurfaceVariant,
            ),
        ],
      ),
    );
    if (onTap == null) return body;
    return PressScale(onTap: onTap!, child: body);
  }
}
