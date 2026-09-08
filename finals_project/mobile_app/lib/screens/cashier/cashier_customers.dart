import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app_router.dart';
import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../models/order.dart';
import '../../services/firebase_orders.dart' as fb_orders;
import '../../theme/app_theme.dart';
import '../../utils/animations.dart';

/// The Customers list screen for the POS Cashier.
///
/// In the Firestore schema, there is no dedicated `customers/` collection —
/// customer profiles are captured per-order at order-entry time. So this
/// screen derives the customer list live by grouping the `orders/` collection
/// on `customerName`. An "Add Customer" action is intentionally not provided
/// here: customers are created the first time an order is created in their
/// name on the "New Order" screen.
class CashierCustomersScreen extends StatefulWidget {
  const CashierCustomersScreen({super.key});

  @override
  State<CashierCustomersScreen> createState() => _CashierCustomersScreenState();
}

class _CashierCustomersScreenState extends State<CashierCustomersScreen> {
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        bottom: false,
        child: StreamBuilder<List<Order>>(
          stream: fb_orders.subscribeOrdersStream(),
          builder: (context, snap) {
            final orders = snap.data ?? const <Order>[];
            final customers = _buildCustomers(orders);
            final filtered = _filter(customers);
            return Column(
              children: [
                _buildHeader(context, customerCount: customers.length),
                _buildSearchBar(context),
                Expanded(
                  child: filtered.isEmpty
                      ? _buildEmptyState(
                          context,
                          hasOrders: orders.isNotEmpty,
                          hasQuery: _searchQuery.isNotEmpty,
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.lg,
                            0,
                            AppSpacing.lg,
                            AppSpacing.xxl,
                          ),
                          itemCount: filtered.length,
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: AppSpacing.md),
                          itemBuilder: (context, i) {
                            final c = filtered[i];
                            return _CustomerListTile(
                              customer: c,
                              onTap: () => _navigateToOrders(context),
                            );
                          },
                        ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────
  // Derivation: orders → customers
  // ──────────────────────────────────────────────
  List<_Customer> _buildCustomers(List<Order> orders) {
    final byName = <String, _CustomerAcc>{};
    for (final o in orders) {
      final name = o.customerName.trim();
      if (name.isEmpty) continue;
      final acc = byName.putIfAbsent(
        name,
        () => _CustomerAcc(
          name: name,
          email: o.customerEmail,
          phone: o.customerPhone,
        ),
      );
      // Prefer the most recent non-empty contact info.
      if ((acc.email == null || acc.email!.isEmpty) &&
          (o.customerEmail != null && o.customerEmail!.isNotEmpty)) {
        acc.email = o.customerEmail;
      }
      if ((acc.phone == null || acc.phone!.isEmpty) &&
          (o.customerPhone != null && o.customerPhone!.isNotEmpty)) {
        acc.phone = o.customerPhone;
      }
      acc.orderCount += 1;
      acc.totalSpent += o.paymentAmount;
      final created = o.createdAt;
      if (created != null &&
          (acc.lastOrderDate == null || created.isAfter(acc.lastOrderDate!))) {
        acc.lastOrderDate = created;
      }
    }
    final list = byName.values
        .map((a) => _Customer(
              name: a.name,
              email: a.email,
              phone: a.phone,
              orderCount: a.orderCount,
              totalSpent: a.totalSpent,
              lastOrderDate: a.lastOrderDate,
            ))
        .toList()
      ..sort((a, b) {
        // Highest spenders first; ties broken by most recent order.
        final bySpend = b.totalSpent.compareTo(a.totalSpent);
        if (bySpend != 0) return bySpend;
        final ad = a.lastOrderDate;
        final bd = b.lastOrderDate;
        if (ad == null && bd == null) return 0;
        if (ad == null) return 1;
        if (bd == null) return -1;
        return bd.compareTo(ad);
      });
    return list;
  }

  List<_Customer> _filter(List<_Customer> customers) {
    if (_searchQuery.isEmpty) return customers;
    final q = _searchQuery.toLowerCase();
    return customers.where((c) {
      if (c.name.toLowerCase().contains(q)) return true;
      final e = c.email;
      if (e != null && e.toLowerCase().contains(q)) return true;
      final p = c.phone;
      if (p != null && p.toLowerCase().contains(q)) return true;
      return false;
    }).toList();
  }

  // ──────────────────────────────────────────────
  // Header / search / empty state
  // ──────────────────────────────────────────────
  Widget _buildHeader(BuildContext context, {required int customerCount}) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.sm,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Customers',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  customerCount == 0
                      ? 'Derived from your orders'
                      : '$customerCount customer${customerCount == 1 ? '' : 's'} derived from orders',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppTheme.onSurfaceVariant,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.sm,
        AppSpacing.lg,
        AppSpacing.md,
      ),
      child: PfTextField(
        label: 'Search customers',
        hintText: 'Search by name, email, or phone',
        prefixIcon: Icons.search_rounded,
        onChanged: (v) => setState(() => _searchQuery = v),
      ),
    );
  }

  Widget _buildEmptyState(
    BuildContext context, {
    required bool hasOrders,
    required bool hasQuery,
  }) {
    final IconData icon;
    final String title;
    final String subtitle;
    if (hasQuery) {
      icon = Icons.search_off_rounded;
      title = 'No customers match your search';
      subtitle = 'Try a different name, email, or phone.';
    } else if (hasOrders) {
      icon = Icons.people_alt_outlined;
      title = 'No customers yet';
      subtitle =
          'Customer profiles are created automatically when an order is created in their name.';
    } else {
      icon = Icons.people_alt_outlined;
      title = 'No customers yet';
      subtitle =
          'Create your first order to add a customer. They will appear here.';
    }
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
              child: Icon(icon, size: 48, color: AppTheme.primary),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              title,
              style: Theme.of(context)
                  .textTheme
                  .headlineSmall
                  ?.copyWith(fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              subtitle,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppTheme.onSurfaceVariant,
                  ),
              textAlign: TextAlign.center,
            ),
            if (!hasQuery && !hasOrders) ...[
              const SizedBox(height: AppSpacing.lg),
              PfButton.filled(
                label: 'New Order',
                icon: Icons.add_rounded,
                onPressed: () => _navigateToNewOrder(context),
              ),
            ],
          ],
        ),
      ),
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
}

/// A derived customer — not a stored entity, just an aggregation of orders.
class _Customer {
  const _Customer({
    required this.name,
    this.email,
    this.phone,
    required this.orderCount,
    required this.totalSpent,
    this.lastOrderDate,
  });
  final String name;
  final String? email;
  final String? phone;
  final int orderCount;
  final double totalSpent;
  final DateTime? lastOrderDate;
}

class _CustomerAcc {
  _CustomerAcc({required this.name, this.email, this.phone});
  final String name;
  String? email;
  String? phone;
  int orderCount = 0;
  double totalSpent = 0;
  DateTime? lastOrderDate;
}

/// Compact customer row used in the cashier customers list.
class _CustomerListTile extends StatelessWidget {
  const _CustomerListTile({required this.customer, required this.onTap});

  final _Customer customer;
  final VoidCallback onTap;

  String _fmt(DateTime d) =>
      '${d.month.toString().padLeft(2, "0")}/${d.day.toString().padLeft(2, "0")}/${d.year}';

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
    final subtitleParts = <String>[
      '${customer.orderCount} order${customer.orderCount == 1 ? '' : 's'}',
    ];
    if (customer.lastOrderDate != null) {
      subtitleParts.add('last ${_fmt(customer.lastOrderDate!)}');
    }
    final subtitle = subtitleParts.join(' • ');

    return PressScale(
      onTap: onTap,
      child: PfCard(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            PfAvatar(name: customer.name, size: 44),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    customer.name,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppTheme.onSurfaceVariant,
                        ),
                  ),
                  if (customer.email != null || customer.phone != null) ...[
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      [
                        if (customer.email != null) customer.email!,
                        if (customer.phone != null) customer.phone!,
                      ].join(' • '),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppTheme.onSurfaceVariant,
                          ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
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
                '₱${_amount(customer.totalSpent)}',
                style: AppTheme.monoStyle(
                  fontSize: AppTypography.label,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.success,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
