import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../theme/app_theme.dart';
import '../../services/eta.dart' as eta;
import '../../services/firebase_orders.dart' as fb_orders;
import '../../utils/animations.dart';
import '../../models/order.dart';
import '../../app_router.dart';

/// The Production Queue - the first tab in the Production shell.
///
/// Live Firestore queue grouped by status (Pending, In Production,
/// Ready for Pickup) using signature job ticket cards.
/// Tapping a card opens the order detail screen.
///
/// Priority is derived live from each order's target date (same rule as
/// the web dashboard: Overdue < today, Urgent <= 2 days, else Upcoming),
/// so badges never go stale between writes.
class ProductionQueueScreen extends StatefulWidget {
  const ProductionQueueScreen({super.key});

  @override
  State<ProductionQueueScreen> createState() => _ProductionQueueScreenState();
}

class _ProductionQueueScreenState extends State<ProductionQueueScreen> {
  String _filter = 'All';
  int _feedNonce = 0;
  String _search = '';
  final _searchCtrl = TextEditingController();
  final List<String> _filters = ['All', 'Overdue', 'Urgent', 'Upcoming'];

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  int _priorityWeight(String priority) {
    return switch (priority) {
      'Overdue' => 0,
      'Urgent' => 1,
      _ => 2,
    };
  }

  /// Copy with freshly derived priority AND backlog-based ETA so badges,
  /// filters, KPIs, and dates always agree even when stored values go
  /// stale. Completed/cancelled orders keep their stored ETA (done).
  Order _withLiveDerived(Order o, List<Order> active, double rate) {
    final priority = eta.livePriority(o.targetDate);
    var completion = o.estimatedCompletion;
    List<String>? basedOn = o.basedOn;
    if (eta.isActiveStatus(o.status)) {
      final e = eta.liveEta(
        order: o,
        active: active,
        historyUnitsPerDay: rate,
      );
      completion = e.date;
      basedOn = e.basedOn;
    }
    if (priority == o.priority && completion == o.estimatedCompletion) {
      return o;
    }
    return Order(
      orderId: o.orderId,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      customerPhone: o.customerPhone,
      customerRegion: o.customerRegion,
      customerProvince: o.customerProvince,
      customerCity: o.customerCity,
      customerBarangay: o.customerBarangay,
      customerZip: o.customerZip,
      itemType: o.itemType,
      quantity: o.quantity,
      layoutFile: o.layoutFile,
      targetDate: o.targetDate,
      paymentAmount: o.paymentAmount,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      status: o.status,
      priority: priority,
      estimatedCompletion: completion,
      basedOn: basedOn,
      cashierId: o.cashierId,
      createdAt: o.createdAt,
      stockDeducted: o.stockDeducted,
      startedAt: o.startedAt,
      completedAt: o.completedAt,
    );
  }

  Map<String, List<Order>> _groupedOrders(List<Order> source) {
    final needle = _search.toLowerCase().trim();
    final orders = source.where((o) {
      if (o.status == 'Completed' || o.status == 'Cancelled') return false;
      if (_filter == 'Overdue' && o.priority != 'Overdue') return false;
      if (_filter == 'Urgent' && o.priority != 'Urgent') return false;
      if (_filter == 'Upcoming' && o.priority != 'Upcoming') return false;
      if (_filter == 'In Production' && o.status != 'In Production') {
        return false;
      }
      if (_filter == 'Ready for Pickup' && o.status != 'Ready for Pickup') {
        return false;
      }
      if (needle.isEmpty) return true;
      return o.orderId.toLowerCase().contains(needle) ||
          o.customerName.toLowerCase().contains(needle) ||
          o.itemType.toLowerCase().contains(needle);
    }).toList()
      ..sort((a, b) {
        final w = _priorityWeight(a.priority).compareTo(
          _priorityWeight(b.priority),
        );
        if (w != 0) return w;
        return a.targetDate.compareTo(b.targetDate);
      });

    final grouped = <String, List<Order>>{};
    for (final order in orders) {
      grouped.putIfAbsent(order.status, () => []).add(order);
    }
    return grouped;
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<Order>>(
      key: ValueKey('orders-$_feedNonce'),
      stream: fb_orders.subscribeOrdersStream(),
      builder: (context, snap) {
        if (snap.hasError) {
          return _buildErrorState(
            details: '${snap.error}',
            onRetry: () => setState(() => _feedNonce++),
          );
        }
        if (!snap.hasData) return _buildLoadingState();
        final raw = snap.data!;
        final active =
            raw.where((o) => eta.isActiveStatus(o.status)).toList();
        final rate = eta.completedUnitsLast7d(raw) / 7.0;
        final live =
            raw.map((o) => _withLiveDerived(o, active, rate)).toList();
        return _buildQueue(live);
      },
    );
  }

  Widget _buildLoadingState() {
    return const Center(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: AppSpacing.xxl),
        child: CircularProgressIndicator(),
      ),
    );
  }

  Widget _buildErrorState({String? details, VoidCallback? onRetry}) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.xxl, AppSpacing.lg, AppSpacing.xxl),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppTheme.statusOverdue.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.cloud_off_outlined,
                  size: 48, color: AppTheme.statusOverdue),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Couldn\'t load the queue',
              style: Theme.of(context)
                  .textTheme
                  .headlineSmall
                  ?.copyWith(fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Check your connection and try again.',
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: AppTheme.onSurfaceVariant),
              textAlign: TextAlign.center,
            ),
            if (details != null && details.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                details,
                style: AppTheme.monoStyle(
                  fontSize: 11,
                  color: AppTheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            if (onRetry != null) ...[
              const SizedBox(height: AppSpacing.md),
              PfButton.outlined(
                label: 'Retry',
                icon: Icons.refresh_rounded,
                onPressed: onRetry,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildQueue(List<Order> live) {
    final grouped = _groupedOrders(live);
    final totalActive = grouped.values.fold<int>(0, (sum, list) => sum + list.length);

    // KPI computations derived from the live queue (single source of truth).
    final activeOrders = live
        .where((o) => o.status != 'Completed' && o.status != 'Cancelled')
        .toList();
    final overdueCount =
        activeOrders.where((o) => o.priority == 'Overdue').length;
    final inProductionCount =
        activeOrders.where((o) => o.status == 'In Production').length;
    final readyCount =
        activeOrders.where((o) => o.status == 'Ready for Pickup').length;
    final onTimeCount =
        activeOrders.where((o) => o.priority != 'Overdue').length;
    final onTimeRate = activeOrders.isEmpty
        ? 100
        : ((onTimeCount / activeOrders.length) * 100).round();

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.xxl),
      child: StaggeredFadeIn(
        children: [
          // Search field - production staff often scan/look up an order ID.
          PfTextField(
            label: 'Search queue',
            hintText: 'Order ID, customer, item...',
            prefixIcon: Icons.search_rounded,
            controller: _searchCtrl,
            onChanged: (v) => setState(() => _search = v),
          ),
          const SizedBox(height: AppSpacing.md),
          // KPI strip - tappable; tapping a tile filters the queue below.
          _KpiStrip(
            overdue: overdueCount,
            inProduction: inProductionCount,
            ready: readyCount,
            onTimeRate: onTimeRate,
            activeFilter: _filter,
            onSelect: (filter) {
              HapticFeedback.selectionClick();
              setState(() => _filter = filter);
            },
          ),
          const SizedBox(height: AppSpacing.lg),
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
          if (activeOrders.isEmpty)
            _buildEmptyState()
          else if (totalActive == 0)
            _buildNoMatchState()
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

  Widget _buildNoMatchState() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxl),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppTheme.onSurfaceVariant.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.search_off_rounded,
                  size: 48, color: AppTheme.onSurfaceVariant),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'No matching orders',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Try a different search or filter.',
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

/// Tappable KPI strip shown at the top of the production queue. Each tile
/// represents a production health metric and acts as a quick filter for the
/// queue below. Mirrors the web dashboard's queue metrics (overdue, in
/// production, ready for pickup, on-time rate).
class _KpiStrip extends StatelessWidget {
  const _KpiStrip({
    required this.overdue,
    required this.inProduction,
    required this.ready,
    required this.onTimeRate,
    required this.activeFilter,
    required this.onSelect,
  });

  final int overdue;
  final int inProduction;
  final int ready;
  final int onTimeRate;
  final String activeFilter;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Adapt to screen width: 4 columns on wider devices, 2x2 on compact.
        final isWide = constraints.maxWidth >= 560;
        final tiles = <Widget>[
          _KpiTile(
            label: 'Overdue',
            value: '$overdue',
            icon: Icons.warning_amber_rounded,
            color: AppTheme.statusOverdue,
            isActive: activeFilter == 'Overdue',
            onTap: () => onSelect(activeFilter == 'Overdue' ? 'All' : 'Overdue'),
          ),
          _KpiTile(
            label: 'In Production',
            value: '$inProduction',
            icon: Icons.precision_manufacturing_rounded,
            color: AppTheme.statusInProduction,
            isActive: activeFilter == 'In Production',
            onTap: () => onSelect(
                activeFilter == 'In Production' ? 'All' : 'In Production'),
          ),
          _KpiTile(
            label: 'Ready',
            value: '$ready',
            icon: Icons.check_circle_outline_rounded,
            color: AppTheme.statusReadyForPickup,
            isActive: activeFilter == 'Ready for Pickup',
            onTap: () => onSelect(activeFilter == 'Ready for Pickup'
                ? 'All'
                : 'Ready for Pickup'),
          ),
          _KpiTile(
            label: 'On-time',
            value: '$onTimeRate%',
            icon: Icons.verified_outlined,
            color: AppTheme.statusCompleted,
            isActive: false,
            onTap: null,
          ),
        ];

        if (isWide) {
          return Row(
            children: [
              for (int i = 0; i < tiles.length; i++) ...[
                if (i > 0) const SizedBox(width: AppSpacing.md),
                Expanded(child: tiles[i]),
              ],
            ],
          );
        }
        return GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          mainAxisSpacing: AppSpacing.md,
          crossAxisSpacing: AppSpacing.md,
          childAspectRatio: 2.2,
          children: tiles,
        );
      },
    );
  }
}

/// A single KPI tile in the production dashboard strip.
class _KpiTile extends StatelessWidget {
  const _KpiTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.isActive,
    required this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final bool isActive;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tile = Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: AppRadius.rLg,
        border: Border.all(
          color: isActive ? color : AppTheme.surfaceContainer,
          width: isActive ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: isActive ? 0.16 : 0.06),
            blurRadius: isActive ? 16 : 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: AppRadius.rSm,
            ),
            child: Icon(icon, color: color, size: AppIconSize.md),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label.toUpperCase(),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        fontSize: 10,
                        letterSpacing: 0.6,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.onSurfaceVariant,
                      ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: AppTheme.monoStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.onSurface,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );

    if (onTap == null) return tile;
    return PressScale(onTap: onTap!, child: tile);
  }
}
