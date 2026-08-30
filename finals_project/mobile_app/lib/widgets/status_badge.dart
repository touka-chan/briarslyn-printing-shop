import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Reusable status badge — mirrors web `StatusBadge.tsx` colors.
/// Supports order statuses (Pending, In Production, Ready for Pickup, Completed)
/// and priority badges (Overdue, Urgent, Upcoming).
class StatusBadge extends StatelessWidget {
  final String label;
  final Color? color;
  final Color? backgroundColor;
  final IconData? icon;
  final bool dense;

  const StatusBadge({
    super.key,
    required this.label,
    this.color,
    this.backgroundColor,
    this.icon,
    this.dense = false,
  });

  /// Build a priority badge (Overdue/Urgent/Upcoming) from the web logic.
  factory StatusBadge.priority(String priority, {bool dense = false}) {
    final color = switch (priority) {
      'Overdue' => AppTheme.statusOverdue,
      'Urgent' => AppTheme.statusUrgent,
      'Upcoming' => AppTheme.statusUpcoming,
      _ => AppTheme.onSurfaceVariant,
    };
    return StatusBadge(
      label: priority,
      color: color,
      backgroundColor: color.withValues(alpha: 0.12),
      icon: switch (priority) {
        'Overdue' => Icons.warning_amber_rounded,
        'Urgent' => Icons.schedule,
        _ => Icons.event,
      },
      dense: dense,
    );
  }

  /// Build a status badge for order status.
  factory StatusBadge.orderStatus(String status, {bool dense = false}) {
    final color = switch (status) {
      'Pending' => AppTheme.onSurfaceVariant,
      'In Production' => AppTheme.statusInProduction,
      'Ready for Pickup' => AppTheme.statusReadyForPickup,
      'Completed' => AppTheme.statusCompleted,
      _ => AppTheme.onSurfaceVariant,
    };
    return StatusBadge(
      label: status,
      color: color,
      backgroundColor: color.withValues(alpha: 0.12),
      dense: dense,
    );
  }

  /// Build a stock status badge (In Stock / Low Stock / Insufficient Stock).
  factory StatusBadge.stock(String status, {bool dense = false}) {
    final color = switch (status) {
      'In Stock' => AppTheme.stockInStock,
      'Low Stock' => AppTheme.stockLow,
      'Insufficient Stock' => AppTheme.stockInsufficient,
      _ => AppTheme.onSurfaceVariant,
    };
    return StatusBadge(
      label: status,
      color: color,
      backgroundColor: color.withValues(alpha: 0.12),
      dense: dense,
    );
  }

  @override
  Widget build(BuildContext context) {
    final fg = color ?? AppTheme.onSurfaceVariant;
    final bg = backgroundColor ?? fg.withValues(alpha: 0.10);
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: dense ? 8 : 10,
        vertical: dense ? 3 : 4,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: dense ? 12 : 14, color: fg),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: dense ? 10 : 12,
              fontWeight: FontWeight.w600,
              color: fg,
            ),
          ),
        ],
      ),
    );
  }
}
