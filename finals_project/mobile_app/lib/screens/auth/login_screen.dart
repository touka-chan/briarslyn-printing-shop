import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app_router.dart';
import '../../auth/auth.dart';
import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../theme/app_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _loading = false;
  bool _obscurePassword = true;
  String? _errorText;

  late final AnimationController _entranceController;
  late final List<Animation<double>> _staggeredAnimations;

  @override
  void initState() {
    super.initState();
    _entranceController = AnimationController(
      vsync: this,
      duration: AppMotion.slow,
    );

    _staggeredAnimations = [
      for (int i = 0; i < 3; i++)
        CurvedAnimation(
          parent: _entranceController,
          curve: Interval(
            i * 0.15,
            0.5 + i * 0.15,
            curve: Curves.easeOutCubic,
          ),
        ),
    ];

    _entranceController.forward();
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _entranceController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (_loading) return;
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _errorText = null;
    });
    HapticFeedback.lightImpact();

    final auth = AuthProvider.of(context);
    final email = _emailCtrl.text.trim();
    final password = _passCtrl.text;

    try {
      await auth.signIn(email, password);
    } on fb.FirebaseAuthException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _errorText = _friendlyAuthError(e);
      });
      return;
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _errorText = 'Could not sign in. Check your connection and try again.';
      });
      debugPrint('[login] signIn failed: $e');
      return;
    }

    if (!mounted) return;
    setState(() => _loading = false);

    // If the auth user has no profile doc, the AuthService has not flipped
    // isLoggedIn to true. Route to a clear error screen so the user knows
    // to ask an admin to create the Firestore profile.
    if (!auth.isLoggedIn) {
      Navigator.pushReplacementNamed(context, AppRoutes.noProfile);
      return;
    }

    final role = auth.currentRole;
    if (role == null) {
      Navigator.pushReplacementNamed(context, AppRoutes.noProfile);
      return;
    }
    Navigator.pushReplacementNamed(context, role.homeRoute);
  }

  String _friendlyAuthError(fb.FirebaseAuthException e) {
    switch (e.code) {
      case 'invalid-email':
        return 'Enter a valid email address.';
      case 'user-disabled':
        return 'This account has been disabled. Contact an administrator.';
      case 'user-not-found':
      case 'wrong-password':
      case 'invalid-credential':
      case 'invalid-login-credentials':
        return 'Email or password is incorrect.';
      case 'too-many-requests':
        return 'Too many attempts. Wait a moment and try again.';
      case 'network-request-failed':
        return 'Network error. Check your connection and try again.';
      default:
        return e.message ?? 'Sign-in failed. Please try again.';
    }
  }

  @override
  Widget build(BuildContext context) {
    final reducedMotion =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: AppSpacing.xl),
                    // Hero: PrintFlow logo
                    FadeTransition(
                      opacity: reducedMotion
                          ? AlwaysStoppedAnimation(1)
                          : _staggeredAnimations[0],
                      child: SlideTransition(
                        position: reducedMotion
                            ? AlwaysStoppedAnimation(Offset.zero)
                            : Tween<Offset>(
                                begin: const Offset(0, 0.3),
                                end: Offset.zero,
                              ).animate(_staggeredAnimations[0]),
                        child: Center(
                          child: Container(
                            width: 72,
                            height: 72,
                            decoration: BoxDecoration(
                              color: AppTheme.primary,
                              borderRadius: AppRadius.rLg,
                            ),
                            child: const Icon(
                              Icons.print_rounded,
                              color: AppTheme.onPrimary,
                              size: AppIconSize.xl,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    // Wordmark
                    FadeTransition(
                      opacity: reducedMotion
                          ? AlwaysStoppedAnimation(1)
                          : _staggeredAnimations[1],
                      child: SlideTransition(
                        position: reducedMotion
                            ? AlwaysStoppedAnimation(Offset.zero)
                            : Tween<Offset>(
                                begin: const Offset(0, 0.3),
                                end: Offset.zero,
                              ).animate(_staggeredAnimations[1]),
                        child: Center(
                          child: Text(
                            'PrintFlow',
                            style: Theme.of(context)
                                .textTheme
                                .displayLarge
                                ?.copyWith(
                                  color: AppTheme.primary,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: -0.5,
                                ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    // Subtitle
                    FadeTransition(
                      opacity: reducedMotion
                          ? AlwaysStoppedAnimation(1)
                          : _staggeredAnimations[1],
                      child: SlideTransition(
                        position: reducedMotion
                            ? AlwaysStoppedAnimation(Offset.zero)
                            : Tween<Offset>(
                                begin: const Offset(0, 0.3),
                                end: Offset.zero,
                              ).animate(_staggeredAnimations[1]),
                        child: Center(
                          child: Text(
                            'Brialyns Art Sign — Integrated POS, RFID & Forecasting',
                            textAlign: TextAlign.center,
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(
                                  color: AppTheme.onSurfaceVariant,
                                ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xxxl),
                    // Email field
                    FadeTransition(
                      opacity: reducedMotion
                          ? AlwaysStoppedAnimation(1)
                          : _staggeredAnimations[2],
                      child: SlideTransition(
                        position: reducedMotion
                            ? AlwaysStoppedAnimation(Offset.zero)
                            : Tween<Offset>(
                                begin: const Offset(0, 0.3),
                                end: Offset.zero,
                              ).animate(_staggeredAnimations[2]),
                        child: PfTextField(
                          controller: _emailCtrl,
                          label: 'Email',
                          hintText: 'you@example.com',
                          prefixIcon: Icons.email_outlined,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          enabled: !_loading,
                          validator: (v) {
                            final t = (v ?? '').trim();
                            if (t.isEmpty) return 'Required';
                            if (!t.contains('@')) {
                              return 'Enter a valid email';
                            }
                            return null;
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    // Password field with eye toggle
                    FadeTransition(
                      opacity: reducedMotion
                          ? AlwaysStoppedAnimation(1)
                          : _staggeredAnimations[2],
                      child: SlideTransition(
                        position: reducedMotion
                            ? AlwaysStoppedAnimation(Offset.zero)
                            : Tween<Offset>(
                                begin: const Offset(0, 0.3),
                                end: Offset.zero,
                              ).animate(_staggeredAnimations[2]),
                        child: PfTextField(
                          controller: _passCtrl,
                          label: 'Password',
                          hintText: '••••••••',
                          prefixIcon: Icons.lock_outline_rounded,
                          obscureText: _obscurePassword,
                          textInputAction: TextInputAction.done,
                          enabled: !_loading,
                          onFieldSubmitted: (_) => _handleLogin(),
                          validator: (v) {
                            if ((v ?? '').isEmpty) return 'Required';
                            return null;
                          },
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword
                                  ? Icons.visibility_outlined
                                  : Icons.visibility_off_outlined,
                              color: AppTheme.onSurfaceVariant,
                              size: AppIconSize.md,
                            ),
                            onPressed: _loading
                                ? null
                                : () {
                                    HapticFeedback.selectionClick();
                                    setState(() =>
                                        _obscurePassword = !_obscurePassword);
                                  },
                            tooltip: _obscurePassword
                                ? 'Show password'
                                : 'Hide password',
                          ),
                        ),
                      ),
                    ),
                    if (_errorText != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        decoration: BoxDecoration(
                          color: AppTheme.statusUrgent.withValues(alpha: 0.08),
                          borderRadius: AppRadius.rMd,
                          border: Border.all(
                            color:
                                AppTheme.statusUrgent.withValues(alpha: 0.2),
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.error_outline_rounded,
                              color: AppTheme.statusUrgent,
                              size: 18,
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: Text(
                                _errorText!,
                                style: const TextStyle(
                                  color: AppTheme.statusUrgent,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.xl),
                    // Sign in button
                    FadeTransition(
                      opacity: reducedMotion
                          ? AlwaysStoppedAnimation(1)
                          : _staggeredAnimations[2],
                      child: SlideTransition(
                        position: reducedMotion
                            ? AlwaysStoppedAnimation(Offset.zero)
                            : Tween<Offset>(
                                begin: const Offset(0, 0.3),
                                end: Offset.zero,
                              ).animate(_staggeredAnimations[2]),
                        child: PfButton.filled(
                          label: 'Sign in',
                          size: PfButtonSize.large,
                          fullWidth: true,
                          loading: _loading,
                          onPressed: _loading ? null : _handleLogin,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    // Forgot password — opens the password-reset sheet.
                    Center(
                      child: TextButton(
                        onPressed: _loading
                            ? null
                            : () {
                                HapticFeedback.selectionClick();
                                _showForgotPasswordSheet(context);
                              },
                        style: TextButton.styleFrom(
                          foregroundColor: AppTheme.primary,
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md,
                            vertical: AppSpacing.xs,
                          ),
                        ),
                        child: const Text(
                          'Forgot password?',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showForgotPasswordSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => const _ForgotPasswordSheet(),
    );
  }
}

/// Modal sheet for the password-reset flow. Calls Firebase
/// `sendPasswordResetEmail`; the user receives a real reset link by email.
class _ForgotPasswordSheet extends StatefulWidget {
  const _ForgotPasswordSheet();

  @override
  State<_ForgotPasswordSheet> createState() => _ForgotPasswordSheetState();
}

class _ForgotPasswordSheetState extends State<_ForgotPasswordSheet> {
  final _emailCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _sending = false;

  @override
  void dispose() {
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _sending = true);
    HapticFeedback.lightImpact();

    final email = _emailCtrl.text.trim();
    final auth = AuthProvider.of(context);
    String? errorMessage;
    try {
      await auth.sendPasswordResetEmail(email);
    } on fb.FirebaseAuthException catch (e) {
      switch (e.code) {
        case 'invalid-email':
          errorMessage = 'Enter a valid email address.';
          break;
        case 'user-not-found':
          // Don't reveal whether the account exists; tell the user the
          // email was sent if the address is valid.
          break;
        case 'network-request-failed':
          errorMessage = 'Network error. Check your connection and try again.';
          break;
        default:
          errorMessage = e.message ?? 'Could not send reset email.';
      }
    } catch (e) {
      errorMessage = 'Could not send reset email. Try again in a moment.';
      debugPrint('[login] sendPasswordResetEmail failed: $e');
    }

    if (!mounted) return;
    if (errorMessage != null) {
      setState(() => _sending = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(errorMessage),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppTheme.statusUrgent,
        ),
      );
      return;
    }

    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('If an account exists for $email, a reset link has been sent.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.of(context).viewInsets;
    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.lg + viewInsets.bottom,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceContainer,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text(
              'Reset your password',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              "Enter your work email and we'll send you a reset link.",
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppTheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: AppSpacing.lg),
            PfTextField(
              controller: _emailCtrl,
              label: 'Work email',
              hintText: 'you@example.com',
              prefixIcon: Icons.email_outlined,
              keyboardType: TextInputType.emailAddress,
              enabled: !_sending,
              validator: (v) {
                final t = (v ?? '').trim();
                if (t.isEmpty) return 'Required';
                if (!t.contains('@')) return 'Enter a valid email';
                return null;
              },
            ),
            const SizedBox(height: AppSpacing.xl),
            Row(
              children: [
                Expanded(
                  child: PfButton.outlined(
                    label: 'Cancel',
                    fullWidth: true,
                    onPressed: _sending ? null : () => Navigator.pop(context),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: PfButton.filled(
                    label: _sending ? 'Sending…' : 'Send reset link',
                    icon: Icons.send_rounded,
                    fullWidth: true,
                    loading: _sending,
                    onPressed: _sending ? null : _send,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
