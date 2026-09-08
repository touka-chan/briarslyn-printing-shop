import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app_router.dart';
import '../../design/tokens.dart';
import '../../models/inventory_item.dart';
import '../../models/order.dart';
import '../../services/firebase_inventory.dart' as fb_inventory;
import '../../services/firebase_orders.dart' as fb_orders;
import '../../theme/app_theme.dart';
import '../../utils/animations.dart';

enum _NotificationKind { overdueOrder, urgentOrder, lowStock, insufficientStock, staleSensor, readyForPickup }

class _Notification {
  const _Notification({
    required this.kind,
    required this.title,
    required this.message,
    required this.timestamp,
    this.orderId,
    this.materialVariantId,
  });

  final _NotificationKind kind;
  final String title;
  final String message;
  final DateTime timestamp;
  final String? orderId;
  final String? materialVariantId;

  Color get color {
    switch (kind) {
      case _NotificationKind.overdueOrder:
      case _NotificationKind.insufficientStock:
        return AppTheme.statusOverdue;
      case _NotificationKind.urgentOrder:
      case _NotificationKind.lowStock:
        return AppTheme.statusUrgent;
      case _NotificationKind.staleSensor:
        return AppTheme.sensorStale;
      case _NotificationKind.readyForPickup:
        return AppTheme.statusReadyForPickup;
    }
  }

  IconData get icon {
    switch (kind) {
      case _NotificationKind.overdueOrder:
        return Icons.warning_amber_rounded;
      case _NotificationKind.urgentOrder:
        return Icons.schedule_rounded;
      case _NotificationKind.lowStock:
        return Icons.inventory_2_outlined;
      case _NotificationKind.insufficientStock:
        return Icons.error_outline_rounded;
      case _NotificationKind.staleSensor:
        return Icons.sensors_off_rounded;
      case _NotificationKind.readyForPickup:
        return Icons.check_circle_outline_rounded;
    }
  }
}

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  /// Build the notification list from the live orders + inventory snapshots
  /// so the screen always reflects the latest state in Firestore.
  List<_Notification> _buildNotifications(
    List<Order> orders,
    List<InventoryItem> inventory,
  ) {
    final now = DateTime.now();
    final notifs = <_Notification>[];

    for (final Order o in orders) {
      if (o.priority == 'Overdue' && o.status != 'Completed') {
        notifs.add(_Notification(
          kind: _NotificationKind.overdueOrder,
          title: 'Order ${o.orderId} is overdue',
          message:
              '${o.customerName} • ${o.itemType} • target was ${_fmt(o.targetDate)}',
          timestamp: o.targetDate,
          orderId: o.orderId,
        ));
      } else if (o.priority == 'Urgent' && o.status != 'Completed') {
        notifs.add(_Notification(
          kind: _NotificationKind.urgentOrder,
          title: 'Urgent: ${o.itemType}',
          message: '${o.customerName} • target ${_fmt(o.targetDate)}',
          timestamp: o.targetDate.subtract(const Duration(days: 1)),
          orderId: o.orderId,
        ));
      }
      if (o.status == 'Ready for Pickup') {
        notifs.add(_Notification(
          kind: _NotificationKind.readyForPickup,
          title: '${o.orderId} is ready for pickup',
          message: '${o.customerName} • ${o.itemType}',
          timestamp: now.subtract(const Duration(hours: 1)),
          orderId: o.orderId,
        ));
      }
    }

    for (final InventoryItem item in inventory) {
      if (item.status == 'Insufficient Stock') {
        notifs.add(_Notification(
          kind: _NotificationKind.insufficientStock,
          title: '${item.materialVariantId} out of stock',
          message: '${item.itemType} • ${item.currentStock} left',
          timestamp: item.lastUpdated,
          materialVariantId: item.materialVariantId,
        ));
      } else if (item.status == 'Low Stock') {
        notifs.add(_Notification(
          kind: _NotificationKind.lowStock,
          title: '${item.materialVariantId} is running low',
          message:
              '${item.itemType} • ${item.currentStock} units left (reorder at ${item.reorderPoint})',
          timestamp: item.lastUpdated,
          materialVariantId: item.materialVariantId,
        ));
      }
      if (item.isStale) {
        notifs.add(_Notification(
          kind: _NotificationKind.staleSensor,
          title: '${item.materialVariantId} sensor is delayed',
          message:
              'Last update ${_ago(item.lastUpdated)} — check ${item.sensorId ?? "sensor"}',
          timestamp: item.lastUpdated,
          materialVariantId: item.materialVariantId,
        ));
      }
    }

    notifs.sort((a, b) => b.timestamp.compareTo(a.timestamp));
    return notifs;
  }

  String _fmt(DateTime d) =>
      '${d.month.toString().padLeft(2, "0")}/${d.day.toString().padLeft(2, "0")}';
  String _ago(DateTime d) {
    final diff = DateTime.now().difference(d);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  void _handleTap(BuildContext context, _Notification n) {
    HapticFeedback.selectionClick();
    if (n.orderId != null) {
      Navigator.pushNamed(context, AppRoutes.productionOrderDetail(n.orderId!));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Notifications'),
        backgroundColor: AppTheme.surface,
        foregroundColor: AppTheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 1,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: StreamBuilder<List<Order>>(
        stream: fb_orders.subscribeOrdersStream(),
        builder: (context, ordersSnap) {
          return StreamBuilder<List<InventoryItem>>(
            stream: fb_inventory.subscribeInventoryStream(),
            builder: (context, invSnap) {
              final orders = ordersSnap.data ?? const <Order>[];
              final inventory = invSnap.data ?? const <InventoryItem>[];
              final notifications = _buildNotifications(orders, inventory);
              if (notifications.isEmpty) return _EmptyState();
              return SafeArea(
                top: false,
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.md,
                    AppSpacing.lg,
                    AppSpacing.xxl,
                  ),
                  itemCount: notifications.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: AppSpacing.md),
                  itemBuilder: (context, index) {
                    final n = notifications[index];
                    return StaggeredFadeIn(
                      delay: Duration(milliseconds: 40 * index),
                      children: [
                        _NotificationCard(
                          notification: n,
                          onTap: () => _handleTap(context, n),
                        ),
                      ],
                    );
                  },
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.notification, required this.onTap});

  final _Notification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tint = notification.color.withValues(alpha: 0.10);
    final border = notification.color.withValues(alpha: 0.30);

    return PressScale(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: AppRadius.rMd,
          border: Border.all(color: border, width: 1),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: tint,
                borderRadius: AppRadius.rSm,
              ),
              child: Icon(notification.icon, color: notification.color, size: 20),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    notification.title,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppTheme.onSurface,
                        ),
                  ),
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    notification.message,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppTheme.onSurfaceVariant,
                        ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        notification.kind == _NotificationKind.overdueOrder
                            ? 'Overdue'
                            : notification.kind == _NotificationKind.urgentOrder
                                ? 'Urgent'
                                : notification.kind == _NotificationKind.readyForPickup
                                    ? 'Ready'
                                    : notification.kind == _NotificationKind.insufficientStock
                                        ? 'Insufficient'
                                        : notification.kind == _NotificationKind.lowStock
                                            ? 'Low Stock'
                                            : 'Sensor',
                        style: TextStyle(
                          fontSize: AppTypography.caption,
                          letterSpacing: 0.6,
                          fontWeight: FontWeight.w700,
                          color: notification.color,
                        ),
                      ),
                      Icon(
                        Icons.arrow_forward_rounded,
                        size: AppIconSize.xs,
                        color: notification.color,
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
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppTheme.statusCompleted.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.notifications_active_rounded,
                size: 48,
                color: AppTheme.statusCompleted,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              "You're all caught up",
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'No new notifications right now. Overdue orders, low stock, and sensor issues will appear here.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppTheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
