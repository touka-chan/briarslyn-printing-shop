import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/tokens.dart';
import '../models/order.dart';
import '../theme/app_theme.dart';
import '../utils/animations.dart';
import 'pf_status_badge.dart';

/// The signature PrintFlow job ticket widget - renders an [Order] as a
/// perforated print shop job ticket card with dashed top border, monospace
/// order ID, status/priority badges, ETA, and payment chip.
///
/// This is the visual identity of the app - designed to look like a physical
/// production queue ticket from a real print shop.
///
/// Features:
/// - Dashed top border (perforated tear-strip effect)
/// - JOB # label with large monospace order ID
/// - Status and priority badges
/// - ETA with calendar icon
/// - Payment chip with peso amount
/// - Red overdue accent stripe on left edge when priority is "Overdue"
/// - Optional tap interaction with press scale animation
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

    final card = Container(
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: AppRadius.rMd,
        boxShadow: AppShadow.sm,
        border: Border.all(
          color: Theme.of(context).colorScheme.outlineVariant,
          width: 1,
        ),
      ),
      child: ClipRRect(
        borderRadius: AppRadius.rMd,
        child: Stack(
          children: [
            // Overdue accent stripe (left edge, full height)
            if (isOverdue)
              Positioned(
                left: 0,
                top: 0,
                bottom: 0,
                child: Container(
                  width: 4,
                  decoration: const BoxDecoration(
                    color: AppTheme.statusOverdue,
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(AppRadius.md),
                      bottomLeft: Radius.circular(AppRadius.md),
                    ),
                  ),
                ),
              ),
            // Main content
            Padding(
              padding: EdgeInsets.fromLTRB(
                isOverdue ? AppSpacing.lg + 4 : AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.lg,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Dashed top border (perforated tear strip)
                  const _DashedBorder(),
                  const SizedBox(height: AppSpacing.md),

                  // Header row: JOB # label + order ID
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'JOB #',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          fontSize: AppTypography.caption,
                          letterSpacing: 1.2,
                          color: AppTheme.onSurfaceVariant,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        order.orderId,
                        style: AppTheme.monoStyle(
                          fontSize: AppTypography.titleMd,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.onSurface,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),

                  // Customer name
                  Text(
                    order.customerName,
                    style: Theme.of(context).textTheme.titleMedium,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.xxs),

                  // Item type
                  Text(
                    order.itemType,
                    style: Theme.of(context).textTheme.bodyLarge,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.sm),

                  // Status & Priority badges
                  Wrap(
                    spacing: AppSpacing.xs,
                    runSpacing: AppSpacing.xs,
                    children: [
                      PfStatusBadge.orderStatus(order.status,
                          size: PfBadgeSize.small),
                      PfStatusBadge.priority(order.priority,
                          size: PfBadgeSize.small),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),

                  // Bottom row: ETA + Payment
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // ETA with calendar icon - labels so the API contract
                      // link (Sec.IX /api/orders/{id}/eta) is obvious to a panel.
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.calendar_today_outlined,
                            size: AppIconSize.xs,
                            color: _etaColor(order),
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          Text(
                            'ETA',
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  fontSize: AppTypography.caption,
                                  letterSpacing: 0.6,
                                  fontWeight: FontWeight.w600,
                                  color: AppTheme.onSurfaceVariant,
                                ),
                          ),
                          const SizedBox(width: AppSpacing.xxs),
                          Text(
                            _formatDate(order.estimatedCompletion),
                            style: AppTheme.monoStyle(
                              fontSize: AppTypography.bodySm,
                              fontWeight: FontWeight.w700,
                              color: _etaColor(order),
                            ),
                          ),
                        ],
                      ),

                      // Payment chip
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm,
                          vertical: AppSpacing.xxs,
                        ),
                        decoration: BoxDecoration(
                          color: AppTheme.primary.withValues(alpha: 0.08),
                          borderRadius: AppRadius.rPill,
                        ),
                        child: Text(
                          '₱ ${_formatAmount(order.paymentAmount)}',
                          style: AppTheme.monoStyle(
                            fontSize: AppTypography.bodySm,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.primary,
                          ),
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
    return AppTheme.onSurface;
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

/// Internal widget that renders a dashed border (perforated tear strip effect)
/// along the top of the job ticket.
class _DashedBorder extends StatelessWidget {
  const _DashedBorder();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: const Size(double.infinity, 1),
      painter: _DashedLinePainter(
        color: Theme.of(context).colorScheme.outlineVariant,
      ),
    );
  }
}

/// Custom painter that draws a dashed horizontal line.
class _DashedLinePainter extends CustomPainter {
  const _DashedLinePainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    const dashWidth = 4.0;
    const dashSpace = 4.0;
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;

    var startX = 0.0;
    while (startX < size.width) {
      canvas.drawLine(
        Offset(startX, 0),
        Offset(startX + dashWidth, 0),
        paint,
      );
      startX += dashWidth + dashSpace;
    }
  }

  @override
  bool shouldRepaint(covariant _DashedLinePainter oldDelegate) {
    return oldDelegate.color != color;
  }
}
