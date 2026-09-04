import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../theme/app_theme.dart';

/// A pill-shaped chip for displaying a "fact" label (e.g., factors from
/// [Order.basedOn] like "backlog", "job_complexity", "capacity").
///
/// The chip uses monospace font (JetBrains Mono) to give it a technical,
/// data-driven feel. Optionally displays a leading icon and a tooltip on
/// long-press to explain what the fact means.
class PfFactChip extends StatelessWidget {
  const PfFactChip({
    super.key,
    required this.label,
    this.icon,
    this.tooltip,
  });

  /// The fact label to display (e.g., "backlog", "job_complexity").
  final String label;

  /// Optional leading icon.
  final IconData? icon;

  /// Optional tooltip text shown on long-press.
  final String? tooltip;

  /// Convenience constructor that automatically picks an icon for common facts.
  factory PfFactChip.auto({
    Key? key,
    required String label,
    String? tooltip,
  }) {
    return PfFactChip(
      key: key,
      label: label,
      icon: iconForFact(label),
      tooltip: tooltip ?? _tooltipForFact(label),
    );
  }

  /// Maps common fact labels to appropriate icons.
  static IconData iconForFact(String fact) {
    return switch (fact.toLowerCase()) {
      'backlog' => Icons.inventory_2_outlined,
      'job_complexity' => Icons.architecture_outlined,
      'capacity' => Icons.bolt_outlined,
      _ => Icons.label_outline,
    };
  }

  /// Returns a default tooltip for common facts.
  static String? _tooltipForFact(String fact) {
    return switch (fact.toLowerCase()) {
      'backlog' => 'Based on current order backlog',
      'job_complexity' => 'Based on job complexity analysis',
      'capacity' => 'Based on production capacity',
      _ => null,
    };
  }

  @override
  Widget build(BuildContext context) {
    final chip = Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xxs,
      ),
      decoration: BoxDecoration(
        color: AppTheme.surfaceContainer,
        borderRadius: AppRadius.rPill,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(
              icon,
              size: AppIconSize.xs,
              color: AppTheme.onSurfaceVariant,
            ),
            const SizedBox(width: AppSpacing.xxs),
          ],
          Text(
            label,
            style: AppTheme.monoStyle(
              fontSize: AppTypography.caption,
              fontWeight: FontWeight.w500,
              color: AppTheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );

    if (tooltip != null && tooltip!.isNotEmpty) {
      return Tooltip(
        message: tooltip!,
        triggerMode: TooltipTriggerMode.longPress,
        child: chip,
      );
    }

    return chip;
  }
}
