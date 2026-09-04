import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../auth/auth.dart';
import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../services/inventory_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/mock_data.dart';
import '../../utils/animations.dart';
import '../../models/inventory_item.dart';

/// The Inventory screen — the second tab in the Production shell.
///
/// Displays inventory items grouped by stock status (In Stock, Low Stock,
/// Insufficient Stock). Tapping an item shows a stock detail panel.
class ProductionInventoryScreen extends StatefulWidget {
  const ProductionInventoryScreen({super.key});

  @override
  State<ProductionInventoryScreen> createState() => _ProductionInventoryScreenState();
}

class _ProductionInventoryScreenState extends State<ProductionInventoryScreen> {
  String _filter = 'All';
  final List<String> _filters = ['All', 'In Stock', 'Low Stock', 'Insufficient Stock'];

  List<InventoryItem> get _filteredInventory {
    if (_filter == 'All') return mockInventory;
    return mockInventory.where((i) => i.status == _filter).toList();
  }

  @override
  Widget build(BuildContext context) {
    final items = _filteredInventory;
    final inStockCount = mockInventory.where((i) => i.status == 'In Stock').length;
    final lowStockCount = mockInventory.where((i) => i.status == 'Low Stock').length;
    final insufficientCount = mockInventory.where((i) => i.status == 'Insufficient Stock').length;

    return SingleChildScrollView(
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
          const SizedBox(height: AppSpacing.lg),
          // Inventory list
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
    return (item.currentStock / item.reorderPoint).clamp(0.0, 1.0);
  }

  /// Returns true when current stock is projected to fall at or below the
  /// reorder point within the next 7 days, using the forecasted demand
  /// (title §VIII Holt-Winters / Exponential Smoothing forecast). Mirrors
  /// the same arithmetic the backend's predictive ROP would apply.
  bool _isReorderSuggested(InventoryItem item) {
    final projectedAfter = item.currentStock - item.forecastedDemandNext7Days;
    return projectedAfter <= item.reorderPoint;
  }

  /// How many units short the projected stock is of the reorder point.
  /// Always non-negative when [_isReorderSuggested] is true.
  int _reorderShortfall(InventoryItem item) {
    final projectedAfter = item.currentStock - item.forecastedDemandNext7Days;
    final gap = item.reorderPoint - projectedAfter;
    return gap < 0 ? 0 : gap;
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
                        fontSize: AppTypography.caption,
                        fontWeight: FontWeight.w700,
                        color: _statusColor,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    item.materialVariantId,
                    style: AppTheme.monoStyle(fontSize: AppTypography.caption, color: AppTheme.onSurfaceVariant),
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
                    'Stock: ${item.currentStock} / ${item.threshold}',
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
                    'Reorder at: ${item.reorderPoint}',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppTheme.onSurfaceVariant),
                  ),
                  Text(
                    'Forecast (7d): ${item.forecastedDemandNext7Days}',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppTheme.onSurfaceVariant),
                  ),
                ],
              ),
              // Predictive ROP indicator — title §VIII. Surfaces only when the
              // variant is at or below its reorder point after the 7-day
              // forecast is applied, so the cashier / production staff see
              // a clear "reorder now" cue aligned with the model's threshold.
              if (_isReorderSuggested(item)) ...[
                const SizedBox(height: AppSpacing.sm),
                _ReorderSuggestedChip(
                  shortfall: _reorderShortfall(item),
                  forecast: item.forecastedDemandNext7Days,
                ),
              ],
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
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
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
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600),
          ),
          Text(
            item.materialVariantId,
            style: AppTheme.monoStyle(fontSize: AppTypography.bodyMd, color: AppTheme.onSurfaceVariant),
          ),
          const SizedBox(height: AppSpacing.lg),
          _DetailRow(label: 'Category', value: item.category),
          _DetailRow(label: 'Current Stock', value: '${item.currentStock}'),
          _DetailRow(label: 'Threshold', value: '${item.threshold}'),
          _DetailRow(label: 'Reorder Point', value: '${item.reorderPoint}'),
          _DetailRow(label: 'Forecast (7d)', value: '${item.forecastedDemandNext7Days}'),
          _DetailRow(label: 'Forecast Model', value: item.model ?? '—'),
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
        ],
      ),
    );
  }
}

/// Modal bottom sheet for placing a reorder request on a low/insufficient
/// inventory variant. Suggests a quantity that lifts the variant above its
/// reorder point, then on confirm delegates to [InventoryService] (production
/// role) and shows a success snackbar.
Future<void> _showReorderSheet(
  BuildContext context,
  InventoryItem item,
) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => _ReorderSheet(item: item),
  );
}

class _ReorderSheet extends StatefulWidget {
  const _ReorderSheet({required this.item});
  final InventoryItem item;

  @override
  State<_ReorderSheet> createState() => _ReorderSheetState();
}

class _ReorderSheetState extends State<_ReorderSheet> {
  late int _qty;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Suggest enough units to bring the variant 25% above its reorder point.
    final gap = (widget.item.reorderPoint * 1.25).ceil() - widget.item.currentStock;
    _qty = gap < 10 ? 10 : gap;
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
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
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
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '${widget.item.materialVariantId} • ${widget.item.itemType}',
            style: AppTheme.monoStyle(fontSize: AppTypography.label, color: AppTheme.onSurfaceVariant),
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
            helper:
                'Suggested to bring stock 25% above the reorder point.',
            controller: TextEditingController(text: '$_qty')
              ..selection = TextSelection.collapsed(offset: '$_qty'.length),
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
                  label: _submitting ? 'Placing…' : 'Confirm Reorder',
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

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.of(context).viewInsets;
    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
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
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '${widget.item.materialVariantId} • ${widget.item.itemType}',
            style: AppTheme.monoStyle(fontSize: AppTypography.label, color: AppTheme.onSurfaceVariant),
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
                  label: _submitting ? 'Saving…' : 'Save',
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
                  fontSize: AppTypography.caption,
                  letterSpacing: 0.6,
                  color: highlight ? AppTheme.success : AppTheme.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            value,
            style: AppTheme.monoStyle(
              fontSize: AppTypography.titleMd,
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
              style: AppTheme.monoStyle(fontSize: AppTypography.bodyMd, fontWeight: FontWeight.w500),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}

/// Predictive ROP chip rendered under the inventory card's stock bar when
/// the variant is projected to fall at or below the reorder point within
/// the 7-day forecast window. Reuses the existing status palette — no new
/// colors introduced. The icon + shortfall number tell production staff
/// exactly how many units to order to clear the predicted gap.
class _ReorderSuggestedChip extends StatelessWidget {
  const _ReorderSuggestedChip({
    required this.shortfall,
    required this.forecast,
  });

  final int shortfall;
  final int forecast;

  @override
  Widget build(BuildContext context) {
    final color = shortfall == 0
        ? AppTheme.statusReadyForPickup
        : AppTheme.statusUrgent;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: AppRadius.rMd,
        border: Border.all(color: color.withValues(alpha: 0.30)),
      ),
      child: Row(
        children: [
          Icon(Icons.auto_graph_rounded, size: AppIconSize.sm, color: color),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  shortfall == 0
                      ? 'Reorder suggested · 7d forecast: $forecast'
                      : 'Reorder suggested · short by $shortfall (7d forecast $forecast)',
                  style: TextStyle(
                    fontSize: AppTypography.bodySm,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  'Predictive reorder point · §VIII',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        fontSize: AppTypography.caption,
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
}