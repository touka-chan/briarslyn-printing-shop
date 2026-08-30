import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../theme/app_theme.dart';
import '../../utils/mock_data.dart';
import '../../utils/animations.dart';
import '../../models/order.dart';
import '../../app_router.dart';

/// The Production Queue — the first tab in the Production shell.
///
/// Displays production orders grouped by status (Overdue, In Production,
/// Ready for Pickup) using signature job ticket cards.
/// Tapping a card opens the order detail screen.
class ProductionQueueScreen extends StatefulWidget {
  const ProductionQueueScreen({super.key});

  @override
  State<ProductionQueueScreen> createState() => _ProductionQueueScreenState();
}

class _ProductionQueueScreenState extends State<ProductionQueueScreen> {
  String _filter = 'All';
  final List<String> _filters = ['All', 'Overdue', 'Urgent', 'Upcoming'];

  Map<String, List<Order>> get _groupedOrders {
    final orders = mockOrders.where((o) {
      if (_filter == 'All') return o.status != 'Completed';
      if (_filter == 'Overdue') return o.priority == 'Overdue' && o.status != 'Completed';
      if (_filter == 'Urgent') return o.priority == 'Urgent' && o.status != 'Completed';
      if (_filter == 'Upcoming') return o.priority == 'Upcoming' && o.status != 'Completed';
      return true;
    }).toList();

    final grouped = <String, List<Order>>{};
    for (final order in orders) {
      grouped.putIfAbsent(order.status, () => []).add(order);
    }
    return grouped;
  }

  @override
  Widget build(BuildContext context) {
    final grouped = _groupedOrders;
    final totalActive = grouped.values.fold<int>(0, (sum, list) => sum + list.length);

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.xxl),
      child: StaggeredFadeIn(
        children: [
          // Filter chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: _filters.map((filter) {
                final isSelected = _filter == filter;
                return Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.sm),
                  child: ChoiceChip(
                    label: Text(filter),
                    selected: isSelected,
                    onSelected: (_) {
                      HapticFeedback.selectionClick();
                      setState(() => _filter = filter);
                    },
                    selectedColor: AppTheme.primary.withValues(alpha: 0.15),
                    labelStyle: TextStyle(
                      color: isSelected ? AppTheme.primary : AppTheme.onSurfaceVariant,
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                    ),
                    side: BorderSide(
                      color: isSelected ? AppTheme.primary : AppTheme.surfaceContainer,
                    ),
                    shape: RoundedRectangleBorder(borderRadius: AppRadius.rMd),
                    backgroundColor: AppTheme.surface,
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          // Active count summary
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: AppTheme.statusInProduction.withValues(alpha: 0.15),
                  borderRadius: AppRadius.rMd,
                ),
                child: Icon(
                  Icons.precision_manufacturing_rounded,
                  color: AppTheme.statusInProduction,
                  size: AppIconSize.md,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$totalActive active orders',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    Text(
                      'Currently in production pipeline',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          // Grouped sections
          if (totalActive == 0)
            _buildEmptyState()
          else
            ..._buildSections(grouped),
        ],
      ),
    );
  }

  List<Widget> _buildSections(Map<String, List<Order>> grouped) {
    final sectionOrder = ['Pending', 'In Production', 'Ready for Pickup'];
    final widgets = <Widget>[];

    for (final status in sectionOrder) {
      final orders = grouped[status] ?? [];
      if (orders.isEmpty) continue;

      final color = _statusColor(status);
      widgets.add(
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.md),
          child: Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                status,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 2),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: AppRadius.rSm,
                ),
                child: Text(
                  '${orders.length}',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
              ),
            ],
          ),
        ),
      );

      for (int i = 0; i < orders.length; i++) {
        final order = orders[i];
        widgets.add(
          PfJobTicket(
            order: order,
            onTap: () => _navigateToOrderDetail(order),
          ),
        );
        if (i < orders.length - 1) {
          widgets.add(const SizedBox(height: AppSpacing.md));
        }
      }
      widgets.add(const SizedBox(height: AppSpacing.xl));
    }

    return widgets;
  }

  Widget _buildEmptyState() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxl),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppTheme.statusCompleted.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.task_alt_rounded, size: 48, color: AppTheme.statusCompleted),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'All caught up!',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'No active orders in production',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.onSurfaceVariant),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'Pending':
        return AppTheme.statusUrgent;
      case 'In Production':
        return AppTheme.statusInProduction;
      case 'Ready for Pickup':
        return AppTheme.statusReadyForPickup;
      case 'Completed':
        return AppTheme.statusCompleted;
      default:
        return AppTheme.onSurfaceVariant;
    }
  }

  void _navigateToOrderDetail(Order order) {
    HapticFeedback.lightImpact();
    context.pushNamed(AppRoutes.productionOrderDetail(order.orderId));
  }
}