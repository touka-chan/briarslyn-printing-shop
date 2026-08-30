import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../theme/app_theme.dart';

/// Size presets for [PfStatusBadge]. Controls font size and vertical
/// padding. Horizontal padding scales with the text.
enum PfBadgeSize {
  /// 10pt label, 3px vertical padding — for dense lists/chips.
  tiny,

  /// 11pt label, 4px vertical padding — compact but readable.
  small,

  /// 12pt label, 5px vertical padding — the default size.
  medium,

  /// 13pt label, 6px vertical padding — for prominent callouts.
  large,
}

/// A pill-shaped status badge with semantic color mappings for PrintFlow
/// order priorities, order statuses, inventory stock levels, and payment
/// states.
///
/// Use the factory constructors for consistent theming:
///   * [PfStatusBadge.priority] — Overdue / Urgent / Upcoming
///   * [PfStatusBadge.orderStatus] — Pending / In Production / Ready for Pickup / Completed
///   * [PfStatusBadge.stock] — In Stock / Low Stock / Insufficient Stock
///   * [PfStatusBadge.payment] — Paid / Unpaid / Partial
///
/// All badges animate color/background changes via [AnimatedContainer]
/// over [AppMotion.base] (220ms) so status transitions feel smooth.
///
/// Example:
/// ```dart
/// PfStatusBadge.orderStatus('In Production', size: PfBadgeSize.small)
/// PfStatusBadge.stock('Low Stock')
/// ```
class PfStatusBadge extends StatelessWidget {
  /// Internal constructor. Use the factory constructors for semantic
  /// color mappings.
  const PfStatusBadge._({
    // ignore: unused_element_parameter
    super.key,
    required this.label,
    required this.color,
    required this.backgroundColor,
    this.icon,
    this.size = PfBadgeSize.medium,
  });

  /// Builds a priority badge.
  ///
  /// Color mapping:
  ///   * 'Overdue'   → [AppTheme.statusOverdue] (red)
  ///   * 'Urgent'    → [AppTheme.statusUrgent] (amber)
  ///   * 'Upcoming'  → [AppTheme.statusUpcoming] (primary teal)
  ///   * anything else → [AppTheme.onSurfaceVariant] (neutral)
  factory PfStatusBadge.priority(String priority, {PfBadgeSize size = PfBadgeSize.medium}) {
    final color = switch (priority) {
      'Overdue' => AppTheme.statusOverdue,
      'Urgent' => AppTheme.statusUrgent,
      'Upcoming' => AppTheme.statusUpcoming,
      _ => AppTheme.onSurfaceVariant,
    };
    return PfStatusBadge._(
      label: priority,
      color: color,
      backgroundColor: color.withValues(alpha: 0.12),
      icon: switch (priority) {
        'Overdue' => Icons.warning_amber_rounded,
        'Urgent' => Icons.schedule,
        _ => Icons.event,
      },
      size: size,
    );
  }

  /// Builds an order status badge.
  ///
  /// Color mapping:
  ///   * 'Pending'           → [AppTheme.onSurfaceVariant] (neutral)
  ///   * 'In Production'     → [AppTheme.statusInProduction] (blue)
  ///   * 'Ready for Pickup'  → [AppTheme.statusReadyForPickup] (purple)
  ///   * 'Completed'         → [AppTheme.statusCompleted] (green)
  ///   * anything else       → [AppTheme.onSurfaceVariant] (neutral)
  factory PfStatusBadge.orderStatus(String status, {PfBadgeSize size = PfBadgeSize.medium}) {
    final color = switch (status) {
      'Pending' => AppTheme.onSurfaceVariant,
      'In Production' => AppTheme.statusInProduction,
      'Ready for Pickup' => AppTheme.statusReadyForPickup,
      'Completed' => AppTheme.statusCompleted,
      _ => AppTheme.onSurfaceVariant,
    };
    return PfStatusBadge._(
      label: status,
      color: color,
      backgroundColor: color.withValues(alpha: 0.12),
      size: size,
    );
  }

  /// Builds an inventory stock badge.
  ///
  /// Color mapping:
  ///   * 'In Stock'           → [AppTheme.stockInStock] (green)
  ///   * 'Low Stock'          → [AppTheme.stockLow] (amber)
  ///   * 'Insufficient Stock' → [AppTheme.stockInsufficient] (red)
  ///   * anything else        → [AppTheme.onSurfaceVariant] (neutral)
  factory PfStatusBadge.stock(String status, {PfBadgeSize size = PfBadgeSize.medium}) {
    final color = switch (status) {
      'In Stock' => AppTheme.stockInStock,
      'Low Stock' => AppTheme.stockLow,
      'Insufficient Stock' => AppTheme.stockInsufficient,
      _ => AppTheme.onSurfaceVariant,
    };
    return PfStatusBadge._(
      label: status,
      color: color,
      backgroundColor: color.withValues(alpha: 0.12),
      size: size,
    );
  }

  /// Builds a payment status badge.
  ///
  /// Color mapping:
  ///   * 'Paid'     → [AppTheme.statusCompleted] (green)
  ///   * 'Unpaid'   → [AppTheme.statusOverdue] (red)
  ///   * 'Partial'  → [AppTheme.statusUrgent] (amber)
  ///   * anything else → [AppTheme.onSurfaceVariant] (neutral)
  factory PfStatusBadge.payment(String status, {PfBadgeSize size = PfBadgeSize.medium}) {
    final color = switch (status) {
      'Paid' => AppTheme.statusCompleted,
      'Unpaid' => AppTheme.statusOverdue,
      'Partial' => AppTheme.statusUrgent,
      _ => AppTheme.onSurfaceVariant,
    };
    return PfStatusBadge._(
      label: status,
      color: color,
      backgroundColor: color.withValues(alpha: 0.12),
      size: size,
    );
  }

  /// The text to show inside the badge.
  final String label;

  /// Foreground color (text + optional icon).
  final Color color;

  /// Background color (tinted variant of [color]).
  final Color backgroundColor;

  /// Optional leading icon.
  final IconData? icon;

  /// Size preset.
  final PfBadgeSize size;

  @override
  Widget build(BuildContext context) {
    final (fontSize, vPadding, iconSize) = _resolveSizes();

    return AnimatedContainer(
      duration: AppMotion.base,
      curve: AppMotion.easeOutCubic,
      padding: EdgeInsets.symmetric(
        horizontal: fontSize + 4, // scales with label size
        vertical: vPadding,
      ),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: AppRadius.rPill,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: iconSize, color: color),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  (double, double, double) _resolveSizes() {
    switch (size) {
      case PfBadgeSize.tiny:
        return (AppTypography.caption, 3, AppIconSize.xs);
      case PfBadgeSize.small:
        return (AppTypography.label, 4, AppIconSize.sm);
      case PfBadgeSize.medium:
        return (AppTypography.bodySm, 5, AppIconSize.sm);
      case PfBadgeSize.large:
        return (AppTypography.bodyMd, 6, AppIconSize.md);
    }
  }
}