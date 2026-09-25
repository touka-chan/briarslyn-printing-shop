import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../components/logout_dialog.dart';
import '../design/tokens.dart';
import '../screens/profile/profile_screen.dart';
import '../theme/app_theme.dart';
import '../theme/theme_controller.dart';

enum _AccountAction { profile, theme, signOut }

/// Collapses the app bar's account actions (Profile, appearance toggle,
/// Sign out) into one dropdown behind the account icon, keeping the bar
/// roomy on narrow phones. The appearance row reads the live palette on
/// every open, so its icon and On/Off pill always show the current mode.
class AccountMenuButton extends StatelessWidget {
  const AccountMenuButton({super.key, required this.uid});

  /// Signed-in user id - the appearance choice is saved on their profile.
  final String? uid;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<_AccountAction>(
      tooltip: 'Account',
      icon: const Icon(Icons.account_circle_outlined),
      color: AppTheme.surface,
      surfaceTintColor: Colors.transparent,
      position: PopupMenuPosition.under,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.rMd,
        side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      onSelected: (action) {
        HapticFeedback.selectionClick();
        switch (action) {
          case _AccountAction.profile:
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ProfileScreen()),
            );
          case _AccountAction.theme:
            setDarkMode(dark: !AppTheme.isDark, uid: uid);
          case _AccountAction.signOut:
            showLogoutConfirmation(context);
        }
      },
      itemBuilder: (context) => [
        _menuItem(
          value: _AccountAction.profile,
          icon: Icons.person_outline_rounded,
          label: 'Profile',
        ),
        _menuItem(
          value: _AccountAction.theme,
          icon: AppTheme.isDark
              ? Icons.dark_mode_rounded
              : Icons.dark_mode_outlined,
          label: 'Dark mode',
          trailing: _statePill(AppTheme.isDark ? 'On' : 'Off'),
        ),
        const PopupMenuDivider(),
        _menuItem(
          value: _AccountAction.signOut,
          icon: Icons.logout_rounded,
          label: 'Sign out',
          color: AppTheme.statusOverdue,
        ),
      ],
    );
  }

  PopupMenuItem<_AccountAction> _menuItem({
    required _AccountAction value,
    required IconData icon,
    required String label,
    Widget? trailing,
    Color? color,
  }) {
    final fg = color ?? AppTheme.onSurface;
    return PopupMenuItem<_AccountAction>(
      value: value,
      height: 46,
      child: Row(
        children: [
          Icon(icon, size: 20, color: fg),
          const SizedBox(width: 12),
          Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: fg,
            ),
          ),
          if (trailing != null) ...[const Spacer(), trailing],
        ],
      ),
    );
  }

  Widget _statePill(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: AppTheme.surfaceContainerHigh,
        borderRadius: AppRadius.rSm,
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: AppTheme.onSurfaceVariant,
        ),
      ),
    );
  }
}
