import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../theme/app_theme.dart';

/// A base card component with consistent styling across the app.
///
/// All cards in the app (KPI tiles, status headers, list rows, info panels)
/// use this primitive so they share the same border radius, hairline border,
/// shadow, padding, and optional accent stripe.
///
/// Variants:
///   * `PfCard()`                      — default surface card, hairline border.
///   * `PfCard(variant: PfCardVariant.elevated)` — soft shadow, no border.
///   * `PfCard(variant: PfCardVariant.tinted, accent: ...)` — soft tinted background.
///   * `PfCard(accent: AppTheme.statusCompleted)` — adds a 4px left accent stripe.
///
/// The `borderRadius` is applied to both the outer [Material] clip and the
/// inner [BoxDecoration] so the border and shadow never leave a phantom line.
enum PfCardVariant {
  surface,
  elevated,
  tinted,
}

class PfCard extends StatelessWidget {
  const PfCard({
    super.key,
    this.child,
    this.padding = const EdgeInsets.all(AppSpacing.md),
    this.cardRadius = AppRadius.rMd,
    this.backgroundColor = AppTheme.surface,
    this.onTap,
    this.accent,
    this.variant = PfCardVariant.surface,
    this.borderColor,
  });

  final Widget? child;
  final EdgeInsets padding;
  final BorderRadius cardRadius;
  final Color backgroundColor;
  final VoidCallback? onTap;
  final Color? accent;
  final PfCardVariant variant;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final Color effectiveBg;
    final Color effectiveBorder;
    final List<BoxShadow> shadow;

    switch (variant) {
      case PfCardVariant.elevated:
        effectiveBg = backgroundColor;
        effectiveBorder = Colors.transparent;
        shadow = AppShadow.sm;
        break;
      case PfCardVariant.tinted:
        effectiveBg = (accent ?? AppTheme.primary).withValues(alpha: 0.06);
        effectiveBorder = (accent ?? AppTheme.primary).withValues(alpha: 0.18);
        shadow = const [];
        break;
      case PfCardVariant.surface:
        effectiveBg = backgroundColor;
        effectiveBorder =
            borderColor ?? Theme.of(context).colorScheme.outlineVariant;
        shadow = const [];
        break;
    }

    return Material(
      color: Colors.transparent,
      borderRadius: cardRadius,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        borderRadius: cardRadius,
        onTap: onTap,
        child: Ink(
          decoration: BoxDecoration(
            color: effectiveBg,
            borderRadius: cardRadius,
            border: effectiveBorder == Colors.transparent
                ? null
                : Border.all(color: effectiveBorder, width: 1),
            boxShadow: shadow,
          ),
          child: Stack(
            children: [
              if (accent != null)
                Positioned(
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 4,
                  child: Container(
                    decoration: BoxDecoration(
                      color: accent,
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(AppRadius.md - 1),
                        bottomLeft: Radius.circular(AppRadius.md - 1),
                      ),
                    ),
                  ),
                ),
              Padding(padding: padding, child: child),
            ],
          ),
        ),
      ),
    );
  }
}
