import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../theme/app_theme.dart';
import '../../utils/mock_data.dart';
import '../../utils/animations.dart';
import '../../models/rfid_event.dart';
import '../../models/inventory_item.dart';

/// The RFID Sensor screen — the third tab in the Production shell.
///
/// Displays live sensor status, RFID activity feed, and per-tag status.
class ProductionSensorScreen extends StatefulWidget {
  const ProductionSensorScreen({super.key});

  @override
  State<ProductionSensorScreen> createState() => _ProductionSensorScreenState();
}

class _ProductionSensorScreenState extends State<ProductionSensorScreen> {
  // Simulated sensor state
  bool _sensorOnline = true;
  final int _eventsToday = mockActivity.length;

  Map<String, List<InventoryItem>> get _tagsBySensor {
    final grouped = <String, List<InventoryItem>>{};
    for (final item in mockInventory) {
      if (item.sensorId == null) continue;
      grouped.putIfAbsent(item.sensorId!, () => []).add(item);
    }
    return grouped;
  }

  @override
  Widget build(BuildContext context) {
    final tagsBySensor = _tagsBySensor;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.xxl),
      child: StaggeredFadeIn(
        children: [
          // Sensor pulse header
          _SensorHeaderCard(
            isOnline: _sensorOnline,
            onToggle: () {
              HapticFeedback.mediumImpact();
              setState(() => _sensorOnline = !_sensorOnline);
            },
          ),
          const SizedBox(height: AppSpacing.lg),

          // Sensor stats
          Row(
            children: [
              Expanded(child: _StatTile(
                label: 'Active Sensors',
                value: '${tagsBySensor.length}',
                icon: Icons.sensors_rounded,
                color: AppTheme.statusCompleted,
              )),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: _StatTile(
                label: 'Tags Tracked',
                value: '${mockInventory.where((i) => i.tagUid != null).length}',
                icon: Icons.qr_code_2_rounded,
                color: AppTheme.primary,
              )),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: _StatTile(
                label: "Today's Events",
                value: '$_eventsToday',
                icon: Icons.event_note_rounded,
                color: AppTheme.statusInProduction,
              )),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),

          // Sensors section
          const PfSectionHeader(
            title: 'Connected Sensors',
            subtitle: 'Live RFID reader status',
          ),
          const SizedBox(height: AppSpacing.md),
          ...tagsBySensor.entries.map((entry) => Column(
            children: [
              _SensorCard(
                sensorId: entry.key,
                tags: entry.value,
                isOnline: _sensorOnline,
              ),
              const SizedBox(height: AppSpacing.md),
            ],
          )),

          const SizedBox(height: AppSpacing.lg),
          const PfSectionHeader(
            title: 'Recent Activity',
            subtitle: 'Latest RFID checkout events',
          ),
          const SizedBox(height: AppSpacing.md),

          // Activity list
          ...mockActivity.take(8).map((event) => Column(
            children: [
              _ActivityRow(event: event),
              const SizedBox(height: AppSpacing.sm),
            ],
          )),
        ],
      ),
    );
  }
}

class _SensorHeaderCard extends StatelessWidget {
  const _SensorHeaderCard({required this.isOnline, required this.onToggle});

  final bool isOnline;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final color = isOnline ? AppTheme.statusCompleted : AppTheme.statusUrgent;

    return PfCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Row(
        children: [
          // Animated pulse circle
          Stack(
            alignment: Alignment.center,
            children: [
              if (isOnline)
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: color.withValues(alpha: 0.15),
                  ),
                ),
              if (isOnline)
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: color.withValues(alpha: 0.3),
                  ),
                ),
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: color,
                ),
                child: Center(
                  child: Icon(
                    isOnline ? Icons.wifi_rounded : Icons.wifi_off_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: AppSpacing.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isOnline ? 'System Online' : 'System Offline',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  isOnline
                      ? 'All RFID sensors are reporting normally'
                      : 'Sensors stopped — last seen 2h ago',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.onSurfaceVariant),
                ),
              ],
            ),
          ),
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
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _SensorCard extends StatelessWidget {
  const _SensorCard({
    required this.sensorId,
    required this.tags,
    required this.isOnline,
  });

  final String sensorId;
  final List<InventoryItem> tags;
  final bool isOnline;

  @override
  Widget build(BuildContext context) {
    return PfCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isOnline ? AppTheme.statusCompleted : AppTheme.statusUrgent,
                  boxShadow: [
                    if (isOnline)
                      BoxShadow(
                        color: AppTheme.statusCompleted.withValues(alpha: 0.4),
                        blurRadius: 8,
                        spreadRadius: 1,
                      ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                sensorId,
                style: AppTheme.monoStyle(fontSize: 14, fontWeight: FontWeight.w600),
              ),
              const Spacer(),
              Text(
                '${tags.length} tags',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.onSurfaceVariant),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          // Tag chips
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: tags.map((item) {
              final color = _statusColor(item.status);
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xxs),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: AppRadius.rSm,
                  border: Border.all(color: color.withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.qr_code_2_rounded, size: 12, color: color),
                    const SizedBox(width: AppSpacing.xs),
                    Text(
                      item.tagUid ?? 'N/A',
                      style: AppTheme.monoStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: color,
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
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
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.event});

  final RfidCheckoutEvent event;

  @override
  Widget build(BuildContext context) {
    return PfCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppTheme.primary.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.qr_code_scanner_rounded,
              color: AppTheme.primary,
              size: 18,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  event.materialVariantId,
                  style: AppTheme.monoStyle(fontSize: 14, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  '${event.tagUid} • ${event.sensorId}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.onSurfaceVariant),
                ),
              ],
            ),
          ),
          Text(
            _formatRelativeTime(event.timestamp),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }

  String _formatRelativeTime(DateTime timestamp) {
    final now = DateTime.now();
    final diff = now.difference(timestamp);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}