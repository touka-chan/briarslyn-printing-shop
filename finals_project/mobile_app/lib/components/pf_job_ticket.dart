import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/tokens.dart';
import '../models/order.dart';
import '../theme/app_theme.dart';
import '../utils/animations.dart';
import 'pf_status_badge.dart';

/// The PrintFlow job ticket - renders an [Order] as a clean work-ticket
/// card for the production queue and cashier order lists.
///
/// Design: flat white card with a single hairline border (no perforation
/// line, no chip backgrounds), a slim severity stripe on the left for
/// Overdue/Urgent jobs, and a quiet four-line hierarchy:
///
///   ORDER ID (mono)                    [Status]
///   Customer name
///   Item type · x2
///   ETA Sep 26                    [Urgent]  ₱ 1,250.00
///
/// Tapping fires a press-scale animation + light haptic.
class PfJobTicket extends StatelessWidget {
  const PfJobTicket({
    super.key,
    required this.order,
    this.onTap,
  });

  /// The order to display as a job ticket.
  final Order order;

  /// Optional tap callback. When provided, the entire ticket becomes tappable
  /// with a press-down animation and light haptic feedback.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isOverdue = order.priority == 'Overdue';
    final isUrgent = order.priority == 'Urgent';
    // Severity stripe only for jobs that actually need attention - the
    // Upcoming majority stays perfectly clean.
    final accent =
        isOverdue ? AppTheme.statusOverdue : (isUrgent ? AppTheme.statusUrgent : null);

    final card = Container(
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: AppRadius.rLg,
        border: Border.all(
          color: Theme.of(context).colorScheme.outlineVariant.withValues(alpha: 0.7),
        ),
      ),
      child: ClipRRect(
        borderRadius: AppRadius.rLg,
        child: Stack(
          children: [
            if (accent != null)
              Positioned(
                left: 0,
                top: 0,
                bottom: 0,
                child: Container(width: 3, color: accent),
              ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                accent != null ? AppSpacing.lg + 3 : AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.md,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header: order id + status
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          order.orderId,
                          style: AppTheme.monoStyle(
                            fontSize: AppTypography.bodyMd,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.onSurface,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      PfStatusBadge.orderStatus(order.status,
                          size: PfBadgeSize.small),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),

                  // Customer
                  Text(
                    order.customerName,
                    style: Theme.of(context).textTheme.titleMedium,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),

                  // Item + quantity
                  Text(
                    '${order.itemType} · x${order.quantity}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppTheme.onSurfaceVariant,
                        ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.md),

                  // Footer: ETA · priority · amount
                  Row(
                    children: [
                      Icon(
                        Icons.calendar_today_outlined,
                        size: AppIconSize.xs,
                        color: _etaColor(order),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        'ETA ${_formatDate(order.estimatedCompletion)}',
                        style: AppTheme.monoStyle(
                          fontSize: AppTypography.bodySm,
                          fontWeight: FontWeight.w600,
                          color: _etaColor(order),
                        ),
                      ),
                      const Spacer(),
                      // Priority badge only when it carries a warning -
                      // the Upcoming majority stays visually quiet.
                      if (order.priority != 'Upcoming') ...[
                        PfStatusBadge.priority(order.priority,
                            size: PfBadgeSize.small),
                        const SizedBox(width: AppSpacing.sm),
                      ],
                      Text(
                        '₱ ${_formatAmount(order.paymentAmount)}',
                        style: AppTheme.monoStyle(
                          fontSize: AppTypography.bodySm,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );

    if (onTap != null) {
      return PressScale(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap?.call();
        },
        child: card,
      );
    }

    return card;
  }

  /// Color-codes the ETA based on the gap to the target completion date so
  /// overdue / at-risk tickets are visible at a glance. Mirrors the queue's
  /// priority palette - no new colors introduced.
  Color _etaColor(Order order) {
    final daysUntilTarget =
        order.targetDate.difference(DateTime.now()).inDays;
    if (order.priority == 'Overdue' || daysUntilTarget < 0) {
      return AppTheme.statusOverdue;
    }
    if (daysUntilTarget <= 2) return AppTheme.statusUrgent;
    return AppTheme.onSurfaceVariant;
  }

  /// Formats a DateTime as "MMM dd" (e.g., "Aug 28").
  String _formatDate(DateTime date) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${months[date.month - 1]} ${date.day}';
  }

  /// Formats a payment amount with thousands separators (e.g., "1,250.00").
  String _formatAmount(double amount) {
    final parts = amount.toStringAsFixed(2).split('.');
    final intPart = parts[0];
    final decPart = parts[1];

    // Add thousands separator
    final buffer = StringBuffer();
    for (var i = 0; i < intPart.length; i++) {
      if (i > 0 && (intPart.length - i) % 3 == 0) {
        buffer.write(',');
      }
      buffer.write(intPart[i]);
    }

    return '${buffer.toString()}.$decPart';
  }
}
