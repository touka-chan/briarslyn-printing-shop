import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../theme/app_theme.dart';

/// A horizontal scrolling row of filter chips.
///
/// Displays a list of filter options with Material 3 FilterChip widgets.
/// The selected chip is highlighted with primary color, while unselected
/// chips have an outline style. The row is horizontally scrollable if the
/// chips exceed the available width.
///
/// Used for filtering views like order status, inventory categories, etc.
class PfFilterChips extends StatelessWidget {
  const PfFilterChips({
    super.key,
    required this.options,
    required this.selected,
    required this.onChanged,
  });

  /// The list of filter option labels.
  final List<String> options;

  /// The currently selected option.
  final String selected;

  /// Callback fired when the user selects a different option.
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: Row(
        children: [
          for (var i = 0; i < options.length; i++) ...[
            _buildChip(context, options[i]),
            if (i < options.length - 1) const SizedBox(width: AppSpacing.sm),
          ],
        ],
      ),
    );
  }

  Widget _buildChip(BuildContext context, String option) {
    final isSelected = option == selected;
    final reducedMotion = MediaQuery.maybeOf(context)?.disableAnimations ?? false;

    return AnimatedContainer(
      duration: reducedMotion ? Duration.zero : AppMotion.fast,
      curve: Curves.easeOutCubic,
      child: FilterChip(
        label: Text(option),
        selected: isSelected,
        onSelected: (_) => onChanged(option),
        showCheckmark: false,
        labelStyle: TextStyle(
          fontSize: AppTypography.bodySm,
          fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
          color: isSelected ? AppTheme.primary : AppTheme.onSurfaceVariant,
        ),
        backgroundColor: AppTheme.surface,
        selectedColor: AppTheme.primary.withValues(alpha: 0.12),
        side: BorderSide(
          color: isSelected
              ? AppTheme.primary
              : Theme.of(context).colorScheme.outlineVariant,
          width: isSelected ? 1.5 : 1,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.rPill,
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.xs,
        ),
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}
