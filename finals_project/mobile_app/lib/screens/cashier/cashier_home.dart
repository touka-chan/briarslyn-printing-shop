import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app_router.dart';
import '../../auth/auth.dart';
import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../models/order.dart';
import '../../services/firebase_orders.dart' as fb_orders;
import '../../theme/app_theme.dart';
import '../../utils/animations.dart';

/// The POS / Cashier home dashboard - the first tab in the Cashier shell.
///
/// Displays 4 KPI tiles with animated count-up, quick action buttons,
/// and a "Recent Orders" list using the signature job ticket cards.
/// All data is streamed live from Firestore - empty states render
/// honestly when no orders have been created yet.
class CashierHomeScreen extends StatefulWidget {
  const CashierHomeScreen({super.key});

  @override
  State<CashierHomeScreen> createState() => _CashierHomeScreenState();
}

class _CashierHomeScreenState extends State<CashierHomeScreen> {
  int _feedNonce = 0;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<Order>>(
      key: ValueKey('orders-$_feedNonce'),
      stream: fb_orders.subscribeOrdersStream(),
      builder: (context, snap) {
        if (snap.hasError) {
          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.xxl),
            child: PfErrorCard(
              message:
                  'Live orders failed to load. Check your connection and permissions.',
              details: '${snap.error}',
              onRetry: () => setState(() => _feedNonce++),
            ),
          );
        }
        // First frame arrives with no data yet — show a loader, not a
        // silent all-zero dashboard.
        if (!snap.hasData) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.xxl),
              child: CircularProgressIndicator(),
            ),
          );
        }
        final orders = snap.data ?? const <Order>[];
        final kpis = _computeKpis(orders);
        final isEmpty = orders.isEmpty;
        return SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.xxl),
          child: StaggeredFadeIn(
            children: [
              _buildWelcomeBanner(context, orders),
              const SizedBox(height: AppSpacing.lg),
              _buildKpiSection(context, kpis, hasData: !isEmpty),
              const SizedBox(height: AppSpacing.xl),
              _buildQuickActions(context),
              const SizedBox(height: AppSpacing.xl),
              if (isEmpty)
                _buildEmptyOrders(context)
              else ...[
                _buildRecentOrders(context, orders),
                const SizedBox(height: AppSpacing.xl),
                _buildTopCustomers(context, orders),
              ],
            ],
          ),
        );
      },
    );
  }

  // ----------------------------------------------
  // KPI computation
  // ----------------------------------------------
  _CashierKpis _computeKpis(List<Order> orders) {
    final now = DateTime.now();
    int todayOrders = 0;
    int pending = 0;
    int collectedToday = 0;
    double collectedAmount = 0;
    double prepHoursTotal = 0;
    int prepSamples = 0;
    for (final o in orders) {
      if (o.createdAt != null && _isToday(o.createdAt!, now)) todayOrders++;
      if (o.status == 'Pending') pending++;
      // Collected Today = completed AND actually paid, attributed by
      // completion day (not creation day): created-yesterday but
      // completed-and-paid-today counts today. Legacy docs without
      // completedAt fall back to createdAt so they are not dropped.
      if (o.status == 'Completed' &&
          (o.paymentStatus == 'Paid' || o.paymentStatus == 'Full Paid')) {
        final doneAt = o.completedAt ?? o.createdAt;
        if (doneAt != null && _isToday(doneAt, now)) {
          collectedToday++;
          collectedAmount += o.paymentAmount;
        }
      }
      // Avg prep time: start-to-finish hours over completed orders that
      // carry both stamps (startedAt preferred, createdAt as fallback).
      if (o.status == 'Completed' && o.completedAt != null) {
        final start = o.startedAt ?? o.createdAt;
        if (start != null && !o.completedAt!.isBefore(start)) {
          prepHoursTotal +=
              o.completedAt!.difference(start).inMinutes / 60.0;
          prepSamples++;
        }
      }
    }
    return _CashierKpis(
      todayOrders: todayOrders,
      pending: pending,
      collectedTodayCount: collectedToday,
      collectedAmount: collectedAmount,
      avgPrepHours: prepSamples == 0 ? 0 : prepHoursTotal / prepSamples,
    );
  }

  bool _isToday(DateTime d, DateTime now) =>
      d.year == now.year && d.month == now.month && d.day == now.day;

  // ----------------------------------------------
  // Sections
  // ----------------------------------------------
  Widget _buildWelcomeBanner(BuildContext context, List<Order> orders) {
    final auth = AuthProvider.of(context);
    final name = auth.currentUser?.name ?? 'there';
    final firstName = name.split(' ').first;
    final hasOrders = orders.isNotEmpty;
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
                  'Welcome back, $firstName',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        color: AppTheme.onPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  hasOrders
                      ? "Let's get those orders moving!"
                      : 'Create your first order to get started.',
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
              size: AppIconSize.lg,
            ),
          ),
        ],
      ),
    );
  }

  // Build section
  Widget _buildKpiSection(BuildContext context, _CashierKpis kpis,
      {required bool hasData}) {
    final kpiData = [
      {
        'value': kpis.todayOrders.toDouble(),
        'label': "Today's Orders",
        'icon': Icons.receipt_long_rounded,
        'accentColor': AppTheme.statusInProduction,
        'prefix': '',
        'sparkline': const <double>[],
      },
      {
        'value': kpis.pending.toDouble(),
        'label': 'Pending',
        'icon': Icons.schedule_rounded,
        'accentColor': AppTheme.statusUrgent,
        'prefix': '',
        'sparkline': const <double>[],
      },
      {
        'value': kpis.collectedAmount,
        'label': 'Collected Today',
        'icon': Icons.payments_rounded,
        'accentColor': AppTheme.statusCompleted,
        'prefix': '₱',
        'sparkline': const <double>[],
      },
      {
        'value': kpis.avgPrepHours,
        'label': 'Avg. Prep Time (hrs)',
        'icon': Icons.timer_rounded,
        'accentColor': AppTheme.primary,
        'prefix': '',
        'sparkline': const <double>[],
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        PfSectionHeader(
          title: 'Overview',
          subtitle: hasData
              ? 'Key metrics for today'
              : 'No orders yet - metrics will appear once you create one',
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

  Widget _buildEmptyOrders(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const PfSectionHeader(
          title: 'Recent Orders',
          subtitle: 'Your latest activity will show here',
        ),
        const SizedBox(height: AppSpacing.md),
        Container(
          padding: const EdgeInsets.all(AppSpacing.xl),
          decoration: BoxDecoration(
            color: AppTheme.surface,
            borderRadius: AppRadius.rMd,
            border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
          ),
          child: Column(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.08),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.receipt_long_outlined,
                  color: AppTheme.primary,
                  size: 28,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              const Text(
                'No orders yet',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                  color: AppTheme.onSurface,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Tap "New Order" to create the first one.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppTheme.onSurfaceVariant,
                    ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildRecentOrders(BuildContext context, List<Order> orders) {
    final recent = orders.take(3).toList();
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
        ...recent.map((order) => Column(
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

  Widget _buildTopCustomers(BuildContext context, List<Order> orders) {
    final byName = <String, _CustomerStats>{};
    for (final order in orders) {
      // Same rule as Collected Today: only actually-paid orders count
      // toward spend. Unpaid tabs must not crown a "top customer".
      if (order.paymentStatus != 'Paid' &&
          order.paymentStatus != 'Full Paid') {
        continue;
      }
      final stats = byName.putIfAbsent(
        order.customerName,
        () => _CustomerStats(name: order.customerName),
      );
      stats.orderCount += 1;
      stats.totalSpent += order.paymentAmount;
      if (order.createdAt != null &&
          (stats.lastOrderDate == null ||
              order.createdAt!.isAfter(stats.lastOrderDate!))) {
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

  // ----------------------------------------------
  // Navigation
  // ----------------------------------------------
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

/// Aggregated KPIs for the cashier home - computed from the live orders
/// snapshot, no hardcoded values.
class _CashierKpis {
  const _CashierKpis({
    required this.todayOrders,
    required this.pending,
    required this.collectedTodayCount,
    required this.collectedAmount,
    required this.avgPrepHours,
  });
  final int todayOrders;
  final int pending;
  final int collectedTodayCount;
  final double collectedAmount;
  final double avgPrepHours;
}

/// Aggregated per-customer statistics used by the "Top Customers" section.
class _CustomerStats {
  _CustomerStats({required this.name});
  final String name;
  int orderCount = 1;
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
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
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
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  '${stats.orderCount} order${stats.orderCount == 1 ? '' : 's'}'
                  '${stats.lastOrderDate != null ? ' - last ${_fmt(stats.lastOrderDate!)}' : ''}',
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
                fontSize: AppTypography.label,
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
