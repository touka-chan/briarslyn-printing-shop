import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../theme/app_theme.dart';
import '../utils/animations.dart';
import 'pf_card.dart';

/// A KPI (Key Performance Indicator) tile with an animated counter.
///
/// Displays a large numeric value using [AnimatedCountUp], a compact
/// uppercase label below, and optional visual flourishes:
///   * [icon] — shown in the top-right corner, tinted with [accentColor].
///   * [accentColor] — colors the number and icon (defaults to [AppTheme.primary]).
///   * [change] — a small pill in the top-right showing a delta (e.g. "+12%").
///
/// The tile renders as an outlined [PfCard] with subtle elevation, shadow,
/// and hover/press feedback. Supports tapping via [onTap] (with press-scale
/// and haptic feedback).
///
/// Example:
/// ```dart
/// PfKpiTile(
///   value: 1247,
///   label: 'Orders this month',
///   icon: Icons.receipt_long,
///   accentColor: AppTheme.statusInProduction,
///   change: '+12%',
///   onTap: () => context.push('/orders'),
/// )
/// ```
class PfKpiTile extends StatelessWidget {
  /// Creates a KPI tile.
  const PfKpiTile({
    super.key,
    required this.value,
    required this.label,
    this.icon,
    this.accentColor,
    this.change,
    this.changePositive = true,
    this.duration = AppMotion.countUp,
    this.onTap,
  });

  /// The numeric value to animate to. Can be int, double, or String.
  final Object value;

  /// Short uppercase label shown below the value.
  final String label;

  /// Optional icon in the top-right, tinted with [accentColor].
  final IconData? icon;

  /// Color for the animated number and [icon]. Defaults to [AppTheme.primary].
  final Color? accentColor;

  /// Optional change indicator (e.g. "+12%", "−3%").
  final String? change;

  /// Whether the change is positive (green) or negative (red).
  final bool changePositive;

  /// Duration of the count-up animation.
  final Duration duration;

  /// Optional tap handler.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final effectiveAccent = accentColor ?? AppTheme.primary;
    final reducedMotion =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;

    return PfCard(
      variant: PfCardVariant.elevated,
      onTap: onTap,
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Icon with subtle bounce on mount
          if (icon != null) ...[
            Transform.scale(
              scale: reducedMotion ? 1.0 : 0.8,
              child: AnimatedOpacity(
                duration: Duration(milliseconds: reducedMotion ? 0 : 200),
                curve: Curves.easeOutCubic,
                opacity: reducedMotion ? 1.0 : 1.0,
                child: Icon(icon, size: AppIconSize.md, color: effectiveAccent),
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label.toUpperCase(),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppTheme.onSurfaceVariant,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                AnimatedCountUp(
                  value: value,
                  duration: duration,
                  style: Theme.of(context).textTheme.displayMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: effectiveAccent,
                  ),
                ),
                if (change != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xxs,
                    ),
                    decoration: BoxDecoration(
                      color: (changePositive
                              ? AppTheme.statusCompleted
                              : AppTheme.statusUrgent)
                          .withValues(alpha: 0.12),
                      borderRadius: AppRadius.rPill,
                    ),
                    child: Text(
                      change!,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: changePositive
                            ? AppTheme.statusCompleted
                            : AppTheme.statusUrgent,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}