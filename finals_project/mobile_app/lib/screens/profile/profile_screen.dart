import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../auth/auth.dart';
import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../services/otp_service.dart';
import '../../services/password_reset_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/animations.dart';
import '../../utils/chrome.dart';
import 'edit_profile_screen.dart';

/// Initials for the avatar (first letters of the first two name parts).
String _initialsOf(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
  final letters = parts.take(2).map((p) => p[0].toUpperCase()).join();
  return letters.isEmpty ? '-' : letters;
}

/// Formats the stored last-login ISO string as "Sep 24, 2026 - 10:11 AM"
/// (local time). Falls back to the raw value when unparseable and to "-"
/// when the account has never recorded a sign-in.
String _formatLastLogin(String raw) {
  if (raw.isEmpty || raw == '-') return '-';
  final dt = DateTime.tryParse(raw)?.toLocal();
  if (dt == null) return raw;
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  final hour12 = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
  final minute = dt.minute.toString().padLeft(2, '0');
  final period = dt.hour < 12 ? 'AM' : 'PM';
  return '${months[dt.month - 1]} ${dt.day}, ${dt.year} - $hour12:$minute $period';
}

/// Opens the "change password" sheet. The sheet emails a branded reset
/// link through the same Apps Script webhook the forgot-password flow
/// uses - no new backend, and the account is already signed in so the
/// address is confirmed.
Future<void> _showChangePasswordSheet(
  BuildContext context, {
  required String email,
  required String name,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _ChangePasswordSheet(email: email, name: name),
  );
}

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = AuthProvider.of(context);
    final role = auth.currentRole;
    final user = auth.currentUser;

    final name = (user?.name.isNotEmpty ?? false) ? user!.name : 'Staff';
    final email = user?.email ?? '-';
    final initials = _initialsOf(name);
    final roleLabel = role?.label ?? 'Guest';
    final lastLogin = _formatLastLogin(user?.lastLogin ?? '');

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Profile'),
        backgroundColor: chromeBarBackground(context),
        foregroundColor: chromeBarForeground(context),
        systemOverlayStyle: chromeBarOverlay(context),
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
            const _SectionTitle(title: 'Account'),
            const SizedBox(height: AppSpacing.sm),
            _SettingsRow(
              icon: Icons.person_outline_rounded,
              title: 'Edit profile',
              subtitle: 'Name and address - email code required',
              onTap: () => _startEditProfile(
                context,
                uid: auth.currentUid ?? '',
                email: email,
                name: name,
              ),
            ),
            _SettingsRow(
              icon: Icons.lock_outline_rounded,
              title: 'Change password',
              subtitle: 'Email yourself a secure reset link',
              onTap: () => _showChangePasswordSheet(
                context,
                email: email,
                name: name,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            const _SectionTitle(title: 'About'),
            const SizedBox(height: AppSpacing.sm),
            const _SettingsRow(
              icon: Icons.info_outline_rounded,
              title: 'Brialyns Art Sign',
              subtitle: 'Version 1.0.0',
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
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.onPrimary,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Last login: $lastLogin',
                  style: TextStyle(
                    fontSize: 11,
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
              fontSize: 11,
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
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
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
          if (onTap != null)
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

/// Bottom sheet that emails a branded password-reset link for the
/// signed-in account - same Apps Script webhook as "Forgot password?".
/// The account is already authenticated, so the address is confirmed;
/// the link opens the shared web reset page in the browser.
class _ChangePasswordSheet extends StatefulWidget {
  const _ChangePasswordSheet({required this.email, required this.name});

  final String email;
  final String name;

  @override
  State<_ChangePasswordSheet> createState() => _ChangePasswordSheetState();
}

class _ChangePasswordSheetState extends State<_ChangePasswordSheet> {
  bool _sending = false;

  Future<void> _send() async {
    if (_sending) return;
    setState(() => _sending = true);
    // Resolve before the await so no context is used across the gap.
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    try {
      await requestPasswordReset(widget.email, name: widget.name);
      if (!mounted) return;
      navigator.pop();
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            'Reset link sent to ${widget.email} - check your Gmail.',
          ),
        ),
      );
    } catch (e) {
      final msg = e.toString().replaceFirst('Exception: ', '').trim();
      if (!mounted) return;
      setState(() => _sending = false);
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            msg.isEmpty ? 'Could not send the reset link. Try again.' : msg,
          ),
          backgroundColor: AppTheme.statusUrgent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.xl,
        0,
        AppSpacing.xl,
        AppSpacing.xl + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppTheme.primary.withValues(alpha: 0.10),
              borderRadius: AppRadius.rMd,
            ),
            child: Icon(
              Icons.lock_outline_rounded,
              color: AppTheme.primary,
              size: 22,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Change password',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            "We'll email a secure reset link to ${widget.email}. Open it "
            'in the browser to choose a new password, then sign back in '
            'here.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppTheme.onSurfaceVariant,
                  height: 1.45,
                ),
          ),
          const SizedBox(height: AppSpacing.xl),
          PfButton.filled(
            label: 'Send reset link',
            icon: Icons.mail_outline_rounded,
            fullWidth: true,
            loading: _sending,
            onPressed: _sending ? null : _send,
          ),
        ],
      ),
    );
  }
}

/// Runs the OTP gate, then opens the edit form once the code emailed to
/// the registered address verifies. Shows the saved confirmation when
/// the form returns true.
Future<void> _startEditProfile(
  BuildContext context, {
  required String uid,
  required String email,
  required String name,
}) async {
  final verified = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _OtpGateSheet(uid: uid, email: email, name: name),
  );
  if (verified != true || !context.mounted) return;
  final saved = await Navigator.of(context).push<bool>(
    MaterialPageRoute(builder: (_) => const EditProfileScreen()),
  );
  if (saved == true && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Profile updated.')),
    );
  }
}

/// OTP gate shown before the profile edit form. Sends a 6-digit code to
/// the account's registered email (5-minute TTL, single-use, max 5
/// attempts - enforced server-side) and only returns `true` once the
/// code verifies.
class _OtpGateSheet extends StatefulWidget {
  const _OtpGateSheet({
    required this.uid,
    required this.email,
    required this.name,
  });

  final String uid;
  final String email;
  final String name;

  @override
  State<_OtpGateSheet> createState() => _OtpGateSheetState();
}

class _OtpGateSheetState extends State<_OtpGateSheet> {
  static const int _ttlSeconds = 5 * 60;

  final TextEditingController _codeCtrl = TextEditingController();
  Timer? _ticker;
  bool _sent = false;
  bool _busy = false;
  String? _error;
  int _secondsLeft = 0;

  @override
  void dispose() {
    _ticker?.cancel();
    _codeCtrl.dispose();
    super.dispose();
  }

  bool get _expired => _sent && _secondsLeft <= 0;

  String get _countdown {
    final m = _secondsLeft ~/ 60;
    final s = (_secondsLeft % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  Future<void> _sendCode() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final messenger = ScaffoldMessenger.of(context);
    try {
      await sendProfileEditOtp(
        uid: widget.uid,
        email: widget.email,
        name: widget.name,
      );
      if (!mounted) return;
      setState(() {
        _busy = false;
        _sent = true;
        _secondsLeft = _ttlSeconds;
      });
      _codeCtrl.clear();
      _startTicker();
      messenger.showSnackBar(
        SnackBar(content: Text('Confirmation code sent to ${widget.email}.')),
      );
    } catch (e) {
      final msg = e.toString().replaceFirst('Exception: ', '').trim();
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = msg.isEmpty ? 'Could not send the code. Try again.' : msg;
      });
    }
  }

  void _startTicker() {
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      setState(() {
        _secondsLeft -= 1;
        if (_secondsLeft <= 0) {
          _secondsLeft = 0;
          t.cancel();
        }
      });
    });
  }

  Future<void> _verify() async {
    if (_busy) return;
    final code = _codeCtrl.text.trim();
    if (code.length != 6) {
      setState(() => _error = 'Enter the 6-digit code from the email.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    try {
      await verifyProfileEditOtp(uid: widget.uid, code: code);
      if (!mounted) return;
      _ticker?.cancel();
      navigator.pop(true);
    } catch (e) {
      final msg = e.toString().replaceFirst('Exception: ', '').trim();
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = msg.isEmpty ? 'Could not verify the code. Try again.' : msg;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.xl,
        0,
        AppSpacing.xl,
        AppSpacing.xl + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppTheme.primary.withValues(alpha: 0.10),
              borderRadius: AppRadius.rMd,
            ),
            child: Icon(
              Icons.mark_email_read_outlined,
              color: AppTheme.primary,
              size: 22,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            _sent ? 'Enter the confirmation code' : 'Confirm it is you',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            _sent
                ? 'We emailed a 6-digit code to ${widget.email}. It expires '
                    '5 minutes after it was sent.'
                : 'To edit your profile we first confirm your registered '
                    'email. We will send a 6-digit code to ${widget.email}.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppTheme.onSurfaceVariant,
                  height: 1.45,
                ),
          ),
          if (_sent) ...[
            const SizedBox(height: AppSpacing.lg),
            PfTextField(
              label: 'Confirmation code',
              controller: _codeCtrl,
              monospace: true,
              keyboardType: TextInputType.number,
              prefixIcon: Icons.password_rounded,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(6),
              ],
              errorText: _error,
              onFieldSubmitted: (_) => _verify(),
            ),
            const SizedBox(height: AppSpacing.xs),
            Row(
              children: [
                Text(
                  _expired ? 'Code expired' : 'Expires in $_countdown',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: _expired
                            ? AppTheme.statusOverdue
                            : AppTheme.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const Spacer(),
                TextButton(
                  onPressed: _busy ? null : _sendCode,
                  child: const Text('Resend code'),
                ),
              ],
            ),
          ] else if (_error != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              _error!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppTheme.statusOverdue,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          PfButton.filled(
            label: _sent ? 'Verify code' : 'Send code',
            icon: _sent ? Icons.verified_outlined : Icons.send_rounded,
            fullWidth: true,
            loading: _busy,
            onPressed: _busy ? null : (_sent ? _verify : _sendCode),
          ),
        ],
      ),
    );
  }
}
