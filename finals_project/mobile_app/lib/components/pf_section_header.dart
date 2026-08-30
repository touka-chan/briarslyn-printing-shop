import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../theme/app_theme.dart';

/// A compact section header used to title content groups.
///
/// Displays a [title] in `titleLarge` style and an optional [subtitle]
/// in `bodySmall`. An [action] widget (e.g. a [PfButton.text] or
/// [IconButton]) can be placed on the trailing side for "View all"
/// or similar affordances.
///
/// Example:
/// ```dart
/// PfSectionHeader(
///   title: 'Recent orders',
///   subtitle: 'Last 30 days',
///   action: PfButton.text(
///     label: 'View all',
///     icon: Icons.arrow_forward_ios,
///     size: PfButtonSize.small,
///     onPressed: () => context.push('/orders'),
///   ),
/// )
/// ```
class PfSectionHeader extends StatelessWidget {
  /// Creates a section header. [title] is required.
  const PfSectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.action,
  });

  /// The section title.
  final String title;

  /// Optional subtitle shown below the title.
  final String? subtitle;

  /// Optional trailing action widget.
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppTheme.onSurface,
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  subtitle!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppTheme.onSurfaceVariant,
                  ),
                ),
              ],
            ],
          ),
        ),
        action ?? const SizedBox.shrink(),
      ],
    );
  }
}