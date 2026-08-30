import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../components/components.dart';
import '../../design/tokens.dart';
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

  @override
  Widget build(BuildContext context) {
    return PfCard(
      onTap: () {
        HapticFeedback.lightImpact();
        context.showModalSheet(builder: (context) => _ItemDetailSheet(item: item));
      },
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
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Reorder request sent'),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
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