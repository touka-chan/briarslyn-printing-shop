import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// KPI card - mirrors the web `KpiCard.tsx`. Used on dashboard summaries.
class KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final String? change;
  final bool positiveChange;
  final IconData icon;
  final VoidCallback? onTap;

  const KpiCard({
    super.key,
    required this.label,
    required this.value,
    this.change,
    this.positiveChange = true,
    required this.icon,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(icon, size: 20, color: AppTheme.primary),
                  ),
                  const Spacer(),
                  if (change != null)
                    Text(
                      change!,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: positiveChange
                            ? AppTheme.success
                            : AppTheme.statusOverdue,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.onSurface,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppTheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
