import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../auth/auth.dart';
import '../../components/components.dart';
import '../../design/tokens.dart';
import '../../services/firebase_inventory.dart' as fb_inventory;
import '../../services/firebase_rfid.dart' as fb_rfid;
import '../../theme/app_theme.dart';
import '../../utils/animations.dart';
import '../../models/rfid_event.dart';
import '../../models/inventory_item.dart';
import 'production_inventory.dart';

/// The RFID Sensor screen - the third tab in the Production shell.
///
/// Displays live sensor status, RFID activity feed, and per-tag status.
///
/// All data is sourced live from Firestore:
///   - `rfid_events` collection for the activity feed
///   - `sensors` collection for online/offline status
///   - `inventory` collection for per-sensor tag grouping and stock-at-risk
///
/// The previous 6-second in-app simulator has been removed; the screen now
/// only reflects events that the ESP32 (or a Cloud Function) actually writes
/// to `rfid_events`. When the collection is empty, an honest empty state is
/// shown instead of synthesized data.
class ProductionSensorScreen extends StatefulWidget {
  const ProductionSensorScreen({super.key});

  @override
  State<ProductionSensorScreen> createState() => _ProductionSensorScreenState();
}

class _ProductionSensorScreenState extends State<ProductionSensorScreen> {
  static const _sensorId = 'ESP32-01';
  int _feedNonce = 0;

  // ---- Scan feedback + last-scan card -----------------------------------
  // The first snapshot just hydrates (opening the tab must not beep);
  // every NEW event after that vibrates + beeps and refreshes the card.
  String? _lastScanKey;
  String? _lastScanTagUid;
  String? _lastScanVariantId;
  DateTime? _lastScanAt;

  // ---- Manual lookup -----------------------------------------------------
  final _lookupCtrl = TextEditingController();
  String _lookupQuery = '';

  @override
  void dispose() {
    _lookupCtrl.dispose();
    super.dispose();
  }

  void _syncScanFeedback(List<RfidCheckoutEvent> events) {
    if (events.isEmpty) return;
    final latest = events.first;
    final key = '${latest.tagUid}|${latest.timestamp.microsecondsSinceEpoch}';
    if (key == _lastScanKey) return;
    final isFirstSnapshot = _lastScanKey == null;
    setState(() {
      _lastScanKey = key;
      _lastScanTagUid = latest.tagUid;
      _lastScanVariantId = latest.materialVariantId;
      _lastScanAt = latest.timestamp;
    });
    if (isFirstSnapshot) return;
    // A real scan just landed: buzz + system alert tone so production
    // staff can hear/feel it even when not looking at the screen.
    HapticFeedback.mediumImpact();
    SystemSound.play(SystemSoundType.alert);
  }

  InventoryItem? _itemForTag(List<InventoryItem> items, String? tag) {
    if (tag == null) return null;
    for (final i in items) {
      if (i.tagUid == tag) return i;
    }
    return null;
  }

  List<InventoryItem> _lookupHits(List<InventoryItem> inventory) {
    final q = _lookupQuery;
    if (q.isEmpty) return const [];
    return inventory
        .where((i) =>
            (i.tagUid ?? '').toLowerCase().contains(q) ||
            i.materialVariantId.toLowerCase().contains(q) ||
            i.itemType.toLowerCase().contains(q))
        .take(5)
        .toList();
  }

  List<Widget> _buildLookupResults(List<InventoryItem> inventory) {
    if (_lookupQuery.isEmpty) return const [];
    final hits = _lookupHits(inventory);
    if (hits.isEmpty) {
      return [
        const SizedBox(height: AppSpacing.sm),
        Text(
          'No matching tag, variant or item.',
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: AppTheme.onSurfaceVariant),
        ),
      ];
    }
    return [
      const SizedBox(height: AppSpacing.xs),
      for (final item in hits)
        Padding(
          padding: const EdgeInsets.only(top: AppSpacing.sm),
          child: _LookupRow(item: item),
        ),
    ];
  }

  String _ago(DateTime d) {
    final diff = DateTime.now().difference(d);
    if (diff.inSeconds < 60) return '${diff.inSeconds}s ago';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  Future<void> _toggleSensor(bool currentlyOnline) async {
    HapticFeedback.mediumImpact();
    final actor = AuthProvider.of(context).currentUser;
    try {
      await fb_rfid.setSensorOnline(_sensorId, !currentlyOnline, actor: actor);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not update sensor status'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  /// Persists what a station tap means (check-in proof, stock-in
  /// receiving, or manual stock-out). The ESP32 reads this mode when it
  /// comes online; until then it documents the station's operating mode.
  Future<void> _setTapMode(String mode) async {
    HapticFeedback.selectionClick();
    final actor = AuthProvider.of(context).currentUser;
    try {
      await fb_rfid.setTapMode(_sensorId, mode, actor: actor);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not update tap mode'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    // Online state comes from the `sensors/{id}` doc (what the toggle
    // and the ESP32 actually write), not from inventory rows.
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      key: ValueKey('sensors-$_feedNonce'),
      stream: FirebaseFirestore.instance
          .collection('sensors')
          .doc(_sensorId)
          .snapshots(),
      builder: (context, sensorSnap) {
        final sensorData = sensorSnap.data?.data();
        // The mobile toggle writes `is_online`; the web console writes
        // `online`. Honor either writer; only when the doc does not exist
        // yet do we fall back to the inventory heuristic below.
        final bool? docOnline = sensorData == null
            ? null
            : (sensorData['is_online'] as bool?) ??
                (sensorData['online'] as bool?);
        return StreamBuilder<List<InventoryItem>>(
          key: ValueKey('inventory-$_feedNonce'),
          stream: fb_inventory.subscribeInventoryStream(),
          builder: (context, invSnap) {
            final inventory = invSnap.data ?? const <InventoryItem>[];
            return StreamBuilder<List<RfidCheckoutEvent>>(
              key: ValueKey('rfid-$_feedNonce'),
              stream: fb_rfid.subscribeRfidEventsStream(),
              builder: (context, rfidSnap) {
                // A failed feed must not masquerade as zero tags / zero
                // events — surface the error with a retry instead.
                final feedError =
                    invSnap.hasError || rfidSnap.hasError;
                if (feedError) {
                  final details =
                      '${invSnap.error ?? rfidSnap.error}';
                  return SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(AppSpacing.lg,
                        AppSpacing.md, AppSpacing.lg, AppSpacing.xxl),
                    child: PfErrorCard(
                      message:
                          'Live sensor data failed to load. Check your connection and permissions.',
                      details: details,
                      onRetry: () => setState(() => _feedNonce++),
                    ),
                  );
                }
                final events = rfidSnap.data ?? const <RfidCheckoutEvent>[];
                final tagsBySensor = _tagsBySensor(inventory);
                final tagsTracked =
                    inventory.where((i) => i.tagUid != null).length;
                final todayCount = _eventsToday(events);
                final lastEventAt =
                    events.isEmpty ? null : events.first.timestamp;
                final sensorOnline = docOnline ?? _isSensorOnline(inventory);

                // New scans: buzz + beep + refresh the Last-scan card.
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted) _syncScanFeedback(events);
                });

            return SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.xxl),
              child: StaggeredFadeIn(
                children: [
                  // Sensor pulse header
                  _SensorHeaderCard(
                    isOnline: sensorOnline,
                    lastEventAt: lastEventAt,
                    onToggle: () => _toggleSensor(sensorOnline),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  // Last scan - the most recent tag with its matched item
                  // and live stock, so a scan can be confirmed at a glance.
                  if (_lastScanAt != null) ...[
                    _LastScanCard(
                      tagUid: _lastScanTagUid ?? '-',
                      variantId: _lastScanVariantId ?? '-',
                      scannedAt: _lastScanAt!,
                      item: _itemForTag(inventory, _lastScanTagUid),
                      agoLabel: _ago(_lastScanAt!),
                      onTap: () {
                        final tag = _lastScanTagUid;
                        if (tag == null) return;
                        InventoryItem? found;
                        for (final i in inventory) {
                          if ((i.tagUid ?? '').trim().toUpperCase() ==
                              tag.trim().toUpperCase()) {
                            found = i;
                            break;
                          }
                        }
                        final match = found;
                        if (match == null) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                'No item is bound to tag $tag',
                              ),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                          return;
                        }
                        HapticFeedback.selectionClick();
                        showInventoryItemSheet(context, match);
                      },
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],
                  // Tap mode - what a station tap means once the ESP32
                  // is online. Persisted on the sensor doc; taps never
                  // move stock by themselves.
                  StreamBuilder<String>(
                    stream: fb_rfid.subscribeTapModeStream(_sensorId),
                    builder: (context, modeSnap) {
                      final mode = modeSnap.data ?? 'check-in';
                      return PfCard(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Station tap mode',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              'Decides what a tap means when the station is online. Taps never change stock directly.',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                      color: AppTheme.onSurfaceVariant),
                            ),
                            const SizedBox(height: AppSpacing.md),
                            PfSegmentedControl<String>(
                              value: mode,
                              onChanged: _setTapMode,
                              options: const [
                                PfSegmentOption(
                                  value: 'check-in',
                                  label: 'Check-in',
                                  icon: Icons.verified_outlined,
                                ),
                                PfSegmentOption(
                                  value: 'stock-in',
                                  label: 'Stock IN',
                                  icon: Icons.move_to_inbox_rounded,
                                ),
                                PfSegmentOption(
                                  value: 'stock-out',
                                  label: 'Stock OUT',
                                  icon: Icons.outbox_rounded,
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  // Manual lookup - find a tag / variant / item and see its
                  // live stock without waiting for a scan.
                  PfCard(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Manual lookup',
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          'Type a tag UID, variant ID or item name.',
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: AppTheme.onSurfaceVariant),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        PfTextField(
                          hintText: 'e.g. TAG-001, TEST-INK-01, Mug',
                          prefixIcon: Icons.search_rounded,
                          controller: _lookupCtrl,
                          onChanged: (v) => setState(
                            () => _lookupQuery = v.trim().toLowerCase(),
                          ),
                        ),
                        ..._buildLookupResults(inventory),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  // Sensor stats
                  Row(
                    children: [
                      Expanded(
                        child: _StatTile(
                          label: 'Active Sensors',
                          value: '${tagsBySensor.length}',
                          icon: Icons.sensors_rounded,
                          color: AppTheme.statusCompleted,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: _StatTile(
                          label: 'Tags Tracked',
                          value: '$tagsTracked',
                          icon: Icons.qr_code_2_rounded,
                          color: AppTheme.primary,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: _StatTile(
                          label: "Today's Events",
                          value: '$todayCount',
                          icon: Icons.event_note_rounded,
                          color: AppTheme.statusInProduction,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  // Stock-at-risk row - flags low/insufficient variants that
                  // the sensor is currently tracking, so production staff can
                  // re-order before the next RFID checkout drives stock to 0.
                  _StockAtRiskBanner(
                    lowCount: inventory
                        .where((i) =>
                            i.sensorId != null &&
                            (i.status == 'Low Stock' ||
                                i.status == 'Insufficient Stock'))
                        .length,
                    insufficientCount: inventory
                        .where((i) =>
                            i.sensorId != null &&
                            i.status == 'Insufficient Stock')
                        .length,
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  // Sensors section
                  const PfSectionHeader(
                    title: 'Connected Sensors',
                    subtitle: 'Live RFID reader status',
                  ),
                  const SizedBox(height: AppSpacing.md),
                  if (tagsBySensor.isEmpty)
                    _buildNoSensorsEmpty()
                  else
                    ...tagsBySensor.entries.map((entry) => Column(
                          children: [
                            _SensorCard(
                              sensorId: entry.key,
                              tags: entry.value,
                              isOnline: sensorOnline,
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
                  if (events.isEmpty)
                    _buildNoEventsEmpty()
                  else
                    ...events.take(8).map((event) => Column(
                          children: [
                            _ActivityRow(
                              event: event,
                              isFresh: lastEventAt != null &&
                                  event.timestamp == lastEventAt,
                            ),
                            const SizedBox(height: AppSpacing.sm),
                          ],
                        )),
                ],
              ),
            );
              },
            );
          },
        );
      },
    );
  }

  // ----------------------------------------------
  // Helpers - derive UI state from live Firestore
  // ----------------------------------------------
  Map<String, List<InventoryItem>> _tagsBySensor(List<InventoryItem> items) {
    final grouped = <String, List<InventoryItem>>{};
    for (final item in items) {
      if (item.sensorId == null) continue;
      grouped.putIfAbsent(item.sensorId!, () => []).add(item);
    }
    return grouped;
  }

  /// Counts events whose timestamp falls on the current local calendar day.
  int _eventsToday(List<RfidCheckoutEvent> events) {
    final now = DateTime.now();
    final start = DateTime(now.year, now.month, now.day);
    return events.where((e) => !e.timestamp.isBefore(start)).length;
  }

  /// Last-resort heuristic for sensor online state (used only when the
  /// `sensors/{id}` doc does not exist yet): at least one tracked tag
  /// exists for the default sensor ID.
  bool _isSensorOnline(List<InventoryItem> items) {
    return items.any((i) => i.sensorId == _sensorId);
  }

  Widget _buildNoEventsEmpty() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxl),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppTheme.sensorActive.withValues(alpha: 0.10),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.wifi_off_rounded,
                size: 48,
                color: AppTheme.sensorActive,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'No events yet - waiting for $_sensorId to come online',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w600),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Activity will appear here as soon as the ESP32 station posts its first RFID checkout.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppTheme.onSurfaceVariant,
                  ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNoSensorsEmpty() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
      child: Center(
        child: Text(
          'No sensors are bound to a material variant yet.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppTheme.onSurfaceVariant,
              ),
          textAlign: TextAlign.center,
        ),
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
                  style: Theme.of(context)
                      .textTheme
                      .titleLarge
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  isOnline
                      ? (lastEventAt == null
                          ? 'Listening for RFID check-outs...'
                          : 'Last check-out ${_formatRelative(lastEventAt!)}')
                      : 'Sensors stopped - toggle to resume',
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(color: AppTheme.onSurfaceVariant),
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
            style: Theme.of(context)
                .textTheme
                .labelSmall
                ?.copyWith(color: AppTheme.onSurfaceVariant),
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
                style: AppTheme.monoStyle(
                    fontSize: AppTypography.bodyMd, fontWeight: FontWeight.w600),
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
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm, vertical: AppSpacing.xxs),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: AppRadius.rSm,
                  border: Border.all(color: color.withValues(alpha: 0.3)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.qr_code_2_rounded,
                        size: AppIconSize.xs, color: color),
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
                        style: AppTheme.monoStyle(
                            fontSize: AppTypography.bodyMd,
                            fontWeight: FontWeight.w600),
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
                  '${event.tagUid} - ${event.sensorId}',
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: AppTheme.onSurfaceVariant),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            _formatRelativeTime(event.timestamp),
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: AppTheme.onSurfaceVariant),
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

/// Inline alert shown under the stat tiles when one or more sensor-tracked
/// variants are below their reorder point. Tapping the tile navigates to the
/// inventory tab in the POS shell (handled at the parent shell level via
/// the [onTap] callback).
class _StockAtRiskBanner extends StatelessWidget {
  const _StockAtRiskBanner({
    required this.lowCount,
    required this.insufficientCount,
  });

  final int lowCount;
  final int insufficientCount;

  @override
  Widget build(BuildContext context) {
    // Quiet, semantic background - not an error toast. We don't escalate to
    // a full PfCard border so it doesn't compete with the sensor header.
    if (lowCount == 0 && insufficientCount == 0) {
      return Row(
        children: [
          Icon(
            Icons.check_circle_rounded,
            size: AppIconSize.sm,
            color: AppTheme.statusCompleted,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              'All sensor-tracked variants are above reorder point.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppTheme.onSurfaceVariant,
                  ),
            ),
          ),
        ],
      );
    }
    final color = insufficientCount > 0
        ? AppTheme.statusUrgent
        : AppTheme.statusReadyForPickup;
    return PfCard(
      variant: PfCardVariant.tinted,
      accent: color,
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        children: [
          Icon(Icons.warning_amber_rounded, color: color, size: AppIconSize.md),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  insufficientCount > 0
                      ? '$insufficientCount sensor-tracked variant${insufficientCount == 1 ? '' : 's'} below minimum'
                      : '$lowCount sensor-tracked variant${lowCount == 1 ? '' : 's'} nearing reorder point',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppTheme.onSurface,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  'Restock before the next RFID check-out drives stock to zero.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
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

/// The most recent scan: tag, matched item (if bound), live stock and how
/// long ago it arrived.
class _LastScanCard extends StatelessWidget {
  const _LastScanCard({
    required this.tagUid,
    required this.variantId,
    required this.scannedAt,
    required this.agoLabel,
    this.item,
    this.onTap,
  });

  final String tagUid;
  final String variantId;
  final DateTime scannedAt;
  final String agoLabel;
  final InventoryItem? item;

  /// Tapping the card jumps straight to the item's action sheet.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return PfCard(
      onTap: onTap,
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppTheme.primary.withValues(alpha: 0.12),
              borderRadius: AppRadius.rSm,
            ),
            child: Icon(Icons.nfc_rounded, color: AppTheme.primary, size: 20),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'Last scan',
                      style: Theme.of(context)
                          .textTheme
                          .titleSmall
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      agoLabel,
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: AppTheme.onSurfaceVariant),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  tagUid,
                  style: AppTheme.monoStyle(fontSize: 12, color: AppTheme.onSurface),
                ),
                Text(
                  item == null
                      ? variantId
                      : '${item!.itemType} - ${item!.materialVariantId}',
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: AppTheme.onSurfaceVariant),
                ),
              ],
            ),
          ),
          if (item != null) ...[
            const SizedBox(width: AppSpacing.sm),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${item!.currentStock}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: AppTheme.onSurface,
                      ),
                ),
                const SizedBox(height: 2),
                PfStatusBadge.stock(item!.status, size: PfBadgeSize.tiny),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// One manual-lookup hit: variant, item, tag and live stock.
class _LookupRow extends StatelessWidget {
  const _LookupRow({required this.item});

  final InventoryItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppTheme.surfaceContainerLow,
        borderRadius: AppRadius.rSm,
        border: Border.all(
          color: Theme.of(context).colorScheme.outlineVariant,
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${item.itemType} - ${item.materialVariantId}',
                  style: Theme.of(context)
                      .textTheme
                      .titleSmall
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  item.tagUid == null
                      ? 'No tag bound'
                      : 'Tag ${item.tagUid}',
                  style: AppTheme.monoStyle(
                    fontSize: 11,
                    color: AppTheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            '${item.currentStock}',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: AppTheme.onSurface,
                ),
          ),
          const SizedBox(width: AppSpacing.sm),
          PfStatusBadge.stock(item.status, size: PfBadgeSize.tiny),
        ],
      ),
    );
  }
}
