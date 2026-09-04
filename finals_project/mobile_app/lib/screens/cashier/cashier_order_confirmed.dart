import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../theme/app_theme.dart';

/// Full-screen "Order Confirmed" success state shown after the Cashier
/// creates a new order. Plays a draw-in checkmark, fires confetti, and
/// auto-pops back to the Orders list after a short delay.
///
/// Pushed via `Navigator.pushReplacement` so the user can't navigate back
/// into the now-stale New Order form.
class CashierOrderConfirmedScreen extends StatefulWidget {
  const CashierOrderConfirmedScreen({
    super.key,
    required this.orderId,
    this.insufficientStock = false,
  });

  /// The newly-created order ID to display (e.g. "ORD-1023").
  final String orderId;

  /// When true, shows a low-stock warning above the "what happens next"
  /// card so the cashier remembers to flag it for the owner.
  final bool insufficientStock;

  @override
  State<CashierOrderConfirmedScreen> createState() =>
      _CashierOrderConfirmedScreenState();
}

class _CashierOrderConfirmedScreenState
    extends State<CashierOrderConfirmedScreen>
    with TickerProviderStateMixin {
  late final AnimationController _drawController;
  late final AnimationController _burstController;
  late final AnimationController _fadeController;
  late final AnimationController _scaleController;

  @override
  void initState() {
    super.initState();
    HapticFeedback.heavyImpact();

    // Drives the checkmark stroke animation (0 → 1).
    _drawController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );

    // Drives the confetti burst (0 → 1, then restarts on a curve).
    _burstController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );

    // Drives the surrounding card fade-in.
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );

    // Drives the badge scale (pops in when the draw starts).
    _scaleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 450),
    );

    // Stagger the entry: card fades in, badge pops, checkmark draws,
    // confetti bursts. Auto-dismiss after a short hold.
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await _fadeController.forward();
      if (!mounted) return;
      await _scaleController.forward();
      if (!mounted) return;
      _drawController.forward();
      _burstController.forward();
      HapticFeedback.lightImpact();
      await Future.delayed(const Duration(milliseconds: 2400));
      if (!mounted) return;
      HapticFeedback.selectionClick();
      // Return true so the caller knows to also pop the New Order form.
      if (Navigator.of(context).canPop()) {
        Navigator.of(context).pop(true);
      }
    });
  }

  @override
  void dispose() {
    _drawController.dispose();
    _burstController.dispose();
    _fadeController.dispose();
    _scaleController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: Stack(
          children: [
            // Confetti burst layer (drawn first so it sits behind the card).
            Positioned.fill(
              child: IgnorePointer(
                child: AnimatedBuilder(
                  animation: _burstController,
                  builder: (context, _) {
                    return CustomPaint(
                      painter: _ConfettiPainter(
                        progress: _burstController.value,
                        seed: 7,
                      ),
                    );
                  },
                ),
              ),
            ),
            // Card + body.
            Center(
              child: FadeTransition(
                opacity: _fadeController,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Animated badge with draw-in checkmark.
                      ScaleTransition(
                        scale: CurvedAnimation(
                          parent: _scaleController,
                          curve: Curves.elasticOut,
                        ),
                        child: _AnimatedCheckBadge(
                          drawController: _drawController,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      Text(
                        'Order Confirmed',
                        style: Theme.of(context)
                            .textTheme
                            .headlineMedium
                            ?.copyWith(
                              fontWeight: FontWeight.w600,
                              color: AppTheme.onSurface,
                            ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        'Order ${widget.orderId} has been created\nand queued for production.',
                        textAlign: TextAlign.center,
                        style: Theme.of(context)
                            .textTheme
                            .bodyLarge
                            ?.copyWith(
                              color: AppTheme.onSurfaceVariant,
                            ),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      // Inventory warning — proposal §VII "insufficient stock indicator"
                      // continues here so the cashier cannot forget to flag the order.
                      if (widget.insufficientStock) ...[
                        Container(
                          padding: const EdgeInsets.all(AppSpacing.lg),
                          decoration: BoxDecoration(
                            color: AppTheme.stockInsufficient.withValues(alpha: 0.10),
                            borderRadius: AppRadius.rMd,
                            border: Border.all(
                              color: AppTheme.stockInsufficient.withValues(alpha: 0.35),
                            ),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                Icons.error_outline_rounded,
                                color: AppTheme.stockInsufficient,
                                size: AppIconSize.md,
                              ),
                              const SizedBox(width: AppSpacing.md),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      'Insufficient stock',
                                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                            fontWeight: FontWeight.w600,
                                            color: AppTheme.onSurface,
                                          ),
                                    ),
                                    const SizedBox(height: AppSpacing.xxs),
                                    Text(
                                      'This order exceeds current inventory. Please notify the owner before production starts.',
                                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                            color: AppTheme.onSurfaceVariant,
                                          ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                      ],
                      // Subtle status row, animates in alongside the card.
                      SlideTransition(
                        position: Tween<Offset>(
                          begin: const Offset(0, 0.2),
                          end: Offset.zero,
                        ).animate(
                          CurvedAnimation(
                            parent: _fadeController,
                            curve: Curves.easeOutCubic,
                          ),
                        ),
                        child: _NextStepsCard(),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      // Manual "Done" button — auto-pops after a delay but
                      // user can dismiss earlier.
                      SizedBox(
                        width: double.infinity,
                        child: PfButton.filled(
                          label: 'Back to Home',
                          icon: Icons.home_rounded,
                          fullWidth: true,
                          onPressed: () {
                            HapticFeedback.selectionClick();
                            if (Navigator.of(context).canPop()) {
                              Navigator.of(context).pop(true);
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Animated circular badge with a teal background and a checkmark that
/// draws itself in. Uses [CustomPaint] so we can drive the stroke
/// progress against the controller's value.
class _AnimatedCheckBadge extends StatelessWidget {
  const _AnimatedCheckBadge({required this.drawController});

  final AnimationController drawController;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 120,
      height: 120,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppTheme.primary,
              AppTheme.primary.withValues(alpha: 0.8),
            ],
          ),
          boxShadow: [
            BoxShadow(
              color: AppTheme.primary.withValues(alpha: 0.35),
              blurRadius: 32,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: AnimatedBuilder(
          animation: drawController,
          builder: (context, _) {
            return CustomPaint(
              painter: _CheckmarkPainter(progress: drawController.value),
            );
          },
        ),
      ),
    );
  }
}

/// Paints the checkmark stroke at [progress] (0.0 → 1.0).
class _CheckmarkPainter extends CustomPainter {
  _CheckmarkPainter({required this.progress});

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0) return;

    // Checkmark path: two strokes (down-left → mid → up-right).
    final start = Offset(size.width * 0.28, size.height * 0.54);
    final mid = Offset(size.width * 0.46, size.height * 0.70);
    final end = Offset(size.width * 0.74, size.height * 0.38);

    final firstSegment = Offset(
      start.dx + (mid.dx - start.dx) * progress.clamp(0, 1),
      start.dy + (mid.dy - start.dy) * progress.clamp(0, 1),
    );
    final secondProgress = (progress - 0.45).clamp(0, 1) / 0.55;
    final secondSegment = Offset(
      mid.dx + (end.dx - mid.dx) * secondProgress,
      mid.dy + (end.dy - mid.dy) * secondProgress,
    );

    final paint = Paint()
      ..color = AppTheme.onPrimary
      ..strokeWidth = size.width * 0.08
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    // First segment.
    canvas.drawLine(start, firstSegment, paint);
    if (progress > 0.45) {
      canvas.drawLine(mid, secondSegment, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _CheckmarkPainter oldDelegate) =>
      oldDelegate.progress != progress;
}

/// Paints a quick radial confetti burst originating from the center of
/// the screen. Particles fan out, fade, and settle.
class _ConfettiPainter extends CustomPainter {
  _ConfettiPainter({required this.progress, required this.seed});

  final double progress;
  final int seed;

  static const _palette = <Color>[
    Color(0xFFFFB200), // amber
    Color(0xFFFF5A5F), // coral
    Color(0xFF4FC3F7), // sky
    Color(0xFF66BB6A), // green
    Color(0xFFAB47BC), // purple
    Color(0xFFFFFFFF), // white
  ];

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0) return;
    final center = Offset(size.width / 2, size.height * 0.38);
    final rng = math.Random(seed);

    const particleCount = 36;
    for (int i = 0; i < particleCount; i++) {
      final angle = (i / particleCount) * math.pi * 2 +
          rng.nextDouble() * 0.4;
      final speed = 80 + rng.nextDouble() * 160;
      final dx = math.cos(angle) * speed;
      final dy = math.sin(angle) * speed - 30; // bias slightly upward

      final p = Curves.easeOutCubic.transform(progress);
      final position = Offset(
        center.dx + dx * p,
        center.dy + dy * p + (60 * p * p), // gentle gravity arc
      );

      final color = _palette[i % _palette.length]
          .withValues(alpha: (1 - progress).clamp(0, 1));

      final paint = Paint()..color = color;
      final sizeFactor = 3 + rng.nextDouble() * 4;
      // Rotate as they fly for a more lively feel.
      canvas.save();
      canvas.translate(position.dx, position.dy);
      canvas.rotate(angle + p * math.pi);
      // Mix circles and tiny rectangles for variety.
      if (i.isEven) {
        canvas.drawCircle(Offset.zero, sizeFactor, paint);
      } else {
        canvas.drawRect(
          Rect.fromCenter(
            center: Offset.zero,
            width: sizeFactor * 1.6,
            height: sizeFactor * 0.8,
          ),
          paint,
        );
      }
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _ConfettiPainter oldDelegate) =>
      oldDelegate.progress != progress;
}

/// Compact "what happens next" hint card shown beneath the headline.
class _NextStepsCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return PfCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'What happens next',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppTheme.onSurface,
                ),
          ),
          const SizedBox(height: AppSpacing.md),
          _NextStep(
            icon: Icons.inventory_2_outlined,
            title: 'Inventory check',
            subtitle: 'System verifies material stock for the order.',
          ),
          const SizedBox(height: AppSpacing.sm),
          _NextStep(
            icon: Icons.precision_manufacturing_outlined,
            title: 'Production queue',
            subtitle:
                'Order enters the queue and is auto-sorted by target date.',
          ),
          const SizedBox(height: AppSpacing.sm),
          _NextStep(
            icon: Icons.notifications_active_outlined,
            title: 'Status updates',
            subtitle:
                'Track progress from Pending → In Production → Ready for Pickup.',
          ),
        ],
      ),
    );
  }
}

class _NextStep extends StatelessWidget {
  const _NextStep({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: AppIconSize.xl,
          height: AppIconSize.xl,
          decoration: BoxDecoration(
            color: AppTheme.primary.withValues(alpha: 0.1),
            borderRadius: AppRadius.rMd,
          ),
          child: Icon(icon, size: AppIconSize.sm, color: AppTheme.primary),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppTheme.onSurface,
                    ),
              ),
              const SizedBox(height: AppSpacing.xxs),
              Text(
                subtitle,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppTheme.onSurfaceVariant,
                    ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
