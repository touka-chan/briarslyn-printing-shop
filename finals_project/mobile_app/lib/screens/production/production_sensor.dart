import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../auth/auth.dart';
import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../services/inventory_service.dart';
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
  late int _eventsToday = mockActivity.length;

  // Local copy of the activity feed so the simulated "live" inserts do not
  // mutate the global mock list when we navigate away from this screen.
  late List<RfidCheckoutEvent> _activityFeed = List.of(mockActivity);
  Timer? _simulator;
  final _rng = math.Random(42);
  DateTime? _lastEventAt;
  static const _sensorId = 'ESP32-01';

  Map<String, List<InventoryItem>> get _tagsBySensor {
    final grouped = <String, List<InventoryItem>>{};
    for (final item in mockInventory) {
      if (item.sensorId == null) continue;
      grouped.putIfAbsent(item.sensorId!, () => []).add(item);
    }
    return grouped;
  }

  @override
  void initState() {
    super.initState();
    _startSimulator();
  }

  @override
  void didUpdateWidget(covariant ProductionSensorScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget != widget) {
      _startSimulator();
    }
  }

  void _startSimulator() {
    _simulator?.cancel();
    if (!_sensorOnline) return;
    // Fires every 6 seconds, mimicking the real ESP32 cadence from §X.
    _simulator = Timer.periodic(const Duration(seconds: 6), (_) => _emitEvent());
  }

  Future<void> _emitEvent() async {
    if (!mounted || !_sensorOnline) return;
    // Pick a random inventory variant that has an RFID tag and stock > 0.
    final candidates =
        mockInventory.where((i) => i.tagUid != null && i.currentStock > 0).toList();
    if (candidates.isEmpty) return;
    final variant = candidates[_rng.nextInt(candidates.length)];
    final event = RfidCheckoutEvent(
      materialVariantId: variant.materialVariantId,
      tagUid: variant.tagUid!,
      sensorId: _sensorId,
      timestamp: DateTime.now(),
    );
    setState(() {
      _activityFeed.insert(0, event);
      _eventsToday += 1;
      _lastEventAt = event.timestamp;
      if (_activityFeed.length > 50) {
        _activityFeed = _activityFeed.sublist(0, 50);
      }
    });
    HapticFeedback.selectionClick();
    // Decrement stock via the service so the rest of the app sees the change.
    try {
      final auth = AuthProvider.of(context);
      await InventoryService.recordRfidEvent(
        materialVariantId: event.materialVariantId,
        tagUid: event.tagUid,
        quantityChange: -1,
        auth: auth,
      );
    } catch (_) {
      // Service not permitted (e.g. wrong role). The visual feed still updates.
    }
  }

  @override
  void dispose() {
    _simulator?.cancel();
    super.dispose();
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
            lastEventAt: _lastEventAt,
            onToggle: () {
              HapticFeedback.mediumImpact();
              setState(() => _sensorOnline = !_sensorOnline);
              if (_sensorOnline) {
                _startSimulator();
              } else {
                _simulator?.cancel();
              }
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
          ..._activityFeed.take(8).map((event) => Column(
            children: [
              _ActivityRow(
                event: event,
                isFresh: _lastEventAt != null &&
                    event.timestamp == _lastEventAt,
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
          )),
        ],
      ),
    );
  }
}

class _SensorHeaderCard extends StatelessWidget {
  const _SensorHeaderCard({
    required this.isOnline,
    required this.onToggle,
    this.lastEventAt,
  });

  final bool isOnline;
  final DateTime? lastEventAt;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final color = isOnline ? AppTheme.statusCompleted : AppTheme.statusUrgent;

    return PfCard(
      variant: PfCardVariant.tinted,
      accent: color,
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
                width: AppIconSize.xl,
                height: AppIconSize.xl,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: color,
                ),
                child: Center(
                  child: Icon(
                    isOnline ? Icons.wifi_rounded : Icons.wifi_off_rounded,
                    color: AppTheme.onPrimary,
                    size: AppIconSize.md,
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
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  isOnline
                      ? (lastEventAt == null
                          ? 'Listening for RFID check-outs…'
                          : 'Last check-out ${_formatRelative(lastEventAt!)}')
                      : 'Sensors stopped — toggle to resume',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.onSurfaceVariant),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: isOnline ? 'Pause sensor' : 'Resume sensor',
            icon: Icon(isOnline ? Icons.pause_rounded : Icons.play_arrow_rounded),
            color: color,
            onPressed: onToggle,
          ),
        ],
      ),
    );
  }

  String _formatRelative(DateTime ts) {
    final diff = DateTime.now().difference(ts);
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
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
      variant: PfCardVariant.tinted,
      accent: color,
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.18),
                  borderRadius: AppRadius.rSm,
                ),
                child: Icon(icon, color: color, size: AppIconSize.sm),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            value,
            style: AppTheme.monoStyle(
              fontSize: AppTypography.titleLg,
              fontWeight: FontWeight.w700,
              color: AppTheme.onSurface,
            ),
          ),
          const SizedBox(height: AppSpacing.xxs),
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
    final accent = isOnline ? AppTheme.statusCompleted : AppTheme.statusUrgent;

    return PfCard(
      variant: PfCardVariant.surface,
      accent: accent,
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
                  color: accent,
                  boxShadow: [
                    if (isOnline)
                      BoxShadow(
                        color: accent.withValues(alpha: 0.4),
                        blurRadius: 8,
                        spreadRadius: 1,
                      ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                sensorId,
                style: AppTheme.monoStyle(fontSize: AppTypography.bodyMd, fontWeight: FontWeight.w600),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xxs,
                ),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  borderRadius: AppRadius.rPill,
                ),
                child: Text(
                  '${tags.length} tags',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: accent,
                        fontWeight: FontWeight.w600,
                      ),
                ),
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
                    Icon(Icons.qr_code_2_rounded, size: AppIconSize.xs, color: color),
                    const SizedBox(width: AppSpacing.xs),
                    Text(
                      item.tagUid ?? 'N/A',
                      style: AppTheme.monoStyle(
                        fontSize: AppTypography.caption,
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
  const _ActivityRow({required this.event, this.isFresh = false});

  final RfidCheckoutEvent event;
  final bool isFresh;

  @override
  Widget build(BuildContext context) {
    final accent = isFresh ? AppTheme.sensorActive : AppTheme.primary;
    return PfCard(
      variant: PfCardVariant.tinted,
      accent: accent,
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        children: [
          Container(
            width: AppIconSize.xl,
            height: AppIconSize.xl,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.18),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isFresh
                  ? Icons.fiber_manual_record_rounded
                  : Icons.qr_code_scanner_rounded,
              color: accent,
              size: isFresh ? AppIconSize.xs : AppIconSize.sm,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        event.materialVariantId,
                        style: AppTheme.monoStyle(fontSize: AppTypography.bodyMd, fontWeight: FontWeight.w600),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (isFresh) ...[
                      const SizedBox(width: AppSpacing.xs),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.xs,
                          vertical: 1,
                        ),
                        decoration: BoxDecoration(
                          color: AppTheme.sensorActive.withValues(alpha: 0.22),
                          borderRadius: AppRadius.rPill,
                        ),
                        child: Text(
                          'LIVE',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.6,
                            color: AppTheme.sensorActive,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  '${event.tagUid} • ${event.sensorId}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.onSurfaceVariant),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
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
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}