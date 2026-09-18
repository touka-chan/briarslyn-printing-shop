import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/tokens.dart';
import '../theme/app_theme.dart';
import '../utils/animations.dart';

/// Visual variants for [PfButton].
enum PfButtonVariant {
  /// High-emphasis primary action (filled with [AppTheme.primary]).
  filled,

  /// Medium-emphasis action (outlined).
  outlined,

  /// Low-emphasis action (text only).
  text,

  /// Destructive action (filled with [AppTheme.statusOverdue]).
  danger,
}

/// Sizing presets for [PfButton]. Controls tap target height and font size.
enum PfButtonSize {
  /// 36h button, 12pt label - for compact rows / inline actions.
  small,

  /// 44h button, 14pt label - the default size, suitable for most screens.
  medium,

  /// 52h button, 15pt label - for prominent hero actions.
  large,
}

/// A unified button wrapper that consolidates the four Material button
/// variants into a single ergonomic API.
///
/// Renders the underlying [FilledButton], [OutlinedButton], or [TextButton]
/// based on [variant] while keeping consistent sizing, padding, and a
/// press-scale animation via [PressScale]. Tapping fires a `lightImpact`
/// haptic. When [loading] is true, the label is replaced with a
/// [CircularProgressIndicator] and the button is disabled.
///
/// Use [fullWidth] to make the button stretch to its parent's width -
/// useful inside form footers and dialogs.
///
/// Example:
/// ```dart
/// PfButton(
///   label: 'Save changes',
///   icon: Icons.check,
///   fullWidth: true,
///   onPressed: () => _save(),
/// )
/// ```
class PfButton extends StatelessWidget {
  /// Creates a button. The default variant is [PfButtonVariant.filled]
  /// and the default size is [PfButtonSize.medium].
  const PfButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = PfButtonVariant.filled,
    this.size = PfButtonSize.medium,
    this.icon,
    this.loading = false,
    this.fullWidth = false,
  });

  /// Primary (filled) button - for the main CTA on a screen.
  const PfButton.filled({
    super.key,
    required this.label,
    this.onPressed,
    this.size = PfButtonSize.medium,
    this.icon,
    this.loading = false,
    this.fullWidth = false,
  }) : variant = PfButtonVariant.filled;

  /// Outlined button - for secondary actions next to a filled CTA.
  const PfButton.outlined({
    super.key,
    required this.label,
    this.onPressed,
    this.size = PfButtonSize.medium,
    this.icon,
    this.loading = false,
    this.fullWidth = false,
  }) : variant = PfButtonVariant.outlined;

  /// Text button - for tertiary, low-emphasis actions.
  const PfButton.text({
    super.key,
    required this.label,
    this.onPressed,
    this.size = PfButtonSize.medium,
    this.icon,
    this.loading = false,
    this.fullWidth = false,
  }) : variant = PfButtonVariant.text;

  /// Destructive button (filled red). Use for irreversible actions like
  /// delete or cancel order.
  const PfButton.danger({
    super.key,
    required this.label,
    this.onPressed,
    this.size = PfButtonSize.medium,
    this.icon,
    this.loading = false,
    this.fullWidth = false,
  }) : variant = PfButtonVariant.danger;

  /// The button's visible label.
  final String label;

  /// Optional press handler. When null (or [loading] is true) the button
  /// is rendered as disabled.
  final VoidCallback? onPressed;

  /// Visual variant.
  final PfButtonVariant variant;

  /// Size preset.
  final PfButtonSize size;

  /// Optional leading icon.
  final IconData? icon;

  /// When true, renders a spinner in place of the label and disables the
  /// underlying button.
  final bool loading;

  /// When true, the button stretches to fill its parent's width.
  final bool fullWidth;

  void _handleTap() {
    if (loading || onPressed == null) return;
    HapticFeedback.lightImpact();
    onPressed!();
  }

  @override
  Widget build(BuildContext context) {
    final isEnabled = !loading && onPressed != null;
    final child = _buildChild(context, isEnabled);

    final button = _buildMaterialButton(context, isEnabled, child);

    final wrapped = PressScale(
      enabled: isEnabled,
      onTap: isEnabled ? _handleTap : null,
      child: button,
    );

    if (!fullWidth) return wrapped;
    return SizedBox(width: double.infinity, child: wrapped);
  }

  Widget _buildChild(BuildContext context, bool isEnabled) {
    if (loading) {
      return SizedBox(
        height: _iconSize(),
        width: _iconSize(),
        child: CircularProgressIndicator(
          strokeWidth: 2,
          valueColor: AlwaysStoppedAnimation<Color>(_foreground(context)),
        ),
      );
    }
    final children = <Widget>[];
    if (icon != null) {
      children.add(Icon(icon, size: _iconSize(), color: _foreground(context)));
      children.add(SizedBox(width: AppSpacing.sm));
    }
    children.add(
      Text(
        label,
        style: TextStyle(
          fontSize: _fontSize(),
          fontWeight: FontWeight.w600,
          color: _foreground(context).withValues(alpha: isEnabled ? 1.0 : 0.5),
        ),
      ),
    );
    return Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: children,
    );
  }

  Widget _buildMaterialButton(
    BuildContext context,
    bool isEnabled,
    Widget child,
  ) {
    final height = _height();
    final padding = _padding();
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppRadius.md),
      side: _borderSide(context),
    );

    switch (variant) {
      case PfButtonVariant.filled:
        return SizedBox(
          height: height,
          child: FilledButton(
            onPressed: isEnabled ? _handleTap : null,
            style: FilledButton.styleFrom(
              backgroundColor: AppTheme.primary,
              disabledBackgroundColor:
                  AppTheme.primary.withValues(alpha: 0.4),
              foregroundColor: AppTheme.onPrimary,
              padding: padding,
              shape: shape,
            ),
            child: child,
          ),
        );
      case PfButtonVariant.outlined:
        return SizedBox(
          height: height,
          child: OutlinedButton(
            onPressed: isEnabled ? _handleTap : null,
            style: OutlinedButton.styleFrom(
              foregroundColor: AppTheme.primary,
              disabledForegroundColor:
                  AppTheme.onSurfaceVariant.withValues(alpha: 0.5),
              padding: padding,
              shape: shape,
              side: BorderSide(
                color: AppTheme.primary.withValues(alpha: isEnabled ? 1.0 : 0.4),
              ),
            ),
            child: child,
          ),
        );
      case PfButtonVariant.text:
        return SizedBox(
          height: height,
          child: TextButton(
            onPressed: isEnabled ? _handleTap : null,
            style: TextButton.styleFrom(
              foregroundColor: AppTheme.primary,
              disabledForegroundColor:
                  AppTheme.onSurfaceVariant.withValues(alpha: 0.5),
              padding: padding,
              shape: shape,
            ),
            child: child,
          ),
        );
      case PfButtonVariant.danger:
        return SizedBox(
          height: height,
          child: FilledButton(
            onPressed: isEnabled ? _handleTap : null,
            style: FilledButton.styleFrom(
              backgroundColor: AppTheme.statusOverdue,
              disabledBackgroundColor:
                  AppTheme.statusOverdue.withValues(alpha: 0.4),
              foregroundColor: AppTheme.onPrimary,
              padding: padding,
              shape: shape,
            ),
            child: child,
          ),
        );
    }
  }

  Color _foreground(BuildContext context) {
    switch (variant) {
      case PfButtonVariant.filled:
      case PfButtonVariant.danger:
        return AppTheme.onPrimary;
      case PfButtonVariant.outlined:
      case PfButtonVariant.text:
        return AppTheme.primary;
    }
  }

  BorderSide _borderSide(BuildContext context) {
    // The outlined variant already defines its side in styleFrom below.
    return BorderSide.none;
  }

  double _height() {
    switch (size) {
      case PfButtonSize.small:
        return 36;
      case PfButtonSize.medium:
        return 44;
      case PfButtonSize.large:
        return 52;
    }
  }

  double _fontSize() {
    switch (size) {
      case PfButtonSize.small:
        return 12;
      case PfButtonSize.medium:
        return 14;
      case PfButtonSize.large:
        return 15;
    }
  }

  double _iconSize() {
    switch (size) {
      case PfButtonSize.small:
        return AppIconSize.sm;
      case PfButtonSize.medium:
        return AppIconSize.md;
      case PfButtonSize.large:
        return AppIconSize.lg;
    }
  }

  EdgeInsetsGeometry _padding() {
    switch (size) {
      case PfButtonSize.small:
        return const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.xs,
        );
      case PfButtonSize.medium:
        return const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.sm,
        );
      case PfButtonSize.large:
        return const EdgeInsets.symmetric(
          horizontal: AppSpacing.xl,
          vertical: AppSpacing.md,
        );
    }
  }
}
