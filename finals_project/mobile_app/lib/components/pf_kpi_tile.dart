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
    this.onLongPress,
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

  /// Whether [change] is positive (green) or negative (red).
  final bool changePositive;

  /// Animation duration for the count-up. Defaults to [AppMotion.countUp].
  final Duration duration;

  /// Optional tap handler.
  final VoidCallback? onTap;

  /// Optional long-press handler.
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    final effectiveAccent = accentColor ?? AppTheme.primary;
    final reducedMotion =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;

    return PfCard(
      variant: PfCardVariant.elevated,
      onTap: onTap,
      onLongPress: onLongPress,
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
                    fontSize: 32,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          _buildTrailing(effectiveAccent, reducedMotion),
        ],
      ),
    );
  }

  Widget _buildTrailing(Color accent, bool reducedMotion) {
    final children = <Widget>[];

    if (change != null) {
      children.add(
        AnimatedContainer(
          duration: Duration(milliseconds: reducedMotion ? 0 : 220),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.xxs,
          ),
          decoration: BoxDecoration(
            color: (changePositive ? AppTheme.statusCompleted : AppTheme.statusOverdue)
                .withValues(alpha: 0.12),
            borderRadius: AppRadius.rPill,
            // Subtle gradient overlay for premium feel
            gradient: changePositive
                ? null
                : LinearGradient(
                    colors: [
                      (AppTheme.statusOverdue).withValues(alpha: 0.15),
                      (AppTheme.statusOverdue).withValues(alpha: 0.08),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
          ),
          child: Text(
            change!,
            style: TextStyle(
              fontSize: AppTypography.caption,
              fontWeight: FontWeight.w600,
              color: changePositive ? AppTheme.statusCompleted : AppTheme.statusOverdue,
            ),
          ),
        ),
      );
    }

    if (icon != null && change == null) {
      if (children.isNotEmpty) {
        children.add(const SizedBox(height: AppSpacing.xs));
      }
      children.add(
        Icon(icon, size: AppIconSize.lg, color: accent),
      );
    }

    if (children.isEmpty) return const SizedBox.shrink();
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: children,
    );
  }
}