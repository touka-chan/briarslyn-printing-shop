import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../theme/app_theme.dart';
import '../../utils/mock_data.dart';
import '../../utils/animations.dart';
import '../../app_router.dart';
import '../../models/order.dart';

/// The POS / Cashier home dashboard — the first tab in the Cashier shell.
///
/// Displays 4 KPI tiles with animated count-up, quick action buttons,
/// and a "Recent Orders" list using the signature job ticket cards.
/// Uses staggered fade-in entrance animation.
class CashierHomeScreen extends StatelessWidget {
  const CashierHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.xxl),
      child: StaggeredFadeIn(
        children: [
          // Welcome banner
          _buildWelcomeBanner(context),
          const SizedBox(height: AppSpacing.lg),
          _buildKpiSection(context),
          const SizedBox(height: AppSpacing.xl),
          _buildQuickActions(context),
          const SizedBox(height: AppSpacing.xl),
          _buildRecentOrders(context),
          const SizedBox(height: AppSpacing.xl),
          _buildTopCustomers(context),
        ],
      ),
    );
  }

  Widget _buildWelcomeBanner(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppTheme.primary,
            AppTheme.primary.withValues(alpha: 0.85),
          ],
        ),
        borderRadius: AppRadius.rLg,
        boxShadow: [
          BoxShadow(
            color: AppTheme.primary.withValues(alpha: 0.25),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Good day!',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppTheme.onPrimary.withValues(alpha: 0.85),
                      ),
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  'Welcome back, Maria',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        color: AppTheme.onPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  "Let's get those orders moving!",
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppTheme.onPrimary.withValues(alpha: 0.85),
                      ),
                ),
              ],
            ),
          ),
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppTheme.onPrimary.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.waving_hand_rounded,
              color: AppTheme.onPrimary,
              size: 32,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKpiSection(BuildContext context) {
    final kpis = mockKpis('cashier');
    final kpiData = [
      {
        'value': kpis['todayOrders'] as int,
        'label': "Today's Orders",
        'icon': Icons.receipt_long_rounded,
        'accentColor': AppTheme.statusInProduction,
        'change': '+12%',
        'changePositive': true,
        'sparkline': [8.0, 12.0, 10.0, 15.0, 13.0, 18.0, 23.0],
      },
      {
        'value': kpis['pending'] as int,
        'label': 'Pending',
        'icon': Icons.schedule_rounded,
        'accentColor': AppTheme.statusUrgent,
        'change': '+3%',
        'changePositive': true,
        'sparkline': [5.0, 4.0, 6.0, 5.0, 7.0, 8.0, 9.0],
      },
      {
        'value': (kpis['collected'] as num).toDouble(),
        'label': 'Collected Today',
        'icon': Icons.payments_rounded,
        'accentColor': AppTheme.statusCompleted,
        'change': '+8%',
        'changePositive': true,
        'prefix': '₱',
        'sparkline': [2800.0, 3200.0, 3100.0, 3600.0, 3400.0, 4100.0, 4350.0],
      },
      {
        'value': (kpis['avgPrepTime'] as num).toDouble(),
        'label': 'Avg. Prep Time (hrs)',
        'icon': Icons.timer_rounded,
        'accentColor': AppTheme.primary,
        'change': '-5 min',
        'changePositive': true,
        'sparkline': [3.2, 3.5, 3.1, 2.9, 2.7, 2.8, 2.5],
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const PfSectionHeader(
          title: 'Overview',
          subtitle: 'Key metrics for today',
        ),
        const SizedBox(height: AppSpacing.md),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: AppSpacing.md,
            crossAxisSpacing: AppSpacing.md,
            childAspectRatio: 1.0,
          ),
          itemCount: kpiData.length,
          itemBuilder: (context, index) {
            final data = kpiData[index];
            return PfMetricCard(
              value: data['value'] as num,
              label: data['label'] as String,
              icon: data['icon'] as IconData,
              accentColor: data['accentColor'] as Color,
              change: data['change'] as String,
              changePositive: data['changePositive'] as bool,
              sparklineData: data['sparkline'] as List<double>?,
              prefix: data['prefix'] as String? ?? '',
            );
          },
        ),
      ],
    );
  }

  Widget _buildQuickActions(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const PfSectionHeader(
          title: 'Quick Actions',
          subtitle: 'Common tasks',
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          children: [
            Expanded(
              child: PfButton.filled(
                label: 'New Order',
                icon: Icons.add_rounded,
                size: PfButtonSize.large,
                fullWidth: true,
                onPressed: () => _navigateToNewOrder(context),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: PfButton.outlined(
                label: 'View All',
                icon: Icons.list_alt_rounded,
                size: PfButtonSize.large,
                fullWidth: true,
                onPressed: () => _navigateToOrders(context),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildRecentOrders(BuildContext context) {
    final recentOrders = mockOrders.take(3).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        PfSectionHeader(
          title: 'Recent Orders',
          subtitle: 'Latest orders at a glance',
          action: TextButton(
            onPressed: () => _navigateToOrders(context),
            child: const Text('View All'),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        ...recentOrders.map((order) => Column(
          children: [
            PfJobTicket(
              order: order,
              onTap: () => _navigateToOrderDetail(context, order),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
        )),
      ],
    );
  }

  Widget _buildTopCustomers(BuildContext context) {
    // Build a top-3 customer list derived from mock data — single source
    // of truth, no hardcoded values.
    final byName = <String, _CustomerStats>{};
    for (final order in mockOrders) {
      final stats = byName.putIfAbsent(
        order.customerName,
        () => _CustomerStats(name: order.customerName),
      );
      stats.orderCount += 1;
      stats.totalSpent += order.paymentAmount;
      if (stats.lastOrderDate == null || order.createdAt!.isAfter(stats.lastOrderDate!)) {
        stats.lastOrderDate = order.createdAt;
      }
    }
    final top = byName.values.toList()
      ..sort((a, b) => b.totalSpent.compareTo(a.totalSpent));
    final top3 = top.take(3).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const PfSectionHeader(
          title: 'Top Customers',
          subtitle: 'Highest spenders this period',
        ),
        const SizedBox(height: AppSpacing.md),
        ...top3.map((c) => Column(
          children: [
            _CustomerTile(stats: c),
            const SizedBox(height: AppSpacing.md),
          ],
        )),
      ],
    );
  }

  void _navigateToNewOrder(BuildContext context) {
    HapticFeedback.selectionClick();
    context.pushNamed(AppRoutes.cashierNewOrder);
  }

  void _navigateToOrders(BuildContext context) {
    HapticFeedback.selectionClick();
    context.pushNamed(AppRoutes.cashierOrders);
  }

  void _navigateToOrderDetail(BuildContext context, Order order) {
    HapticFeedback.selectionClick();
    context.pushNamed(AppRoutes.cashierOrderDetail(order.orderId));
  }
}

/// Aggregated per-customer statistics used by the "Top Customers" section.
class _CustomerStats {
  _CustomerStats({required this.name});
  final String name;
  int orderCount = 0;
  double totalSpent = 0;
  DateTime? lastOrderDate;
}

/// Compact customer row used in the cashier home's "Top Customers" list.
class _CustomerTile extends StatelessWidget {
  const _CustomerTile({required this.stats});
  final _CustomerStats stats;

  String _fmt(DateTime d) =>
      '${d.month.toString().padLeft(2, "0")}/${d.day.toString().padLeft(2, "0")}';

  String _amount(double v) {
    final p = v.toStringAsFixed(2).split('.');
    final intPart = p[0];
    final dec = p[1];
    final b = StringBuffer();
    for (var i = 0; i < intPart.length; i++) {
      if (i > 0 && (intPart.length - i) % 3 == 0) b.write(',');
      b.write(intPart[i]);
    }
    return '${b.toString()}.$dec';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: AppRadius.rMd,
        border: Border.all(color: AppTheme.surfaceContainer),
      ),
      child: Row(
        children: [
          PfAvatar(name: stats.name, size: 40),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  stats.name,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  '${stats.orderCount} order${stats.orderCount == 1 ? '' : 's'}'
                  '${stats.lastOrderDate != null ? ' • last ${_fmt(stats.lastOrderDate!)}' : ''}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.onSurfaceVariant,
                      ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.xs,
            ),
            decoration: BoxDecoration(
              color: AppTheme.success.withValues(alpha: 0.12),
              borderRadius: AppRadius.rPill,
              border: Border.all(
                color: AppTheme.success.withValues(alpha: 0.30),
              ),
            ),
            child: Text(
              '₱${_amount(stats.totalSpent)}',
              style: AppTheme.monoStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppTheme.success,
              ),
            ),
          ),
        ],
      ),
    );
  }
}