import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/tokens.dart';
import '../theme/app_theme.dart';

/// A semantic segmented control for mutually exclusive options.
///
/// Use instead of `RadioListTile` or `DropdownButtonFormField` for short lists
/// (2–4 items) where the options should be visible at once.
///
/// The control renders as a full-width row of equal-width capsules. The
/// selected option is highlighted with a teal pill that slides smoothly
/// between segments. Each segment's tap target fills its share of the
/// row, so the active background always aligns with the active label
/// (no "stops in the middle of the text" bug).
///
/// The control respects reduced motion: when accessibility animations are
/// disabled, the pill snaps instantly with no transition.
///
/// Example:
/// ```dart
/// PfSegmentedControl<String>(
///   options: const [
///     PfSegmentOption(value: 'POS_Cashier', label: 'POS / Cashier'),
///     PfSegmentOption(value: 'Production Staff', label: 'Production Staff'),
///   ],
///   value: _selectedRole,
///   onChanged: (v) => setState(() => _selectedRole = v!),
/// )
/// ```
class PfSegmentedControl<T> extends StatefulWidget {
  /// Creates a segmented control.
  const PfSegmentedControl({
    super.key,
    required this.options,
    required this.value,
    required this.onChanged,
    this.enabled = true,
  });

  /// The options to display. At least 2 required.
  final List<PfSegmentOption<T>> options;

  /// Currently selected value.
  final T value;

  /// Called when the selection changes.
  final ValueChanged<T> onChanged;

  /// Whether the control is interactive.
  final bool enabled;

  @override
  State<PfSegmentedControl<T>> createState() => _PfSegmentedControlState<T>();
}

class _PfSegmentedControlState<T> extends State<PfSegmentedControl<T>> {
  @override
  void didUpdateWidget(covariant PfSegmentedControl<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value && widget.enabled) {
      HapticFeedback.selectionClick();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final reducedMotion =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;

    final selectedIndex = widget.options.indexWhere(
      (o) => o.value == widget.value,
    );
    final safeIndex = selectedIndex < 0 ? 0 : selectedIndex;
    final segmentCount = widget.options.length;
    // Inset inside the rounded container (matches the gap between the
    // pill and the outer border so the pill reads as a sliding chip).
    const double inset = 4;

    return Container(
      height: 48,
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainer,
        borderRadius: AppRadius.rPill,
        border: Border.all(color: colorScheme.outlineVariant),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final totalWidth = constraints.maxWidth;
          final availableWidth = totalWidth - (inset * 2);
          // Equal-width segments — never based on text width — so the
          // active pill aligns with the active tap target exactly.
          final segmentWidth = availableWidth / segmentCount;

          return Stack(
            children: [
              // Animated selection pill — slides between segments.
              if (selectedIndex >= 0)
                AnimatedPositioned(
                  duration: reducedMotion
                      ? Duration.zero
                      : const Duration(milliseconds: 240),
                  curve: Curves.easeOutCubic,
                  left: inset + (segmentWidth * safeIndex),
                  top: inset,
                  bottom: inset,
                  width: segmentWidth,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: AppTheme.primary,
                      borderRadius: AppRadius.rPill,
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.primary.withValues(alpha: 0.25),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                  ),
                ),
              // Option labels — each fills its equal-width share.
              Padding(
                padding: EdgeInsets.symmetric(horizontal: inset),
                child: Row(
                  children: [
                    for (int i = 0; i < widget.options.length; i++)
                      Expanded(
                        child: _SegmentButton<T>(
                          option: widget.options[i],
                          isSelected: widget.options[i].value == widget.value,
                          onTap: widget.enabled
                              ? () =>
                                  widget.onChanged(widget.options[i].value)
                              : null,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// A single option in a [PfSegmentedControl].
class PfSegmentOption<T> {
  const PfSegmentOption({
    required this.value,
    required this.label,
    this.icon,
  });

  /// The value this option represents.
  final T value;

  /// The user-facing label.
  final String label;

  /// Optional leading icon.
  final IconData? icon;
}

/// Internal button for each segment.
class _SegmentButton<T> extends StatelessWidget {
  const _SegmentButton({
    required this.option,
    required this.isSelected,
    required this.onTap,
  });

  final PfSegmentOption<T> option;
  final bool isSelected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final textStyle = Theme.of(context).textTheme.labelLarge?.copyWith(
          fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
          color: isSelected ? AppTheme.onPrimary : AppTheme.onSurface,
        );

    return Semantics(
      button: true,
      selected: isSelected,
      label: option.label,
      child: InkResponse(
        onTap: onTap,
        radius: 32,
        highlightColor: AppTheme.primary.withValues(alpha: 0.08),
        splashColor: AppTheme.primary.withValues(alpha: 0.12),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.sm,
          ),
          child: Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (option.icon != null) ...[
                  Icon(
                    option.icon,
                    size: AppIconSize.sm,
                    color:
                        isSelected ? AppTheme.onPrimary : AppTheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                ],
                Flexible(
                  child: Text(
                    option.label,
                    style: textStyle,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}