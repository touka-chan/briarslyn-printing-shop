import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../auth/auth.dart';
import '../../design/tokens.dart';
import '../../models/order.dart';
import '../../services/firebase_orders.dart' as fb_orders;
import '../../services/order_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/status_badge.dart';

/// Production dashboard — a live top-N view of the active production queue.
///
/// Renders orders directly from the `orders` Firestore collection. When the
/// collection is empty (no orders have been entered yet), an honest empty
/// state replaces the previous hardcoded sample queue.
class ProductionDashboard extends StatelessWidget {
  const ProductionDashboard({super.key});

  String _factorLabel(String f) {
    if (f == 'backlog') return 'Shop Backlog';
    if (f == 'job_complexity') return 'Job Complexity';
    if (f == 'capacity') return 'Capacity Limit';
    return f;
  }

  Future<void> _advanceStatus(BuildContext context, Order order) async {
    if (order.status == 'Completed') return;
    final auth = AuthProvider.of(context);
    try {
      await OrderService.advanceStatus(orderId: order.orderId, auth: auth);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Status updated for ${order.orderId}'),
          backgroundColor: AppTheme.success,
        ),
      );
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not update order status'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFmt = DateFormat('MMM d');
    return Scaffold(
      appBar: AppBar(
        title: const Text('Production Queue'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => Navigator.pop(context),
          ),
        ],
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(40),
          child: Padding(
            padding: EdgeInsets.fromLTRB(
                AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.md),
            child: Row(
              children: [
                SizedBox(width: AppSpacing.sm),
                Text(
                  'RFID station online',
                  style: TextStyle(
                    fontSize: AppTypography.caption,
                    color: AppTheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      body: StreamBuilder<List<Order>>(
        stream: fb_orders.subscribeOrdersStream(),
        builder: (context, snap) {
          // Limit the dashboard to active orders (anything not yet completed).
          final orders = (snap.data ?? const <Order>[])
              .where((o) => o.status != 'Completed')
              .toList();

          if (orders.isEmpty) {
            return _buildEmptyState();
          }

          return ListView.separated(
            padding: const EdgeInsets.all(AppSpacing.md),
            itemCount: orders.length,
            separatorBuilder: (context, index) =>
                const SizedBox(height: AppSpacing.sm),
            itemBuilder: (context, i) {
              final order = orders[i];
              final basedOn = order.basedOn ?? const <String>[];
              return _buildOrderCard(context, order, basedOn, dateFmt);
            },
          );
        },
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppTheme.statusInProduction.withValues(alpha: 0.10),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.precision_manufacturing_outlined,
                size: 48,
                color: AppTheme.statusInProduction,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Production queue is empty',
              style: TextStyle(
                fontSize: AppTypography.titleLg,
                fontWeight: FontWeight.w600,
                color: AppTheme.onSurface,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'New orders from the Cashier app will appear here as they enter the pipeline.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: AppTypography.bodyMd,
                color: AppTheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOrderCard(
    BuildContext context,
    Order order,
    List<String> basedOn,
    DateFormat dateFmt,
  ) {
    return Card(
      child: InkWell(
        borderRadius: AppRadius.rMd,
        onTap: () {
          showModalBottomSheet(
            context: context,
            isScrollControlled: true,
            shape: const RoundedRectangleBorder(
              borderRadius:
                  BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
            ),
            builder: (modalContext) =>
                _orderDetails(order, basedOn, dateFmt, modalContext),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    order.orderId,
                    style: AppTheme.monoStyle(
                      fontSize: AppTypography.label,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Spacer(),
                  StatusBadge.priority(order.priority, dense: true),
                ],
              ),
              const SizedBox(height: AppSpacing.xs + 2),
              Text(
                order.itemType,
                style: const TextStyle(
                    fontSize: AppTypography.bodyMd, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  StatusBadge.orderStatus(order.status, dense: true),
                  const SizedBox(width: AppSpacing.sm),
                  Icon(Icons.event,
                      size: AppIconSize.xs, color: AppTheme.onSurfaceVariant),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    'Target ${dateFmt.format(order.targetDate)}',
                    style: const TextStyle(
                      fontSize: AppTypography.caption,
                      color: AppTheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  const Icon(Icons.flag,
                      size: AppIconSize.xs, color: AppTheme.primary),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    'ETA ${dateFmt.format(order.estimatedCompletion)}',
                    style: const TextStyle(
                      fontSize: AppTypography.caption,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.primary,
                    ),
                  ),
                ],
              ),
              if (basedOn.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: basedOn
                      .map((f) => Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.sm,
                              vertical: AppSpacing.xxs,
                            ),
                            decoration: BoxDecoration(
                              color: AppTheme.primary.withValues(alpha: 0.08),
                              borderRadius: AppRadius.rXs,
                              border: Border.all(
                                color: AppTheme.primary.withValues(alpha: 0.3),
                              ),
                            ),
                            child: Text(
                              _factorLabel(f).toUpperCase(),
                              style: const TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.primary,
                              ),
                            ),
                          ))
                      .toList(),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _orderDetails(
    Order order,
    List<String> basedOn,
    DateFormat dateFmt,
    BuildContext modalContext,
  ) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.65,
      maxChildSize: 0.9,
      minChildSize: 0.4,
      builder: (sheetContext, controller) => SingleChildScrollView(
        controller: controller,
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppTheme.onSurfaceVariant.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Row(
              children: [
                Text(
                  order.orderId,
                  style: AppTheme.monoStyle(
                    fontSize: AppTypography.bodyMd,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Spacer(),
                StatusBadge.priority(order.priority),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              order.itemType,
              style: const TextStyle(
                fontSize: AppTypography.titleLg,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _detailRow('Status', order.status),
            _detailRow('Target Date', dateFmt.format(order.targetDate)),
            _detailRow('ETA', dateFmt.format(order.estimatedCompletion)),
            const SizedBox(height: AppSpacing.lg),
            if (basedOn.isNotEmpty) ...[
              const Text(
                'Queue Factors (ETA rationale)',
                style: TextStyle(
                  fontSize: AppTypography.label,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: basedOn
                    .map((f) => Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md,
                            vertical: AppSpacing.xs + 1,
                          ),
                          decoration: BoxDecoration(
                            color: AppTheme.primary.withValues(alpha: 0.10),
                            borderRadius: AppRadius.rPill,
                            border: Border.all(
                              color: AppTheme.primary.withValues(alpha: 0.3),
                            ),
                          ),
                          child: Text(
                            _factorLabel(f),
                            style: const TextStyle(
                              fontSize: AppTypography.label,
                              color: AppTheme.primary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ))
                    .toList(),
              ),
              const SizedBox(height: AppSpacing.xl),
            ],
            if (order.status != 'Completed')
              FilledButton.icon(
                onPressed: () {
                  Navigator.pop(modalContext);
                  _advanceStatus(modalContext, order);
                },
                icon: const Icon(Icons.arrow_forward),
                label: const Text('Advance to Next Status'),
              ),
          ],
        ),
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs + 2),
      child: Row(
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: AppTypography.label,
                color: AppTheme.onSurfaceVariant,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: AppTypography.bodyMd,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
