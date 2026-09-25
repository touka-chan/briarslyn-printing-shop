import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../../auth/auth.dart';
import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../services/firebase_inventory.dart' as fb_inventory;
import '../../services/firebase_rfid.dart' as fb_rfid;
import '../../services/firebase_usage.dart' as fb_usage;
import '../../services/forecast.dart' as forecast;
import '../../services/inventory_service.dart';
import '../../services/usage_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/animations.dart';
import '../../models/inventory_item.dart';
import '../../models/rfid_event.dart';
import '../../models/usage_event.dart';
import '../../widgets/scan_confirm_sheet.dart';

/// The Inventory screen - the second tab in the Production shell.
///
/// Live Firestore inventory grouped by stock status (In Stock, Low Stock,
/// Insufficient Stock). Tapping an item shows a stock detail panel.
class ProductionInventoryScreen extends StatefulWidget {
  const ProductionInventoryScreen({super.key});

  @override
  State<ProductionInventoryScreen> createState() => _ProductionInventoryScreenState();
}

class _ProductionInventoryScreenState extends State<ProductionInventoryScreen> {
  String _filter = 'All';
  final List<String> _filters = ['All', 'In Stock', 'Low Stock', 'Insufficient Stock'];
  int _feedNonce = 0;

  List<InventoryItem> _filteredInventory(List<InventoryItem> source) {
    if (_filter == 'All') return source;
    return source.where((i) => i.status == _filter).toList();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<InventoryItem>>(
      key: ValueKey('inventory-$_feedNonce'),
      stream: fb_inventory.subscribeInventoryStream(),
      builder: (context, snap) {
        if (snap.hasError) {
          return _buildErrorState(
            details: '${snap.error}',
            onRetry: () => setState(() => _feedNonce++),
          );
        }
        if (!snap.hasData) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.xxl),
              child: CircularProgressIndicator(),
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: _handleRefresh,
          color: AppTheme.primary,
          backgroundColor: AppTheme.surface,
          child: _buildBody(snap.data!),
        );
      },
    );
  }

  /// Pull-to-refresh: re-subscribes the live feed and holds the spinner
  /// briefly so the gesture reads as feedback.
  Future<void> _handleRefresh() async {
    setState(() => _feedNonce++);
    await Future<void>.delayed(const Duration(milliseconds: 600));
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
              'Couldn\'t load inventory',
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

  Widget _buildBody(List<InventoryItem> source) {
    final items = _filteredInventory(source);
    final inStockCount = source.where((i) => i.status == 'In Stock').length;
    final lowStockCount = source.where((i) => i.status == 'Low Stock').length;
    final insufficientCount = source.where((i) => i.status == 'Insufficient Stock').length;

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.xxl),
      child: StaggeredFadeIn(
        children: [
          // Stats summary
          Row(
            children: [
              Expanded(child: _StatTile(
                label: 'In Stock',
                value: '$inStockCount',
                icon: Icons.check_circle_outline,
                color: AppTheme.statusCompleted,
              )),
              const SizedBox(width: AppSpacing.md),
              Expanded(child: _StatTile(
                label: 'Low Stock',
                value: '$lowStockCount',
                icon: Icons.warning_amber_outlined,
                color: AppTheme.statusReadyForPickup,
              )),
              const SizedBox(width: AppSpacing.md),
              Expanded(child: _StatTile(
                label: 'Insufficient',
                value: '$insufficientCount',
                icon: Icons.error_outline,
                color: AppTheme.statusUrgent,
              )),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),
          // Filter chips
          PfFilterChips(
            options: _filters,
            selected: _filter,
            onChanged: (v) => setState(() => _filter = v),
          ),
          const SizedBox(height: AppSpacing.md),
          // Scanner-first row: tap any tag to open its item, or create a
          // new material variant.
          Row(
            children: [
              Expanded(
                child: PfButton.outlined(
                  label: 'Find by Scan',
                  icon: Icons.nfc_rounded,
                  fullWidth: true,
                  onPressed: () => _findByScan(source),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: PfButton.outlined(
                  label: 'Add Item',
                  icon: Icons.add_rounded,
                  fullWidth: true,
                  onPressed: () => _showAddItemSheet(context, source),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          // Inventory list
          if (source.isEmpty)
            _EmptyInventoryState(
              title: 'No inventory yet',
              message:
                  'Variants added on the web dashboard or by the Admin will appear here.',
            )
          else if (items.isEmpty)
            const _EmptyInventoryState(
              title: 'No matching items',
              message: 'Try a different stock filter.',
            )
          else
            ...items.map((item) => Column(
              children: [
                _InventoryCard(item: item),
                const SizedBox(height: AppSpacing.md),
              ],
            )),
        ],
      ),
    );
  }

  /// Scanner-first lookup: tap any tag to open its item sheet, or turn a
  /// free tag into a new item (prefilled with the scanned UID).
  Future<void> _findByScan(List<InventoryItem> items) async {
    final uid = await showScanConfirmSheet(
      context,
      mode: ScanConfirmMode.lookup,
    );
    if (!mounted || uid == null) return;

    InventoryItem? found;
    for (final item in items) {
      if ((item.tagUid ?? '').trim().toUpperCase() == uid.toUpperCase()) {
        found = item;
        break;
      }
    }
    final match = found;
    if (match != null) {
      HapticFeedback.mediumImpact();
      context.showModalSheet(builder: (_) => _ItemDetailSheet(item: match));
      return;
    }

    final create = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Free tag'),
        content: Text(
          'No item is bound to tag $uid. Create a new item with it?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Create'),
          ),
        ],
      ),
    );
    if (create == true && mounted) {
      await _showAddItemSheet(context, items, prefilledTag: uid);
    }
  }
}

class _EmptyInventoryState extends StatelessWidget {
  const _EmptyInventoryState({required this.title, required this.message});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
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
              child: Icon(Icons.inventory_2_outlined,
                  size: 48, color: AppTheme.statusCompleted),
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
              message,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: AppTheme.onSurfaceVariant),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return PfCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: AppRadius.rSm,
            ),
            child: Icon(icon, color: color, size: AppIconSize.sm),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            value,
            style: AppTheme.monoStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: AppTheme.onSurface,
            ),
          ),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppTheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _InventoryCard extends StatelessWidget {
  const _InventoryCard({required this.item});

  final InventoryItem item;

  Color get _statusColor {
    switch (item.status) {
      case 'In Stock':
        return AppTheme.statusCompleted;
      case 'Low Stock':
        return AppTheme.statusReadyForPickup;
      case 'Insufficient Stock':
        return AppTheme.statusUrgent;
      default:
        return AppTheme.onSurfaceVariant;
    }
  }

  double get _stockPercentage {
    // Guard: reorderPoint 0 (common on new variants) makes 0/0 = NaN,
    // which fails LinearProgressIndicator's 0..1 assertion (red screen).
    final rop = item.reorderPoint <= 0 ? 1 : item.reorderPoint;
    return (item.currentStock / rop).clamp(0.0, 1.0);
  }

  @override
  Widget build(BuildContext context) {
    return PressScale(
      onTap: () {
        HapticFeedback.lightImpact();
        context.showModalSheet(builder: (context) => _ItemDetailSheet(item: item));
      },
      child: PfCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: _statusColor.withValues(alpha: 0.1),
                  borderRadius: AppRadius.rSm,
                ),
                child: Icon(
                  _getCategoryIcon(item.category),
                  color: _statusColor,
                  size: AppIconSize.md,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.itemType,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      item.category,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xxs),
                    decoration: BoxDecoration(
                      color: _statusColor.withValues(alpha: 0.1),
                      borderRadius: AppRadius.rSm,
                      border: Border.all(color: _statusColor.withValues(alpha: 0.3)),
                    ),
                    child: Text(
                      item.status,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: _statusColor,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    item.materialVariantId,
                    style: AppTheme.monoStyle(fontSize: 11, color: AppTheme.onSurfaceVariant),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          // Stock progress bar
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Stock: ${item.currentStock}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w500),
                  ),
                  Text(
                    '${(_stockPercentage * 100).round()}%',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: _statusColor,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: _stockPercentage,
                  minHeight: 6,
                  backgroundColor: AppTheme.surfaceContainer,
                  valueColor: AlwaysStoppedAnimation<Color>(_statusColor),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Threshold: ${item.reorderPoint}',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppTheme.onSurfaceVariant),
                  ),
                  Text(
                    'Forecast (7d): ${item.forecastedDemandNext7Days}',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppTheme.onSurfaceVariant),
                  ),
                ],
              ),
            ],
          ),
          if (item.sensorId != null) ...[
            const SizedBox(height: AppSpacing.sm),
            PfSensorPulse(
              online: true,
              label: 'Sensor: ${item.sensorId}',
            ),
          ],
        ],
      ),
      ),
    );
  }

  IconData _getCategoryIcon(String category) {
    switch (category) {
      case 'Fabric':
        return Icons.checkroom_outlined;
      case 'Vinyl':
        return Icons.layers_outlined;
      case 'Paper':
        return Icons.description_outlined;
      case 'Drinkware':
        return Icons.local_drink_outlined;
      case 'Stationery':
        return Icons.mail_outlined;
      case 'Screen Print':
        return Icons.format_paint_outlined;
      default:
        return Icons.inventory_2_outlined;
    }
  }
}

class _ItemDetailSheet extends StatelessWidget {
  const _ItemDetailSheet({required this.item});

  final InventoryItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
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
          Text(
            item.itemType,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          Text(
            item.materialVariantId,
            style: AppTheme.monoStyle(fontSize: 14, color: AppTheme.onSurfaceVariant),
          ),
          const SizedBox(height: AppSpacing.lg),
          _DetailRow(label: 'Category', value: item.category),
          _DetailRow(label: 'Current Stock', value: '${item.currentStock}'),
          _DetailRow(label: 'Threshold (ROP)', value: '${item.reorderPoint}'),
          _DetailRow(label: 'Forecast (7d)', value: '${item.forecastedDemandNext7Days}'),
          _DetailRow(label: 'Forecast Model', value: item.model ?? '-'),
          if (item.tagUid != null)
            _DetailRow(label: 'RFID Tag', value: item.tagUid ?? 'N/A'),
          if (item.sensorId != null)
            _DetailRow(label: 'Sensor ID', value: item.sensorId ?? 'N/A'),
          _DetailRow(
            label: 'Last Updated',
            value: '${item.lastUpdated.day}/${item.lastUpdated.month}/${item.lastUpdated.year}',
          ),
          if (item.lastCheckoutAt != null)
            _DetailRow(
              label: 'Last Checkout',
              value: '${item.lastCheckoutAt!.day}/${item.lastCheckoutAt!.month}/${item.lastCheckoutAt!.year}',
            ),
          const SizedBox(height: AppSpacing.lg),
          PfButton.filled(
            label: 'Reorder Stock',
            icon: Icons.add_shopping_cart_rounded,
            fullWidth: true,
            onPressed: () {
              HapticFeedback.mediumImpact();
              context.pop();
              _showReorderSheet(context, item);
            },
          ),
          const SizedBox(height: AppSpacing.sm),
          PfButton.outlined(
            label: 'Adjust Stock',
            icon: Icons.tune_rounded,
            fullWidth: true,
            onPressed: () {
              HapticFeedback.selectionClick();
              context.pop();
              _showAdjustStockSheet(context, item);
            },
          ),
          const SizedBox(height: AppSpacing.sm),
          PfButton.outlined(
            label: 'Edit Threshold (ROP)',
            icon: Icons.flag_outlined,
            fullWidth: true,
            onPressed: () {
              HapticFeedback.selectionClick();
              context.pop();
              _showEditReorderPointSheet(context, item);
            },
          ),
          const SizedBox(height: AppSpacing.sm),
          // Bind (or replace) this item's RFID tag by scanning it - stock
          // is untouched; only the tag mapping changes.
          PfButton.outlined(
            label: 'Bind / Replace Tag',
            icon: Icons.nfc_rounded,
            fullWidth: true,
            onPressed: () {
              HapticFeedback.selectionClick();
              context.pop();
              showScanConfirmSheet(
                context,
                mode: ScanConfirmMode.bind,
                item: item,
              );
            },
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: PfButton.outlined(
                  label: 'Stock In',
                  icon: Icons.move_to_inbox_rounded,
                  fullWidth: true,
                  onPressed: () {
                    HapticFeedback.selectionClick();
                    context.pop();
                    _showStockInSheet(context, item);
                  },
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: PfButton.outlined(
                  label: 'Log Usage',
                  icon: Icons.outbox_rounded,
                  fullWidth: true,
                  onPressed: () {
                    HapticFeedback.selectionClick();
                    context.pop();
                    _showLogUsageSheet(context, item);
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Modal bottom sheet for placing a reorder request on a low/insufficient
/// inventory variant. Suggests a quantity covering the larger of the
/// stored reorder point (+25% buffer) and the live 7-day smoothed demand
/// forecast, then on confirm delegates to [InventoryService] (production
/// role) and shows a success snackbar.
Future<void> _showReorderSheet(
  BuildContext context,
  InventoryItem item,
) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) =>
        StreamBuilder<List<RfidCheckoutEvent>>(
      stream: fb_rfid.subscribeRfidEventsStream(limit: 500),
      builder: (context, snap) {
        final taps = snap.data ?? const <RfidCheckoutEvent>[];
        return StreamBuilder<List<UsageEvent>>(
          stream: fb_usage.subscribeUsageEventsStream(limit: 500),
          builder: (context, usageSnap) {
            // A failed feed degrades to the stored reorder point (never a
            // fake zero) — but the sheet says so instead of implying live
            // data informed the suggestion.
            final forecastUnavailable =
                snap.hasError || usageSnap.hasError;
            // Demand = usage OUT movements (auto/manual/rfid). IN
            // movements (receiving) never count. Legacy RFID taps
            // count only when the variant has no usage history yet -
            // afterwards taps are check-ins, not demand (no double
            // count).
            final usageOut =
                (usageSnap.data ?? const <UsageEvent>[])
                    .where((u) =>
                        u.direction == 'out' &&
                        u.materialVariantId == item.materialVariantId)
                    .map((u) => RfidCheckoutEvent(
                          materialVariantId: u.materialVariantId,
                          tagUid: '',
                          sensorId: '',
                          timestamp: u.timestamp,
                        ))
                    .toList();
            final events = <RfidCheckoutEvent>[
              if (usageOut.isEmpty) ...taps,
              ...usageOut,
            ];
            final live = forecast.forecastVariantDemand(
              events,
              item.materialVariantId,
            );
            return _ReorderSheet(
              item: item,
              liveForecast: live.hasHistory ? live : null,
              forecastUnavailable: forecastUnavailable,
            );
          },
        );
      },
    ),
  );
}

class _ReorderSheet extends StatefulWidget {
  const _ReorderSheet({
    required this.item,
    this.liveForecast,
    this.forecastUnavailable = false,
  });
  final InventoryItem item;

  /// Live demand forecast for this variant, or null when it has no
  /// checkout history yet (falls back to the stored reorder point).
  final forecast.VariantForecast? liveForecast;

  /// True when the demand feeds failed: the suggestion uses the stored
  /// reorder point and the sheet says so.
  final bool forecastUnavailable;

  @override
  State<_ReorderSheet> createState() => _ReorderSheetState();
}

class _ReorderSheetState extends State<_ReorderSheet> {
  late int _qty;
  late final TextEditingController _qtyCtrl;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Cover the larger of the ROP (+25% buffer) and the live 7-day
    // smoothed demand forecast when checkout history exists.
    final live = widget.liveForecast;
    var target = (widget.item.reorderPoint * 1.25).ceil();
    if (live != null && live.forecast7d > target) {
      target = live.forecast7d;
    }
    final gap = target - widget.item.currentStock;
    _qty = gap < 10 ? 10 : gap;
    // Owned once here - never rebuilt in build(), so typing never loses
    // focus or resets the field.
    _qtyCtrl = TextEditingController(text: '$_qty')
      ..selection = TextSelection.collapsed(offset: '$_qty'.length);
  }

  @override
  void dispose() {
    _qtyCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_qty <= 0) {
      setState(() => _error = 'Quantity must be greater than zero');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final auth = AuthProvider.of(context);
    try {
      await InventoryService.updateStock(
        materialVariantId: widget.item.materialVariantId,
        newStock: widget.item.currentStock + _qty,
        auth: auth,
      );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Reorder placed: +$_qty units of ${widget.item.materialVariantId}',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on PermissionDeniedException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Failed to place reorder';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.of(context).viewInsets;
    final projectStock = widget.item.currentStock + _qty;
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.lg + viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
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
          Text(
            'Place reorder',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '${widget.item.materialVariantId} - ${widget.item.itemType}',
            style: AppTheme.monoStyle(fontSize: 12, color: AppTheme.onSurfaceVariant),
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              Expanded(
                child: _Stat(
                  label: 'Current',
                  value: '${widget.item.currentStock}',
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: _Stat(
                  label: 'Reorder',
                  value: '${widget.item.reorderPoint}',
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: _Stat(
                  label: 'After',
                  value: '$projectStock',
                  highlight: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          PfTextField(
            label: 'Quantity to reorder',
            hintText: 'Suggested amount',
            helper: widget.liveForecast != null
                ? 'Covers the 7-day smoothed demand '
                    '(${widget.liveForecast!.forecast7d} units, '
                    '${widget.liveForecast!.model}) with buffer.'
                : widget.forecastUnavailable
                    ? 'Live demand unavailable - using the stored reorder point.'
                    : 'Suggested to bring stock 25% above the reorder point.',
            controller: _qtyCtrl,
            prefixIcon: Icons.add_shopping_cart_rounded,
            keyboardType: TextInputType.number,
            errorText: _error,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (v) => setState(() => _qty = int.tryParse(v) ?? 0),
          ),
          const SizedBox(height: AppSpacing.xl),
          Row(
            children: [
              Expanded(
                child: PfButton.outlined(
                  label: 'Cancel',
                  fullWidth: true,
                  onPressed: _submitting ? null : () => Navigator.pop(context),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: PfButton.filled(
                  label: _submitting ? 'Placing...' : 'Confirm Reorder',
                  icon: Icons.check_rounded,
                  fullWidth: true,
                  loading: _submitting,
                  onPressed: _submitting ? null : _submit,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Modal bottom sheet for adjusting the stock of an inventory variant.
/// Wraps the existing [InventoryService] so the action is permission-checked
/// (production role only) and the new stock value recomputes the status.
Future<void> _showAdjustStockSheet(
  BuildContext context,
  InventoryItem item,
) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => _AdjustStockSheet(item: item),
  );
}

class _AdjustStockSheet extends StatefulWidget {
  const _AdjustStockSheet({required this.item});

  final InventoryItem item;

  @override
  State<_AdjustStockSheet> createState() => _AdjustStockSheetState();
}

class _AdjustStockSheetState extends State<_AdjustStockSheet> {
  late final TextEditingController _ctrl;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.item.currentStock.toString());
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final raw = _ctrl.text.trim();
    final value = int.tryParse(raw);
    if (value == null || value < 0) {
      setState(() => _error = 'Enter a non-negative whole number');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });

    final auth = AuthProvider.of(context);
    try {
      await InventoryService.updateStock(
        materialVariantId: widget.item.materialVariantId,
        newStock: value,
        auth: auth,
      );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Stock updated to $value for ${widget.item.materialVariantId}'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on PermissionDeniedException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Failed to update stock';
      });
    }
  }

  /// Confirms the adjustment by scanning the item's tag (identity check
  /// before an absolute stock correction). The scan sheet applies
  /// `updateStock` itself.
  Future<void> _scanConfirm() async {
    final value = int.tryParse(_ctrl.text.trim());
    if (value == null || value < 0) {
      setState(() => _error = 'Enter a non-negative whole number');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final consumedTag = await showScanConfirmSheet(
      context,
      mode: ScanConfirmMode.adjust,
      item: widget.item,
      targetStock: value,
    );
    if (!mounted) return;
    setState(() => _submitting = false);
    if (consumedTag != null) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Stock updated (scan) to $value for ${widget.item.materialVariantId}',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.of(context).viewInsets;
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.lg + viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
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
          Text(
            'Adjust Stock',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '${widget.item.materialVariantId} - ${widget.item.itemType}',
            style: AppTheme.monoStyle(fontSize: 12, color: AppTheme.onSurfaceVariant),
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              Expanded(
                child: _Stat(
                  label: 'Current',
                  value: '${widget.item.currentStock}',
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: _Stat(
                  label: 'Reorder',
                  value: '${widget.item.reorderPoint}',
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          PfTextField(
            label: 'New stock count',
            hintText: 'Enter new quantity',
            controller: _ctrl,
            prefixIcon: Icons.inventory_2_rounded,
            keyboardType: TextInputType.number,
            errorText: _error,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          ),
          const SizedBox(height: AppSpacing.xl),
          // Primary: scan this item's tag to confirm the correction.
          PfButton.filled(
            label: 'Scan tag to confirm',
            icon: Icons.nfc_rounded,
            fullWidth: true,
            onPressed: _submitting ? null : _scanConfirm,
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: PfButton.outlined(
                  label: 'Cancel',
                  fullWidth: true,
                  onPressed: _submitting ? null : () => Navigator.pop(context),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: PfButton.outlined(
                  label: _submitting ? 'Saving...' : 'Save without scan',
                  icon: Icons.check_rounded,
                  fullWidth: true,
                  loading: _submitting,
                  onPressed: _submitting ? null : _submit,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Modal bottom sheet for editing a variant's reorder point.
/// Wraps [InventoryService.updateReorderPoint] so the action is
/// permission-checked (production role only); the status pill recomputes
/// from the existing stock against the new ROP.
Future<void> _showEditReorderPointSheet(
  BuildContext context,
  InventoryItem item,
) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => _EditReorderPointSheet(item: item),
  );
}

class _EditReorderPointSheet extends StatefulWidget {
  const _EditReorderPointSheet({required this.item});

  final InventoryItem item;

  @override
  State<_EditReorderPointSheet> createState() =>
      _EditReorderPointSheetState();
}

class _EditReorderPointSheetState extends State<_EditReorderPointSheet> {
  late final TextEditingController _ctrl;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.item.reorderPoint.toString());
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final raw = _ctrl.text.trim();
    final value = int.tryParse(raw);
    if (value == null || value < 0) {
      setState(() => _error = 'Enter a non-negative whole number');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });

    final auth = AuthProvider.of(context);
    try {
      await InventoryService.updateReorderPoint(
        materialVariantId: widget.item.materialVariantId,
        newReorderPoint: value,
        auth: auth,
      );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              'Reorder point updated to $value for ${widget.item.materialVariantId}'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on PermissionDeniedException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Failed to update reorder point';
      });
    }
  }

  /// Confirms the new reorder point by scanning the item's tag. The scan
  /// sheet applies `updateReorderPoint` itself.
  Future<void> _scanConfirm() async {
    final value = int.tryParse(_ctrl.text.trim());
    if (value == null || value < 0) {
      setState(() => _error = 'Enter a non-negative whole number');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final consumedTag = await showScanConfirmSheet(
      context,
      mode: ScanConfirmMode.reorderPoint,
      item: widget.item,
      newReorderPoint: value,
    );
    if (!mounted) return;
    setState(() => _submitting = false);
    if (consumedTag != null) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Reorder point (scan) set to $value for ${widget.item.materialVariantId}',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.of(context).viewInsets;
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.lg + viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
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
          Text(
            'Edit Threshold (ROP)',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '${widget.item.materialVariantId} - ${widget.item.itemType}',
            style: AppTheme.monoStyle(fontSize: 12, color: AppTheme.onSurfaceVariant),
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              Expanded(
                child: _Stat(
                  label: 'Current Stock',
                  value: '${widget.item.currentStock}',
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: _Stat(
                  label: 'Current Threshold',
                  value: '${widget.item.reorderPoint}',
                  highlight: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          PfTextField(
            label: 'New threshold (ROP)',
            hintText: 'Enter new threshold',
            helper: 'Stock at or below this level shows as Low Stock.',
            controller: _ctrl,
            prefixIcon: Icons.flag_outlined,
            keyboardType: TextInputType.number,
            errorText: _error,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          ),
          const SizedBox(height: AppSpacing.xl),
          // Primary: scan this item's tag to confirm the new threshold.
          PfButton.filled(
            label: 'Scan tag to confirm',
            icon: Icons.nfc_rounded,
            fullWidth: true,
            onPressed: _submitting ? null : _scanConfirm,
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: PfButton.outlined(
                  label: 'Cancel',
                  fullWidth: true,
                  onPressed: _submitting ? null : () => Navigator.pop(context),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: PfButton.outlined(
                  label: _submitting ? 'Saving...' : 'Save without scan',
                  icon: Icons.check_rounded,
                  fullWidth: true,
                  loading: _submitting,
                  onPressed: _submitting ? null : _submit,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.highlight = false});
  final String label;
  final String value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: highlight
            ? AppTheme.success.withValues(alpha: 0.10)
            : AppTheme.surfaceContainer,
        borderRadius: AppRadius.rMd,
        border: highlight
            ? Border.all(color: AppTheme.success.withValues(alpha: 0.30))
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  fontSize: 10,
                  letterSpacing: 0.6,
                  color: highlight ? AppTheme.success : AppTheme.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: AppTheme.monoStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: highlight ? AppTheme.success : AppTheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.onSurfaceVariant)),
          Flexible(
            child: Text(
              value,
              style: AppTheme.monoStyle(fontSize: 14, fontWeight: FontWeight.w500),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}

/// Modal bottom sheet for logging a stock IN (delivery received).
/// Writes `current_stock += qty` plus a `usage_events` entry
/// (direction `in`) in one transaction via [UsageService].
Future<void> _showStockInSheet(
  BuildContext context,
  InventoryItem item,
) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => _StockInSheet(item: item),
  );
}

class _StockInSheet extends StatefulWidget {
  const _StockInSheet({required this.item});
  final InventoryItem item;

  @override
  State<_StockInSheet> createState() => _StockInSheetState();
}

class _StockInSheetState extends State<_StockInSheet> {
  late final TextEditingController _qtyCtrl;
  late final TextEditingController _noteCtrl;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _qtyCtrl = TextEditingController(text: '10');
    _noteCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final qty = int.tryParse(_qtyCtrl.text.trim());
    if (qty == null || qty <= 0) {
      setState(() => _error = 'Enter a positive whole number');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final auth = AuthProvider.of(context);
    try {
      await UsageService.logStockIn(
        materialVariantId: widget.item.materialVariantId,
        qty: qty,
        note: _noteCtrl.text.trim().isEmpty ? null : _noteCtrl.text.trim(),
        auth: auth,
      );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Stock in: +$qty ${widget.item.materialVariantId}'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on PermissionDeniedException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Failed to record stock-in';
      });
    }
  }

  /// Confirms the receive by scanning the item's RFID tag. The scan sheet
  /// applies the stock-in itself (with source 'rfid'), so this only
  /// validates the quantity and closes on success.
  Future<void> _scanConfirm() async {
    final qty = int.tryParse(_qtyCtrl.text.trim());
    if (qty == null || qty <= 0) {
      setState(() => _error = 'Enter a positive whole number');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final note = _noteCtrl.text.trim();
    final consumedTag = await showScanConfirmSheet(
      context,
      mode: ScanConfirmMode.stockIn,
      item: widget.item,
      qty: qty,
      note: note.isEmpty ? null : note,
    );
    if (!mounted) return;
    setState(() => _submitting = false);
    if (consumedTag != null) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Stock in (scan): +$qty ${widget.item.materialVariantId}',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.of(context).viewInsets;
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.lg + viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
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
          Text(
            'Stock in',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '${widget.item.materialVariantId} - ${widget.item.itemType}',
            style: AppTheme.monoStyle(fontSize: 12, color: AppTheme.onSurfaceVariant),
          ),
          const SizedBox(height: AppSpacing.lg),
          PfTextField(
            label: 'Quantity received',
            hintText: 'e.g. 20',
            controller: _qtyCtrl,
            prefixIcon: Icons.move_to_inbox_rounded,
            keyboardType: TextInputType.number,
            errorText: _error,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          ),
          const SizedBox(height: AppSpacing.md),
          PfTextField(
            label: 'Note (optional)',
            hintText: 'e.g. Supplier delivery, PO-123',
            controller: _noteCtrl,
            prefixIcon: Icons.note_alt_outlined,
          ),
          const SizedBox(height: AppSpacing.xl),
          // Primary path: confirm by scanning the item's RFID tag - the
          // receiver picks the item first, so the tap can only land here.
          PfButton.filled(
            label: 'Scan tag to confirm',
            icon: Icons.nfc_rounded,
            fullWidth: true,
            onPressed: _submitting ? null : _scanConfirm,
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: PfButton.outlined(
                  label: 'Cancel',
                  fullWidth: true,
                  onPressed: _submitting ? null : () => Navigator.pop(context),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: PfButton.outlined(
                  label: _submitting ? 'Saving...' : 'Save without scan',
                  icon: Icons.check_rounded,
                  fullWidth: true,
                  loading: _submitting,
                  onPressed: _submitting ? null : _submit,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Modal bottom sheet for logging a manual stock OUT (wastage, sample,
/// correction, or extra production use outside the auto-deduct).
/// An optional order ID links the log; when that order was already
/// auto-deducted the user must confirm explicitly (double-count guard).
Future<void> _showLogUsageSheet(
  BuildContext context,
  InventoryItem item,
) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => _LogUsageSheet(item: item),
  );
}

class _LogUsageSheet extends StatefulWidget {
  const _LogUsageSheet({required this.item});
  final InventoryItem item;

  @override
  State<_LogUsageSheet> createState() => _LogUsageSheetState();
}

class _LogUsageSheetState extends State<_LogUsageSheet> {
  static const _reasons = <String>[
    'production-use',
    'wastage',
    'sample',
    'correction',
    'others',
  ];

  late final TextEditingController _qtyCtrl;
  late final TextEditingController _orderCtrl;
  String _reason = _reasons.first;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _qtyCtrl = TextEditingController(text: '1');
    _orderCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _orderCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final qty = int.tryParse(_qtyCtrl.text.trim());
    if (qty == null || qty <= 0) {
      setState(() => _error = 'Enter a positive whole number');
      return;
    }
    final orderId = _orderCtrl.text.trim().isEmpty ? null : _orderCtrl.text.trim();
    setState(() {
      _submitting = true;
      _error = null;
    });
    final auth = AuthProvider.of(context);
    try {
      // Double-count guard: an order already auto-deducted needs an
      // explicit second confirmation before logging more against it.
      if (orderId != null) {
        final snap = await FirebaseFirestore.instance
            .collection('orders')
            .doc(orderId)
            .get();
        if (!snap.exists) {
          if (!mounted) return;
          setState(() {
            _submitting = false;
            _error = 'Order not found: $orderId';
          });
          return;
        }
        final alreadyDeducted =
            (snap.data()?['stock_deducted'] as bool?) == true;
        if (alreadyDeducted && mounted) {
          final proceed = await showDialog<bool>(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('Already deducted'),
              content: Text(
                'Order $orderId already auto-deducted its recipe. Log $qty more unit(s) anyway?',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  child: const Text('Log anyway'),
                ),
              ],
            ),
          );
          if (proceed != true) {
            if (!mounted) return;
            setState(() => _submitting = false);
            return;
          }
        }
      }
      await UsageService.logUsage(
        materialVariantId: widget.item.materialVariantId,
        qty: qty,
        reason: _reason,
        orderId: orderId,
        auth: auth,
      );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Usage logged: -$qty ${widget.item.materialVariantId} ($_reason)'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on PermissionDeniedException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Failed to log usage';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.of(context).viewInsets;
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.lg + viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
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
          Text(
            'Log usage',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '${widget.item.materialVariantId} - ${widget.item.itemType}',
            style: AppTheme.monoStyle(fontSize: 12, color: AppTheme.onSurfaceVariant),
          ),
          const SizedBox(height: AppSpacing.lg),
          PfTextField(
            label: 'Quantity used',
            hintText: 'e.g. 2',
            controller: _qtyCtrl,
            prefixIcon: Icons.outbox_rounded,
            keyboardType: TextInputType.number,
            errorText: _error,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Reason',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppTheme.onSurface,
                ),
          ),
          const SizedBox(height: AppSpacing.sm),
          DropdownButtonFormField<String>(
            initialValue: _reason,
            decoration: InputDecoration(
              filled: true,
              fillColor: AppTheme.surfaceContainer,
              border: OutlineInputBorder(
                borderRadius: AppRadius.rMd,
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.md,
              ),
            ),
            items: _reasons
                .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                .toList(),
            onChanged: (v) => setState(() => _reason = v ?? _reasons.first),
          ),
          const SizedBox(height: AppSpacing.md),
          PfTextField(
            label: 'Link order ID (optional)',
            hintText: 'e.g. ORD-200101',
            helper: 'Links this log to an order. Warns when already deducted.',
            controller: _orderCtrl,
            prefixIcon: Icons.receipt_long_outlined,
          ),
          const SizedBox(height: AppSpacing.xl),
          Row(
            children: [
              Expanded(
                child: PfButton.outlined(
                  label: 'Cancel',
                  fullWidth: true,
                  onPressed: _submitting ? null : () => Navigator.pop(context),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: PfButton.filled(
                  label: _submitting ? 'Saving...' : 'Confirm',
                  icon: Icons.check_rounded,
                  fullWidth: true,
                  loading: _submitting,
                  onPressed: _submitting ? null : _submit,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Opens the Add Item sheet. [source] is the live inventory list - its
/// distinct categories populate the category dropdown.
Future<void> _showAddItemSheet(
  BuildContext context,
  List<InventoryItem> source, {
  String? prefilledTag,
}) async {
  final categories = source
      .map((i) => i.category.trim())
      .where((c) => c.isNotEmpty)
      .toSet()
      .toList()
    ..sort();
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _AddItemSheet(
      categories: categories,
      prefilledTag: prefilledTag,
    ),
  );
}

/// Opens the item's action sheet from anywhere (e.g. the Sensor tab's
/// Last-scan card). Mirrors the card tap in the inventory list.
Future<void> showInventoryItemSheet(
  BuildContext context,
  InventoryItem item,
) {
  return context.showModalSheet(builder: (_) => _ItemDetailSheet(item: item));
}

/// Modal bottom sheet for creating a new material variant. The variant ID
/// is auto-generated (INV-XXXXXX, same convention as the web), the category
/// is picked from the existing list (or typed as new), the sensor comes
/// from the live `sensors` collection, and the RFID tag can be scanned
/// right here (capture only - binding happens on save).
class _AddItemSheet extends StatefulWidget {
  const _AddItemSheet({required this.categories, this.prefilledTag});

  final List<String> categories;

  /// Tag UID captured by a previous scan (e.g. the Find-by-Scan free-tag
  /// flow) - shown as already scanned.
  final String? prefilledTag;

  @override
  State<_AddItemSheet> createState() => _AddItemSheetState();
}

class _AddItemSheetState extends State<_AddItemSheet> {
  static const String _newCategory = '__new_category__';

  final _itemTypeCtrl = TextEditingController();
  final _newCategoryCtrl = TextEditingController();
  final _stockCtrl = TextEditingController(text: '0');
  final _ropCtrl = TextEditingController(text: '5');

  String? _category;
  String _sensor = 'ESP32-01';
  String? _capturedTag;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _capturedTag = widget.prefilledTag;
  }

  @override
  void dispose() {
    _itemTypeCtrl.dispose();
    _newCategoryCtrl.dispose();
    _stockCtrl.dispose();
    _ropCtrl.dispose();
    super.dispose();
  }

  /// Same formula used by usage_service / firebase_inventory.
  String _statusFor(int stock, int rop) {
    if (stock <= (rop * 0.6).floor()) return 'Insufficient Stock';
    if (stock <= rop) return 'Low Stock';
    return 'In Stock';
  }

  Future<void> _scanTag() async {
    final uid = await showScanConfirmSheet(
      context,
      mode: ScanConfirmMode.capture,
    );
    if (!mounted || uid == null) return;
    setState(() => _capturedTag = uid);
  }

  Future<void> _save() async {
    final itemType = _itemTypeCtrl.text.trim();
    final category = _category == _newCategory
        ? _newCategoryCtrl.text.trim()
        : (_category ?? '');
    final stock = int.tryParse(_stockCtrl.text.trim());
    final rop = int.tryParse(_ropCtrl.text.trim());
    if (itemType.isEmpty) {
      setState(() => _error = 'Enter the item type');
      return;
    }
    if (category.isEmpty) {
      setState(() => _error = 'Pick a category or type a new one');
      return;
    }
    if (stock == null || stock < 0) {
      setState(() => _error = 'Initial stock: whole number (0 or more)');
      return;
    }
    if (rop == null || rop < 0) {
      setState(() => _error = 'Reorder point: whole number (0 or more)');
      return;
    }
    final ms = DateTime.now().millisecondsSinceEpoch.toString();
    final id = 'INV-${ms.substring(ms.length - 6)}';
    setState(() {
      _saving = true;
      _error = null;
    });
    final auth = AuthProvider.of(context);
    try {
      await InventoryService.createVariant(
        item: InventoryItem(
          materialVariantId: id,
          itemType: itemType,
          category: category,
          tagUid: _capturedTag,
          sensorId: _sensor.trim().isEmpty ? null : _sensor.trim(),
          currentStock: stock,
          reorderPoint: rop,
          forecastedDemandNext7Days: 0,
          model: 'Exponential Smoothing',
          status: _statusFor(stock, rop),
          lastUpdated: DateTime.now(),
        ),
        auth: auth,
      );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Created: $id ($itemType)'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on PermissionDeniedException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = 'Could not save: $e';
      });
    }
  }

  InputDecoration _dropdownDecoration() => InputDecoration(
        filled: true,
        fillColor: AppTheme.surfaceContainer,
        border: OutlineInputBorder(
          borderRadius: AppRadius.rMd,
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
      );

  Widget _fieldLabel(String text) => Text(
        text,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w600,
              color: AppTheme.onSurface,
            ),
      );

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.of(context).viewInsets;
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.lg + viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
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
            Text(
              'Add Item',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Variant ID: auto (INV-XXXXXX)',
              style: AppTheme.monoStyle(
                fontSize: 12,
                color: AppTheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            PfTextField(
              label: 'Item type',
              hintText: 'e.g. Test Ink Black',
              controller: _itemTypeCtrl,
              prefixIcon: Icons.category_outlined,
            ),
            const SizedBox(height: AppSpacing.md),
            _fieldLabel('Category'),
            const SizedBox(height: AppSpacing.sm),
            DropdownButtonFormField<String>(
              initialValue: _category,
              decoration: _dropdownDecoration(),
              hint: const Text('Pick a category'),
              items: [
                ...widget.categories.map(
                  (c) => DropdownMenuItem(value: c, child: Text(c)),
                ),
                const DropdownMenuItem(
                  value: _newCategory,
                  child: Text('+ New category'),
                ),
              ],
              onChanged:
                  _saving ? null : (v) => setState(() => _category = v),
            ),
            if (_category == _newCategory) ...[
              const SizedBox(height: AppSpacing.sm),
              PfTextField(
                label: 'New category',
                hintText: 'e.g. Ink',
                controller: _newCategoryCtrl,
                prefixIcon: Icons.create_new_folder_outlined,
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            _fieldLabel('Sensor'),
            const SizedBox(height: AppSpacing.sm),
            StreamBuilder<Map<String, fb_rfid.SensorState>>(
              stream: fb_rfid.subscribeSensorsStream(),
              builder: (context, snap) {
                final ids = <String>{'ESP32-01'}
                  ..addAll(snap.data?.keys ?? const <String>[])
                  ..add(_sensor);
                final list = ids.toList()..sort();
                return DropdownButtonFormField<String>(
                  initialValue: list.contains(_sensor) ? _sensor : list.first,
                  decoration: _dropdownDecoration(),
                  items: list
                      .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                      .toList(),
                  onChanged:
                      _saving ? null : (v) => setState(() => _sensor = v ?? _sensor),
                );
              },
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Expanded(
                  child: PfTextField(
                    label: 'Initial stock',
                    hintText: '0',
                    controller: _stockCtrl,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: PfTextField(
                    label: 'Reorder point',
                    hintText: '5',
                    controller: _ropCtrl,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            PfButton.outlined(
              label: _capturedTag == null
                  ? 'Scan tag (optional)'
                  : 'Tag: $_capturedTag',
              icon: Icons.nfc_rounded,
              fullWidth: true,
              onPressed: _saving ? null : _scanTag,
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.md),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: AppTheme.errorContainer,
                  borderRadius: AppRadius.rSm,
                ),
                child: Text(
                  _error!,
                  style: TextStyle(
                    color: AppTheme.onErrorContainer,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.xl),
            Row(
              children: [
                Expanded(
                  child: PfButton.outlined(
                    label: 'Cancel',
                    fullWidth: true,
                    onPressed: _saving ? null : () => Navigator.pop(context),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: PfButton.filled(
                    label: _saving ? 'Saving...' : 'Create item',
                    icon: Icons.add_rounded,
                    fullWidth: true,
                    loading: _saving,
                    onPressed: _saving ? null : _save,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}