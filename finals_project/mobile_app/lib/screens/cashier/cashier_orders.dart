import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app_router.dart';
import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../models/order.dart';
import '../../services/firebase_orders.dart' as fb_orders;
import '../../theme/app_theme.dart';

/// The Orders list screen for POS/Cashier.
///
/// Displays all orders in a filterable, searchable list using job ticket
/// cards. Subscribes live to Firestore — empty states render honestly when
/// the cashier has not yet created any orders.
class CashierOrdersScreen extends StatelessWidget {
  const CashierOrdersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return _CashierOrdersView();
  }
}

class _CashierOrdersView extends StatefulWidget {
  @override
  State<_CashierOrdersView> createState() => _CashierOrdersViewState();
}

class _CashierOrdersViewState extends State<_CashierOrdersView> {
  String _searchQuery = '';
  String _statusFilter = 'All';
  DateTime? _fromDate;
  DateTime? _toDate;
  final List<String> _statusFilters = [
    'All',
    'Pending',
    'In Production',
    'Ready for Pickup',
    'Completed',
  ];

  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Order> _filter(List<Order> orders) {
    return orders.where((order) {
      final matchesSearch = _searchQuery.isEmpty ||
          order.customerName.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          order.orderId.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          order.itemType.toLowerCase().contains(_searchQuery.toLowerCase());

      final matchesStatus =
          _statusFilter == 'All' || order.status == _statusFilter;

      final matchesFrom = _fromDate == null ||
          !order.targetDate.isBefore(
              DateTime(_fromDate!.year, _fromDate!.month, _fromDate!.day));
      final matchesTo = _toDate == null ||
          !order.targetDate.isAfter(
              DateTime(_toDate!.year, _toDate!.month, _toDate!.day));

      return matchesSearch && matchesStatus && matchesFrom && matchesTo;
    }).toList()
      ..sort((a, b) {
        final ad = a.createdAt;
        final bd = b.createdAt;
        if (ad == null && bd == null) return 0;
        if (ad == null) return 1;
        if (bd == null) return -1;
        // ad and bd are non-null here
        return b.createdAt!.compareTo(a.createdAt!);
      });
  }

  Future<void> _pickDateRange() async {
    final now = DateTime.now();
    final initial = DateTimeRange(
      start: _fromDate ?? now.subtract(const Duration(days: 7)),
      end: _toDate ?? now.add(const Duration(days: 14)),
    );
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 1),
      initialDateRange: initial,
    );
    if (range != null) {
      setState(() {
        _fromDate = range.start;
        _toDate = range.end;
      });
    }
  }

  bool get _hasDateFilter => _fromDate != null && _toDate != null;
  bool get _hasActiveFilter =>
      _searchQuery.isNotEmpty ||
      _statusFilter != 'All' ||
      _hasDateFilter;

  @override
  Widget build(BuildContext context) {
    // Show a back button only when this screen was pushed as a route
    // (e.g. from "View All" on the cashier home). When the screen is
    // hosted as a bottom-nav tab the modal route can't pop, so we
    // suppress the AppBar entirely to keep the tab layout clean.
    final canPop = ModalRoute.of(context)?.canPop ?? false;
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: canPop
          ? AppBar(
              title: const Text('All Orders'),
              backgroundColor: AppTheme.surface,
              foregroundColor: AppTheme.onSurface,
              elevation: 0,
              scrolledUnderElevation: 1,
              leading: IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: () => Navigator.of(context).pop(),
              ),
            )
          : null,
      body: SafeArea(
        top: canPop,
        child: StreamBuilder<List<Order>>(
          stream: fb_orders.subscribeOrdersStream(),
          builder: (context, snap) {
            final orders = snap.data ?? const <Order>[];
            final filtered = _filter(orders);
            return Column(
              children: [
                _SearchFilterBar(
                  searchController: _searchController,
                  searchQuery: _searchQuery,
                  onSearchChanged: (v) => setState(() => _searchQuery = v),
                  statusFilter: _statusFilter,
                  statusFilters: _statusFilters,
                  onStatusFilterChanged: (v) =>
                      setState(() => _statusFilter = v),
                  hasDateFilter: _hasDateFilter,
                  fromDate: _fromDate,
                  toDate: _toDate,
                  onPickDateRange: _pickDateRange,
                  onClearDateRange: () => setState(() {
                    _fromDate = null;
                    _toDate = null;
                  }),
                ),
                Expanded(
                  child: CustomScrollView(
                    slivers: [
                      const SliverPadding(
                        padding: EdgeInsets.only(top: AppSpacing.md),
                      ),
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(
                            AppSpacing.lg, 0, AppSpacing.lg, 0),
                        sliver: _buildOrdersList(context, filtered),
                      ),
                      const SliverPadding(
                        padding: EdgeInsets.only(bottom: AppSpacing.xxl),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildOrdersList(BuildContext context, List<Order> orders) {
    if (orders.isEmpty) {
      return SliverFillRemaining(
        hasScrollBody: false,
        child: _buildEmptyState(context),
      );
    }

    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) {
          final isLast = index == orders.length - 1;
          return Padding(
            padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacing.md),
            child: PfJobTicket(
              order: orders[index],
              onTap: () => _navigateToOrderDetail(orders[index]),
            ),
          );
        },
        childCount: orders.length,
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.receipt_long_outlined,
                size: 48,
                color: AppTheme.primary,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              _hasActiveFilter
                  ? 'No orders match your filters'
                  : 'No orders yet',
              style: Theme.of(context)
                  .textTheme
                  .headlineSmall
                  ?.copyWith(fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              _hasActiveFilter
                  ? 'Try adjusting your search or filter'
                  : 'Create your first order to get started',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppTheme.onSurfaceVariant,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.lg),
            if (_hasActiveFilter)
              PfButton.filled(
                label: 'Clear Filters',
                onPressed: () => setState(() {
                  _searchQuery = '';
                  _statusFilter = 'All';
                  _fromDate = null;
                  _toDate = null;
                  _searchController.clear();
                }),
              ),
          ],
        ),
      ),
    );
  }

  void _navigateToOrderDetail(Order order) {
    HapticFeedback.selectionClick();
    context.pushNamed(AppRoutes.cashierOrderDetail(order.orderId));
  }
}

/// Fixed search + status filter bar shown above the orders list.
class _SearchFilterBar extends StatelessWidget {
  const _SearchFilterBar({
    required this.searchController,
    required this.searchQuery,
    required this.onSearchChanged,
    required this.statusFilter,
    required this.statusFilters,
    required this.onStatusFilterChanged,
    required this.hasDateFilter,
    required this.fromDate,
    required this.toDate,
    required this.onPickDateRange,
    required this.onClearDateRange,
  });

  final TextEditingController searchController;
  final String searchQuery;
  final ValueChanged<String> onSearchChanged;
  final String statusFilter;
  final List<String> statusFilters;
  final ValueChanged<String> onStatusFilterChanged;
  final bool hasDateFilter;
  final DateTime? fromDate;
  final DateTime? toDate;
  final VoidCallback onPickDateRange;
  final VoidCallback onClearDateRange;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppTheme.background,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.md,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: PfTextField(
                  label: 'Search orders',
                  hintText: 'Search by name, ID, item...',
                  prefixIcon: Icons.search_rounded,
                  controller: searchController,
                  onChanged: onSearchChanged,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.lg),
                child: Material(
                  color: hasDateFilter
                      ? AppTheme.primary
                      : AppTheme.surfaceContainer,
                  shape: RoundedRectangleBorder(
                    borderRadius: AppRadius.rMd,
                  ),
                  child: InkWell(
                    borderRadius: AppRadius.rMd,
                    onTap: onPickDateRange,
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      child: Icon(
                        Icons.date_range_rounded,
                        color: hasDateFilter
                            ? AppTheme.onPrimary
                            : AppTheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          if (hasDateFilter && fromDate != null && toDate != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.xs,
                  ),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.12),
                    borderRadius: AppRadius.rPill,
                  ),
                  child: Text(
                    '${_fmt(fromDate!)} → ${_fmt(toDate!)}',
                    style: TextStyle(
                      fontSize: AppTypography.label,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.primary,
                    ),
                  ),
                ),
                const Spacer(),
                TextButton(
                  onPressed: onClearDateRange,
                  style: TextButton.styleFrom(
                    foregroundColor: AppTheme.primary,
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                    ),
                  ),
                  child: const Text('Clear'),
                ),
              ],
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            height: 36,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: statusFilters.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
              itemBuilder: (context, i) {
                final status = statusFilters[i];
                final isSelected = statusFilter == status;
                return ChoiceChip(
                  label: Text(status),
                  selected: isSelected,
                  onSelected: (_) {
                    HapticFeedback.selectionClick();
                    onStatusFilterChanged(status);
                  },
                  selectedColor: AppTheme.primary.withValues(alpha: 0.15),
                  labelStyle: TextStyle(
                    color: isSelected
                        ? AppTheme.primary
                        : AppTheme.onSurfaceVariant,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                  ),
                  side: BorderSide(
                    color: isSelected
                        ? AppTheme.primary
                        : Theme.of(context).colorScheme.outlineVariant,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: AppRadius.rMd,
                  ),
                  backgroundColor: AppTheme.surface,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  visualDensity: VisualDensity.compact,
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  String _fmt(DateTime d) =>
      '${d.month.toString().padLeft(2, "0")}/${d.day.toString().padLeft(2, "0")}';
}
