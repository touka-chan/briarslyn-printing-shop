import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../theme/app_theme.dart';

/// A base card component with consistent styling across the app.
class PfCard extends StatelessWidget {
  const PfCard({
    super.key,
    this.child,
    this.padding = const EdgeInsets.all(AppSpacing.md),
    this.borderWidth = 1.0,
    this.cardRadius = AppRadius.rMd,
    this.backgroundColor = AppTheme.surface,
    this.elevation = 0.0,
    this.onTap,
    this.shape = BoxShape.rectangle,
  });

  final Widget? child;
  final EdgeInsets padding;
  final double borderWidth;
  final BorderRadius cardRadius;
  final Color backgroundColor;
  final double elevation;
  final Widget? onTap;
  final BoxShape shape;

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: elevation,
      borderRadius: cardRadius,
      clipBehavior: Clip.hardEdge,
      child: Container(
        padding: padding,
        decoration: BoxDecoration(
          color: backgroundColor,
          border: Border.all(
            width: borderWidth,
            color: borderWidth > 0 ? AppTheme.onSurfaceVariant : Colors.transparent,
          ),
        ),
        child: InkWell(
          borderRadius: cardRadius,
          onTap: onTap,
          child: child,
        ),
      ),
    );
  }
}