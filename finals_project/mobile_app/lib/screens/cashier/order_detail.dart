import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app_router.dart';
import '../../auth/auth.dart';
import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../theme/app_theme.dart';
import '../../utils/animations.dart';
import '../../utils/mock_data.dart';
import '../../models/order.dart';
import '../../services/services.dart';

/// The Order Detail screen — shared between Cashier and Production.
///
/// Shows full order info, status timeline, customer info,
/// production details, payment, and contextual actions.
class OrderDetailScreen extends StatelessWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  final String orderId;

  Order? get _order {
    try {
      return mockOrders.firstWhere((o) => o.orderId == orderId);
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;

    if (order == null) {
      return Scaffold(
        backgroundColor: AppTheme.background,
        appBar: AppBar(
          title: const Text('Order Not Found'),
          backgroundColor: AppTheme.surface,
          foregroundColor: AppTheme.onSurface,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded),
            onPressed: () => Navigator.pop(context),
          ),
        ),
        body: const Center(
          child: Text('Order not found'),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: true,
              backgroundColor: AppTheme.surface,
              foregroundColor: AppTheme.onSurface,
              elevation: 0,
              leading: IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: () => Navigator.pop(context),
              ),
              title: Text('Order ${order.orderId}'),
              actions: [
                IconButton(
                  icon: const Icon(Icons.share_outlined),
                  onPressed: () {
                    HapticFeedback.selectionClick();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Share order - coming soon'),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  },
                  tooltip: 'Share',
                ),
                IconButton(
                  icon: const Icon(Icons.more_vert_rounded),
                  onPressed: () => _showMoreMenu(context),
                  tooltip: 'More',
                ),
              ],
            ),
            SliverPadding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              sliver: SliverList.list(
                children: [
                  StaggeredFadeIn(
                    stagger: const Duration(milliseconds: 80),
                    duration: const Duration(milliseconds: 350),
                    children: <Widget>[
                      // Hero job ticket card
                      PfJobTicket(order: order),
                      const SizedBox(height: AppSpacing.lg),

                      // Status timeline
                      _buildStatusTimeline(context, order),
                      const SizedBox(height: AppSpacing.lg),

                      // Customer info
                      _buildCustomerInfo(context, order),
                      const SizedBox(height: AppSpacing.lg),

                      // Order specifications
                      _buildOrderSpecs(context, order),
                      const SizedBox(height: AppSpacing.lg),

                      // Payment summary
                      _buildPaymentSummary(context, order),
                      const SizedBox(height: AppSpacing.lg),

                      // Actions
                      _buildActions(context, order),
                      const SizedBox(height: AppSpacing.xl),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusTimeline(BuildContext context, Order order) {
    return PfCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const PfSectionHeader(
            title: 'Order Status',
            subtitle: 'Production progress',
          ),
          const SizedBox(height: AppSpacing.lg),
          _StatusTimeline(currentStatus: order.status),
        ],
      ),
    );
  }

  Widget _buildCustomerInfo(BuildContext context, Order order) {
    final canViewCustomer = order.customerName.isNotEmpty;

    final card = PfCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const PfSectionHeader(
                title: 'Customer',
                subtitle: 'Contact information',
              ),
              const Spacer(),
              if (canViewCustomer)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xxs),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.1),
                    borderRadius: AppRadius.rPill,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.arrow_forward_rounded, size: AppIconSize.xs, color: AppTheme.primary),
                      const SizedBox(width: AppSpacing.xxs),
                      Text('View profile', style: TextStyle(fontSize: AppTypography.caption, fontWeight: FontWeight.w600, color: AppTheme.primary)),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              PfAvatar(
                name: order.customerName,
                size: 48,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order.customerName,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    if (order.customerEmail != null) ...[
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        order.customerEmail!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.onSurfaceVariant),
                      ),
                    ],
                    if (order.customerPhone != null) ...[
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        order.customerPhone!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.onSurfaceVariant),
                      ),
                    ],
                    if (_hasAddress(order)) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            Icons.location_on_outlined,
                            size: AppIconSize.sm,
                            color: AppTheme.onSurfaceVariant,
                          ),
                          const SizedBox(width: AppSpacing.xxs),
                          Expanded(
                            child: Text(
                              _addressSummary(order),
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.onSurfaceVariant),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.phone_rounded),
                onPressed: () {
                  HapticFeedback.selectionClick();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Call ${order.customerName}'),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                },
                tooltip: 'Call',
              ),
              IconButton(
                icon: const Icon(Icons.message_rounded),
                onPressed: () {
                  HapticFeedback.selectionClick();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Message ${order.customerName}'),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                },
                tooltip: 'Message',
              ),
            ],
          ),
        ],
      ),
    );
    if (!canViewCustomer) return card;
    return PressScale(
      onTap: () => _viewCustomerDetails(context, order),
      child: card,
    );
  }

  void _viewCustomerDetails(BuildContext context, Order order) {
    HapticFeedback.selectionClick();
    // Show customer profile with their orders
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => Container(
        decoration: const BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
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
                  PfAvatar(name: order.customerName, size: 60),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          order.customerName,
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        if (order.customerEmail != null)
                          Text(
                            order.customerEmail!,
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.onSurfaceVariant),
                          ),
                        if (order.customerPhone != null)
                          Text(
                            order.customerPhone!,
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.onSurfaceVariant),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              const PfSectionHeader(title: 'Customer Orders', subtitle: 'Previous and current orders'),
              const SizedBox(height: AppSpacing.md),
              // Show mock orders for this customer
              ...mockOrders
                  .where((o) => o.customerName == order.customerName)
                  .map((o) => Column(
                    children: [
                      PressScale(
                        onTap: () => Navigator.pushNamed(context, AppRoutes.cashierOrderDetail(o.orderId)),
                        child: PfCard(
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    o.orderId,
                                    style: AppTheme.monoStyle(fontSize: AppTypography.bodySm, fontWeight: FontWeight.w600),
                                  ),
                                  const SizedBox(height: AppSpacing.xxs),
                                  Text(
                                    o.itemType,
                                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
                                  ),
                                ],
                              ),
                            ),
                            PfStatusBadge.orderStatus(o.status, size: PfBadgeSize.small),
                          ],
                        ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                    ],
                  )),
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
  }

  Widget _buildOrderSpecs(BuildContext context, Order order) {
    return PfCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const PfSectionHeader(
            title: 'Order Details',
            subtitle: 'Specifications',
          ),
          const SizedBox(height: AppSpacing.md),
          _SpecRow(label: 'Item Type', value: order.itemType),
          _SpecRow(label: 'Quantity', value: '${order.quantity}'),
          _SpecRow(
            label: 'Layout File',
            value: order.layoutFile,
          ),
          if (order.createdAt != null)
            _SpecRow(
              label: 'Order Date',
              value: '${order.createdAt!.day}/${order.createdAt!.month}/${order.createdAt!.year}',
            ),
          _SpecRow(
            label: 'Target Date',
            value: '${order.targetDate.day}/${order.targetDate.month}/${order.targetDate.year}',
          ),
          _SpecRow(
            label: 'Estimated Completion',
            value: '${order.estimatedCompletion.day}/${order.estimatedCompletion.month}/${order.estimatedCompletion.year}',
          ),
          if (order.basedOn != null && order.basedOn!.isNotEmpty)
            _SpecRow(
              label: 'Based On',
              value: order.basedOn!.map((e) => e.replaceAll('_', ' ')).join(', '),
            ),
        ],
      ),
    );
  }

  Widget _buildPaymentSummary(BuildContext context, Order order) {
    final isPaid = order.paymentStatus == 'Paid';
    final isPartial = order.paymentStatus == 'Partial';
    final color = isPaid
        ? AppTheme.statusCompleted
        : isPartial
            ? AppTheme.statusReadyForPickup
            : AppTheme.statusUrgent;

    return PfCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const PfSectionHeader(
            title: 'Payment',
            subtitle: 'Financial summary',
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Total Amount', style: Theme.of(context).textTheme.bodyMedium),
              Text(
                '₱${_formatAmount(order.paymentAmount)}',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: AppRadius.rMd,
              border: Border.all(color: color.withValues(alpha: 0.3)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isPaid
                      ? Icons.check_circle_rounded
                      : isPartial
                          ? Icons.hourglass_top_rounded
                          : Icons.error_outline_rounded,
                  size: AppIconSize.sm,
                  color: color,
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  'Payment: ${order.paymentStatus ?? 'Unknown'}',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActions(BuildContext context, Order order) {
    final auth = AuthProvider.of(context);
    final isCashier = auth.isCashier;
    final isProduction = auth.isProduction;
    final canCancel = order.status == 'Pending' || order.status == 'Overdue' || order.status == 'Urgent';

    return Column(
      children: [
        // Cashier actions: Payment status update
        if (isCashier && order.paymentStatus != 'Paid')
          PermissionGate(
            permission: Permission.orderUpdatePayment,
            child: PfButton.filled(
              label: 'Mark as Paid',
              icon: Icons.payment_rounded,
              fullWidth: true,
              size: PfButtonSize.large,
              onPressed: () => _updatePaymentStatus(context, order, 'Paid'),
            ),
          ),
        if (isCashier && order.paymentStatus == 'Paid')
          PermissionGate(
            permission: Permission.orderUpdatePayment,
            child: PfButton.outlined(
              label: 'Payment Status: Paid',
              icon: Icons.check_circle_rounded,
              fullWidth: true,
              size: PfButtonSize.large,
              onPressed: () {},
            ),
          ),

        // Production actions: Advance production status
        if (isProduction && order.status != 'Completed' && order.status != 'Cancelled')
          PermissionGate(
            permission: Permission.orderUpdateStatus,
            child: PfButton.filled(
              label: _nextActionLabel(order.status),
              icon: _nextActionIcon(order.status),
              fullWidth: true,
              size: PfButtonSize.large,
              onPressed: () => _advanceProductionStatus(context, order),
            ),
          ),

        // Both roles can cancel before production
        if (canCancel && (isCashier || isProduction))
          PermissionGate(
            permission: Permission.orderCancel,
            child: PfButton.outlined(
              label: 'Cancel Order',
              icon: Icons.cancel_outlined,
              fullWidth: true,
              size: PfButtonSize.large,
              onPressed: () => _confirmCancelOrder(context, order),
            ),
          ),
      ],
    );
  }

  String _nextActionLabel(String status) {
    switch (status) {
      case 'Pending':
        return 'Send to Production';
      case 'In Production':
        return 'Mark Ready for Pickup';
      case 'Ready for Pickup':
        return 'Mark as Completed';
      default:
        return 'Advance Status';
    }
  }

  IconData _nextActionIcon(String status) {
    switch (status) {
      case 'Pending':
        return Icons.send_rounded;
      case 'In Production':
        return Icons.check_circle_outline_rounded;
      case 'Ready for Pickup':
        return Icons.task_alt_rounded;
      default:
        return Icons.arrow_forward_rounded;
    }
  }

  Future<void> _updatePaymentStatus(BuildContext context, Order order, String newStatus) async {
    final auth = AuthProvider.of(context);
    try {
      await OrderService.updatePaymentStatus(
        orderId: order.orderId,
        newPaymentStatus: newStatus,
        auth: auth,
      );
      if (!context.mounted) return;
      HapticFeedback.mediumImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Payment status updated to $newStatus'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      // Force rebuild by popping and pushing again
      Navigator.pop(context);
      Navigator.pushNamed(context, AppRoutes.cashierOrderDetail(order.orderId));
    } on PermissionDeniedException catch (e) {
      if (!context.mounted) return;
      HapticFeedback.heavyImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: AppTheme.statusUrgent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _advanceProductionStatus(BuildContext context, Order order) async {
    final auth = AuthProvider.of(context);
    try {
      await OrderService.advanceStatus(
        orderId: order.orderId,
        auth: auth,
      );
      if (!context.mounted) return;
      HapticFeedback.mediumImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Production status advanced'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.pop(context);
      Navigator.pushNamed(context, AppRoutes.productionOrderDetail(order.orderId));
    } on PermissionDeniedException catch (e) {
      if (!context.mounted) return;
      HapticFeedback.heavyImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: AppTheme.statusUrgent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on StateError catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: AppTheme.statusUrgent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _confirmCancelOrder(BuildContext context, Order order) {
    HapticFeedback.mediumImpact();
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cancel Order?'),
        content: Text('Order ${order.orderId} will be cancelled. This cannot be undone once sent to production.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Keep'),
          ),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: AppTheme.statusOverdue),
            onPressed: () async {
              Navigator.pop(context);
              final auth = AuthProvider.of(context);
              try {
                await OrderService.cancelOrder(
                  orderId: order.orderId,
                  auth: auth,
                );
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Order cancelled'),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
                Navigator.pop(context);
                // Navigate back to appropriate list
                if (auth.isCashier) {
                  Navigator.pushNamed(context, AppRoutes.cashierOrders);
                } else {
                  Navigator.pushNamed(context, AppRoutes.productionQueue);
                }
              } on PermissionDeniedException catch (e) {
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(e.message),
                    backgroundColor: AppTheme.statusUrgent,
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              }
            },
            child: const Text('Cancel'),
          ),
        ],
      ),
    );
  }

  void _showMoreMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (sheetContext) => Container(
        decoration: const BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
        ),
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: AppSpacing.md),
              decoration: BoxDecoration(
                color: AppTheme.surfaceContainer,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.cancel_outlined),
              title: const Text('Cancel Order'),
              onTap: () {
                Navigator.pop(sheetContext);
                HapticFeedback.mediumImpact();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Cancel order - coming soon'),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.content_copy_rounded),
              title: const Text('Duplicate Order'),
              onTap: () {
                Navigator.pop(sheetContext);
                HapticFeedback.selectionClick();
              },
            ),
            ListTile(
              leading: const Icon(Icons.report_outlined),
              title: const Text('Report Issue'),
              onTap: () {
                Navigator.pop(sheetContext);
                HapticFeedback.selectionClick();
              },
            ),
          ],
        ),
      ),
    );
  }

  /// Returns true if the order has at least one address component set.
  /// Used to decide whether to render the address line under the contact
  /// info — orders captured before the address cascade was added will
  /// skip this block entirely.
  bool _hasAddress(Order order) {
    return (order.customerRegion != null && order.customerRegion!.isNotEmpty) ||
        (order.customerProvince != null && order.customerProvince!.isNotEmpty) ||
        (order.customerCity != null && order.customerCity!.isNotEmpty) ||
        (order.customerBarangay != null && order.customerBarangay!.isNotEmpty) ||
        (order.customerZip != null && order.customerZip!.isNotEmpty);
  }

  /// Composes a one-line summary of the customer's address, omitting any
  /// missing parts. Mirrors `UserAddress.summary()` on the web, with the
  /// region prepended so the cashier can tell at a glance which
  /// province / region the order ships to.
  String _addressSummary(Order order) {
    final parts = <String>[
      if (order.customerBarangay != null && order.customerBarangay!.isNotEmpty)
        order.customerBarangay!,
      if (order.customerCity != null && order.customerCity!.isNotEmpty)
        order.customerCity!,
      if (order.customerProvince != null && order.customerProvince!.isNotEmpty)
        order.customerProvince!,
      if (order.customerZip != null && order.customerZip!.isNotEmpty)
        order.customerZip!,
    ];
    if (order.customerRegion != null && order.customerRegion!.isNotEmpty) {
      parts.add(order.customerRegion!);
    }
    return parts.join(', ');
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

class _StatusTimeline extends StatelessWidget {
  const _StatusTimeline({required this.currentStatus});

  final String currentStatus;

  static const List<_TimelineStage> _stages = [
    _TimelineStage('Pending', Icons.schedule_rounded, AppTheme.statusUrgent),
    _TimelineStage('In Production', Icons.construction_rounded, AppTheme.statusInProduction),
    _TimelineStage('Ready for Pickup', Icons.check_circle_outline_rounded, AppTheme.statusReadyForPickup),
    _TimelineStage('Completed', Icons.task_alt_rounded, AppTheme.statusCompleted),
  ];

  int get _currentIndex {
    switch (currentStatus) {
      case 'Pending':
        return 0;
      case 'In Production':
        return 1;
      case 'Ready for Pickup':
        return 2;
      case 'Completed':
        return 3;
      default:
        return 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (currentStatus == 'Cancelled') {
      return Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppTheme.statusCancelled.withValues(alpha: 0.1),
          borderRadius: AppRadius.rMd,
        ),
        child: Row(
          children: [
            Icon(Icons.cancel_rounded, color: AppTheme.statusCancelled),
            const SizedBox(width: AppSpacing.md),
            Text(
              'This order has been cancelled',
              style: TextStyle(color: AppTheme.statusCancelled, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        for (int i = 0; i < _stages.length; i++) ...[
          _TimelineRow(
            stage: _stages[i],
            isActive: i <= _currentIndex,
            isLast: i == _stages.length - 1,
          ),
        ],
      ],
    );
  }
}

class _TimelineStage {
  const _TimelineStage(this.label, this.icon, this.color);
  final String label;
  final IconData icon;
  final Color color;
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({
    required this.stage,
    required this.isActive,
    required this.isLast,
  });

  final _TimelineStage stage;
  final bool isActive;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final color = isActive ? stage.color : AppTheme.surfaceContainer;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Vertical line + icon
          Column(
            children: [
              AnimatedContainer(
                duration: AppMotion.base,
                width: AppIconSize.xl,
                height: AppIconSize.xl,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isActive ? color : Colors.transparent,
                  border: Border.all(color: color, width: 2),
                ),
                child: Center(
                  child: Icon(
                    stage.icon,
                    size: AppIconSize.sm,
                    color: isActive ? AppTheme.onPrimary : color,
                  ),
                ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    color: AppTheme.surfaceContainer,
                    margin: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
                  ),
                ),
            ],
          ),
          const SizedBox(width: AppSpacing.md),
          // Label
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: AppSpacing.sm, bottom: AppSpacing.md),
              child: Text(
                stage.label,
                style: TextStyle(
                  fontSize: AppTypography.bodyLg,
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                  color: isActive ? AppTheme.onSurface : AppTheme.onSurfaceVariant,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SpecRow extends StatelessWidget {
  const _SpecRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.onSurfaceVariant),
          ),
          Flexible(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}