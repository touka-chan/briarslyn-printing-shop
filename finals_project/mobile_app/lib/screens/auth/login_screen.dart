import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

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
  Role _selectedRole = Role.cashier;
  bool _loading = false;
  bool _obscurePassword = true;

  late final AnimationController _entranceController;
  late final List<Animation<double>> _staggeredAnimations;

  static const List<PfSegmentOption<Role>> _roles = [
    PfSegmentOption(
      value: Role.cashier,
      label: 'POS / Cashier',
      icon: Icons.point_of_sale_rounded,
    ),
    PfSegmentOption(
      value: Role.production,
      label: 'Production Staff',
      icon: Icons.precision_manufacturing_rounded,
    ),
  ];

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
    setState(() => _loading = true);
    HapticFeedback.lightImpact();

    await Future.delayed(const Duration(milliseconds: 600));
    if (!mounted) return;

    setState(() => _loading = false);

    // Get the auth service and log in with the selected role
    final auth = AuthProvider.of(context);
    auth.login(_selectedRole);

    // Navigate based on role
    final String route = _selectedRole.homeRoute;

    Navigator.pushReplacementNamed(context, route);
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
                            color: Colors.white,
                            size: 36,
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
                          style: Theme.of(context).textTheme.displayLarge?.copyWith(
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
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: AppTheme.onSurfaceVariant,
                              ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xxxl),
                  // Role selector
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
                      child: PfSegmentedControl<Role>(
                        options: _roles,
                        value: _selectedRole,
                        onChanged: (v) => setState(() => _selectedRole = v),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xxl),
                  // Email field
                  PfTextField(
                    controller: _emailCtrl,
                    label: 'Email',
                    hintText: 'you@example.com',
                    prefixIcon: Icons.email_outlined,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  // Password field with eye toggle
                  PfTextField(
                    controller: _passCtrl,
                    label: 'Password',
                    hintText: '••••••••',
                    prefixIcon: Icons.lock_outline_rounded,
                    obscureText: _obscurePassword,
                    textInputAction: TextInputAction.done,
                    onChanged: (_) => setState(() {}),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                        color: AppTheme.onSurfaceVariant,
                        size: AppIconSize.md,
                      ),
                      onPressed: () {
                        HapticFeedback.selectionClick();
                        setState(() => _obscurePassword = !_obscurePassword);
                      },
                      tooltip: _obscurePassword ? 'Show password' : 'Hide password',
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  // Sign in button
                  PfButton.filled(
                    label: 'Sign in',
                    size: PfButtonSize.large,
                    fullWidth: true,
                    loading: _loading,
                    onPressed: _handleLogin,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  // Forgot password — opens a mock reset sheet.
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
                  const SizedBox(height: AppSpacing.md),
                  // Demo footer
                  Center(
                    child: Text(
                      'Demo mode — any credentials will work',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppTheme.onSurfaceVariant
                                .withValues(alpha: 0.6),
                          ),
                    ),
                  ),
                ],
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

/// Modal sheet for the demo "Forgot password" flow. We don't actually send
/// a reset email — instead we collect the email and show a confirmation so
/// the cashier/production user understands what to expect.
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
    await Future.delayed(const Duration(milliseconds: 700));
    if (!mounted) return;
    final email = _emailCtrl.text.trim();
    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Reset link sent to $email'),
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
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
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