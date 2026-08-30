import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app_router.dart';
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
  String _selectedRole = 'POS_Cashier';
  bool _loading = false;
  bool _obscurePassword = true;

  late final AnimationController _entranceController;
  late final List<Animation<double>> _staggeredAnimations;

  static const List<PfSegmentOption<String>> _roles = [
    PfSegmentOption(
      value: 'POS_Cashier',
      label: 'POS / Cashier',
      icon: Icons.point_of_sale_rounded,
    ),
    PfSegmentOption(
      value: 'Production Staff',
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

    // Navigate based on role — the router will handle this via named routes
    final String route = switch (_selectedRole) {
      'POS_Cashier' => AppRoutes.cashierHome,
      'Production Staff' => AppRoutes.productionQueue,
      _ => AppRoutes.cashierHome,
    };

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
                      child: PfSegmentedControl<String>(
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
}