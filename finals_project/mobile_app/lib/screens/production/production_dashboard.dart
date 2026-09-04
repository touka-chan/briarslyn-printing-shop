import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../design/tokens.dart';
import '../../theme/app_theme.dart';
import '../../widgets/status_badge.dart';
import '../../widgets/sensor_pulse.dart';

class ProductionDashboard extends StatelessWidget {
  const ProductionDashboard({super.key});

  // Sample queue — matches the 8 mock orders from web/src/lib/mockData.ts
  static const List<Map<String, dynamic>> _queue = [
    {
      'order_id': 'ORD-1023',
      'item_type': 'T-shirt Printing',
      'priority': 'Overdue',
      'status': 'Pending',
      'target_date': '2026-08-14',
      'eta': '2026-08-16',
      'based_on': ['backlog', 'job_complexity', 'capacity'],
    },
    {
      'order_id': 'ORD-1024',
      'item_type': 'Tarpaulin - Medium',
      'priority': 'Urgent',
      'status': 'In Production',
      'target_date': '2026-08-20',
      'eta': '2026-08-21',
      'based_on': ['backlog', 'capacity'],
    },
    {
      'order_id': 'ORD-1025',
      'item_type': 'Tarpaulin - Large',
      'priority': 'Upcoming',
      'status': 'Pending',
      'target_date': '2026-08-25',
      'eta': '2026-08-27',
      'based_on': ['job_complexity', 'capacity'],
    },
    {
      'order_id': 'PF-2024-005',
      'item_type': 'Screen Print - Shirt Blank Black',
      'priority': 'Urgent',
      'status': 'In Production',
      'target_date': '2026-08-19',
      'eta': '2026-08-20',
      'based_on': ['backlog', 'capacity'],
    },
  ];

  String _factorLabel(String f) => switch (f) {
        'backlog' => 'Shop Backlog',
        'job_complexity' => 'Job Complexity',
        'capacity' => 'Capacity Limit',
        _ => f,
      };

  void _nextStatus(String current, BuildContext context) {
    const flow = ['Pending', 'In Production', 'Ready for Pickup', 'Completed'];
    final idx = flow.indexOf(current);
    if (idx == -1 || idx == flow.length - 1) return;
    final next = flow[idx + 1];
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Status updated: $current → $next'),
        backgroundColor: AppTheme.success,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dateFmt = DateFormat('MMM d');
    return Scaffold(
      appBar: AppBar(
        title: const Text('Production Queue'),
        actions: [
          IconButton(icon: const Icon(Icons.notifications_outlined), onPressed: () {}),
          IconButton(icon: const Icon(Icons.logout), onPressed: () => Navigator.pop(context)),
        ],
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(40),
          child: Padding(
            padding: EdgeInsets.fromLTRB(AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.md),
            child: Row(
              children: [
                SensorPulse(sensorId: 'ESP32-01'),
                SizedBox(width: AppSpacing.sm),
                Text('RFID station online', style: TextStyle(fontSize: AppTypography.caption, color: AppTheme.onSurfaceVariant)),
              ],
            ),
          ),
        ),
      ),
      body: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: _queue.length,
        separatorBuilder: (context, index) => const SizedBox(height: AppSpacing.sm),
        itemBuilder: (context, i) {
          final r = _queue[i];
          final basedOn = (r['based_on'] as List).cast<String>();
          return Card(
            child: InkWell(
              borderRadius: AppRadius.rMd,
              onTap: () {
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  shape: const RoundedRectangleBorder(
                    borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
                  ),
                  builder: (modalContext) => _orderDetails(r, basedOn, dateFmt, modalContext),
                );
              },
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          r['order_id'] as String,
                          style: AppTheme.monoStyle(
                            fontSize: AppTypography.label,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const Spacer(),
                        StatusBadge.priority(r['priority'] as String, dense: true),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs + 2),
                    Text(r['item_type'] as String, style: const TextStyle(fontSize: AppTypography.bodyMd, fontWeight: FontWeight.w600)),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: [
                        StatusBadge.orderStatus(r['status'] as String, dense: true),
                        const SizedBox(width: AppSpacing.sm),
                        Icon(Icons.event, size: AppIconSize.xs, color: AppTheme.onSurfaceVariant),
                        const SizedBox(width: AppSpacing.xs),
                        Text('Target ${dateFmt.format(DateTime.parse(r['target_date'] as String))}',
                            style: const TextStyle(fontSize: AppTypography.caption, color: AppTheme.onSurfaceVariant)),
                        const SizedBox(width: AppSpacing.sm),
                        const Icon(Icons.flag, size: AppIconSize.xs, color: AppTheme.primary),
                        const SizedBox(width: AppSpacing.xs),
                        Text('ETA ${dateFmt.format(DateTime.parse(r['eta'] as String))}',
                            style: const TextStyle(fontSize: AppTypography.caption, fontWeight: FontWeight.w600, color: AppTheme.primary)),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: AppSpacing.xs,
                      children: basedOn
                          .map((f) => Container(
                                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xxs),
                                decoration: BoxDecoration(
                                  color: AppTheme.primary.withValues(alpha: 0.08),
                                  borderRadius: AppRadius.rXs,
                                  border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
                                ),
                                child: Text(
                                  _factorLabel(f).toUpperCase(),
                                  style: const TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w600,
                                    color: AppTheme.primary,
                                  ),
                                ),
                              ))
                          .toList(),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _orderDetails(Map<String, dynamic> r, List<String> basedOn, DateFormat dateFmt, BuildContext modalContext) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.65,
      maxChildSize: 0.9,
      minChildSize: 0.4,
      builder: (sheetContext, controller) => SingleChildScrollView(
        controller: controller,
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppTheme.onSurfaceVariant.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Row(
              children: [
                Text(r['order_id'] as String, style: AppTheme.monoStyle(fontSize: AppTypography.bodyMd, fontWeight: FontWeight.w700)),
                const Spacer(),
                StatusBadge.priority(r['priority'] as String),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Text(r['item_type'] as String, style: const TextStyle(fontSize: AppTypography.titleLg, fontWeight: FontWeight.w600)),
            const SizedBox(height: AppSpacing.lg),
            _detailRow('Status', r['status'] as String),
            _detailRow('Target Date', r['target_date'] as String),
            _detailRow('ETA', r['eta'] as String),
            const SizedBox(height: AppSpacing.lg),
            const Text('Queue Factors (ETA rationale)', style: TextStyle(fontSize: AppTypography.label, fontWeight: FontWeight.w700, color: AppTheme.onSurfaceVariant)),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: basedOn
                  .map((f) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs + 1),
                        decoration: BoxDecoration(
                          color: AppTheme.primary.withValues(alpha: 0.10),
                          borderRadius: AppRadius.rPill,
                          border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
                        ),
                        child: Text(
                          _factorLabel(f),
                          style: const TextStyle(fontSize: AppTypography.label, color: AppTheme.primary, fontWeight: FontWeight.w600),
                        ),
                      ))
                  .toList(),
            ),
            const SizedBox(height: AppSpacing.xl),
            FilledButton.icon(
              onPressed: () {
                Navigator.pop(modalContext);
                _nextStatus(r['status'] as String, modalContext);
              },
              icon: const Icon(Icons.arrow_forward),
              label: const Text('Advance to Next Status'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs + 2),
      child: Row(
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: const TextStyle(fontSize: AppTypography.label, color: AppTheme.onSurfaceVariant)),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: AppTypography.bodyMd, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}
