import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../theme/app_theme.dart';

/// A friendly empty state shown when a list or screen has no content.
///
/// Shows a large [icon] (default 64px), a [title] in `titleLarge`, and
/// a [description] in `bodyMedium` / onSurfaceVariant. An optional
/// [action] widget (typically a [PfButton]) can drive the user to the
/// next step (e.g. "Create order").
///
/// Example:
/// ```dart
/// PfEmptyState(
///   icon: Icons.inventory_2_outlined,
///   title: 'No inventory items',
///   description: 'Add your first material to start tracking stock levels.',
///   action: PfButton.filled(
///     label: 'Add material',
///     icon: Icons.add,
///     onPressed: () => context.push('/inventory/create'),
///   ),
/// )
/// ```
class PfEmptyState extends StatelessWidget {
  /// Creates an empty state.
  const PfEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    this.action,
    this.iconSize = 64,
  });

  /// The icon displayed at the top. Typically an outlined Material icon.
  final IconData icon;

  /// Title text.
  final String title;

  /// Descriptive text below the title.
  final String description;

  /// Optional call-to-action widget (usually a button).
  final Widget? action;

  /// Icon size in logical pixels. Defaults to 64.
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: iconSize,
              color: AppTheme.onSurfaceVariant.withValues(alpha: 0.5),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
                color: AppTheme.onSurface,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              description,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppTheme.onSurfaceVariant,
              ),
            ),
            if (action != null) ...[
              const SizedBox(height: AppSpacing.xl),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}