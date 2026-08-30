import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../theme/app_theme.dart';
import '../../utils/mock_data.dart';
import '../../utils/animations.dart';
import '../../app_router.dart';

/// The Customers screen for POS/Cashier.
///
/// Displays customer list with search, avatar, last order, and total spent.
/// Tap to view customer details (placeholder).
class CashierCustomersScreen extends StatelessWidget {
  const CashierCustomersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return _CashierCustomersView();
  }
}

class _CashierCustomersView extends StatefulWidget {
  @override
  State<_CashierCustomersView> createState() => _CashierCustomersViewState();
}

class _CashierCustomersViewState extends State<_CashierCustomersView> {
  String _searchQuery = '';
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> get _filteredCustomers {
    return mockCustomers.where((c) {
      final name = (c['name'] as String).toLowerCase();
      final email = (c['email'] as String).toLowerCase();
      final phone = c['phone'] as String;
      return name.contains(_searchQuery.toLowerCase()) ||
          email.contains(_searchQuery.toLowerCase()) ||
          phone.contains(_searchQuery);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: Column(
          children: [
            // Fixed search bar (NOT a sliver — slivers required
            // hardcoded minExtent == maxExtent and broke with "layoutExtent
            // exceeds paintExtent" when the real content was taller).
            _SearchFilterBar(
              searchController: _searchController,
              searchQuery: _searchQuery,
              onSearchChanged: (v) => setState(() => _searchQuery = v),
            ),
            // Scrollable list of customers
            Expanded(
              child: CustomScrollView(
                slivers: [
                  const SliverPadding(
                    padding: EdgeInsets.only(top: AppSpacing.md),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.lg, 0, AppSpacing.lg, 0),
                    sliver: _buildCustomersList(context),
                  ),
                  const SliverPadding(
                    padding: EdgeInsets.only(bottom: AppSpacing.xxl),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCustomersList(BuildContext context) {
    final customers = _filteredCustomers;
    if (customers.isEmpty) {
      return SliverFillRemaining(hasScrollBody: false, child: _buildEmptyState(context));
    }

    final children = <Widget>[];
    for (int i = 0; i < customers.length; i++) {
      if (i > 0) children.add(const SizedBox(height: AppSpacing.sm));
      children.add(_CustomerListTile(customer: customers[i]));
    }

    return SliverList(
      delegate: SliverChildListDelegate([
        StaggeredFadeIn(children: children),
      ]),
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
              child: Icon(Icons.people_outline, size: 48, color: AppTheme.primary),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              _searchQuery.isNotEmpty ? 'No customers found' : 'No customers yet',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              _searchQuery.isNotEmpty
                  ? 'Try a different search term'
                  : 'Customers will appear when orders are created',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.onSurfaceVariant),
              textAlign: TextAlign.center,
            ),
            if (_searchQuery.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.lg),
              PfButton.filled(
                label: 'Clear Search',
                onPressed: () {
                  setState(() {
                    _searchQuery = '';
                    _searchController.clear();
                  });
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Fixed search bar shown above the customers list.
///
/// This is a regular [Column] (not a sliver) so it can size itself to its
/// real content height without the SliverPersistentHeader constraints
/// that previously produced "layoutExtent exceeds paintExtent" assertions.
class _SearchFilterBar extends StatelessWidget {
  const _SearchFilterBar({
    required this.searchController,
    required this.searchQuery,
    required this.onSearchChanged,
  });

  final TextEditingController searchController;
  final String searchQuery;
  final ValueChanged<String> onSearchChanged;

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
      child: PfTextField(
        label: 'Search customers',
        hintText: 'Search by name, email, phone...',
        prefixIcon: Icons.search_rounded,
        controller: searchController,
        onChanged: onSearchChanged,
      ),
    );
  }
}

class _CustomerListTile extends StatelessWidget {
  const _CustomerListTile({required this.customer});

  final Map<String, dynamic> customer;

  @override
  Widget build(BuildContext context) {
    final name = customer['name'] as String;
    final email = customer['email'] as String;
    final phone = customer['phone'] as String;
    final totalSpent = (customer['totalSpent'] as num).toDouble();

    return PfCard(
      onTap: () {
        HapticFeedback.selectionClick();
        // Show customer profile bottom sheet with their orders
        showModalBottomSheet(
          context: context,
          backgroundColor: Colors.transparent,
          isScrollControlled: true,
          builder: (_) => Container(
            decoration: const BoxDecoration(
              color: AppTheme.surface,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: AppSpacing.md),
                      decoration: BoxDecoration(
                        color: AppTheme.surfaceContainer,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      PfAvatar(name: name, size: 60),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name,
                              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: AppSpacing.xxs),
                            if (email.isNotEmpty)
                              Text(
                                email,
                                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.onSurfaceVariant),
                              ),
                            if (phone.isNotEmpty)
                              Text(
                                phone,
                                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.onSurfaceVariant),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: AppTheme.statusCompleted.withValues(alpha: 0.1),
                      borderRadius: AppRadius.rMd,
                      border: Border.all(color: AppTheme.statusCompleted.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.payments_rounded, size: 16, color: AppTheme.statusCompleted),
                        const SizedBox(width: AppSpacing.sm),
                        Text(
                          'Total Spent: ₱${_formatAmount(totalSpent)}',
                          style: TextStyle(fontWeight: FontWeight.w700, color: AppTheme.statusCompleted),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  const PfSectionHeader(title: 'Customer Orders', subtitle: 'Previous orders'),
                  const SizedBox(height: AppSpacing.md),
                  // Show orders for this customer from mock data
                  ...mockOrders
                      .where((o) => o.customerName == name)
                      .map((o) => Column(
                            children: [
                              PfCard(
                                onTap: () => context.pushNamed(AppRoutes.cashierOrderDetail(o.orderId)),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(o.orderId, style: AppTheme.monoStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                                          const SizedBox(height: 2),
                                          Text(
                                            o.itemType + (o.quantity > 1 ? ' ×${o.quantity}' : ''),
                                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
                                          ),
                                        ],
                                      ),
                                    ),
                                    PfStatusBadge.orderStatus(o.status, size: PfBadgeSize.small),
                                  ],
                                ),
                              ),
                              const SizedBox(height: AppSpacing.sm),
                            ],
                          ))
                      ,
                  const SizedBox(height: AppSpacing.lg),
                  PfButton.filled(
                    label: 'Close',
                    fullWidth: true,
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
          ),
        );
      },
      child: Row(
        children: [
          // Avatar
          PfAvatar(
            name: name,
            size: 48,
          ),
          const SizedBox(width: AppSpacing.md),
          // Customer info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.xxs),
                Row(
                  children: [
                    Icon(Icons.email_outlined, size: AppIconSize.xs, color: AppTheme.onSurfaceVariant),
                    const SizedBox(width: AppSpacing.xs),
                    Expanded(
                      child: Text(
                        email,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.onSurfaceVariant),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xxs),
                Row(
                  children: [
                    Icon(Icons.phone_outlined, size: AppIconSize.xs, color: AppTheme.onSurfaceVariant),
                    const SizedBox(width: AppSpacing.xs),
                    Text(
                      phone,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Total spent
          Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppTheme.statusCompleted.withValues(alpha: 0.1),
              borderRadius: AppRadius.rMd,
              border: Border.all(color: AppTheme.statusCompleted.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  'Total',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: AppTheme.statusCompleted,
                        fontSize: 9,
                        letterSpacing: 0.5,
                      ),
                ),
                Text(
                  '₱${_formatAmount(totalSpent)}',
                  style: AppTheme.monoStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.statusCompleted,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatAmount(double amount) {
    final parts = amount.toStringAsFixed(2).split('.');
    final intPart = parts[0];
    final decPart = parts[1];

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