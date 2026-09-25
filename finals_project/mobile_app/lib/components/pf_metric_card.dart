import 'package:flutter/material.dart';
import 'dart:math' as math;

import '../design/tokens.dart';
import '../theme/app_theme.dart';

/// A metric card with an embedded sparkline chart.
///
/// Displays a large metric value with label, trend indicator, and a
/// micro-chart showing the metric's recent history. The sparkline uses
/// the "Ink Stroke" visual language - a fluid line drawing that connects
/// data points with organic curves.
///
/// This is a signature component of the "Ink & Paper" design system,
/// making numeric dashboards feel more dynamic and connected to live data.
class PfMetricCard extends StatelessWidget {
  const PfMetricCard({
    super.key,
    required this.value,
    required this.label,
    required this.icon,
    this.accentColor,
    this.change,
    this.changePositive = true,
    this.sparklineData,
    this.prefix = '',
    this.suffix = '',
  });

  final num value;
  final String label;
  final IconData icon;

  /// Defaults to [AppTheme.primary] at build time (the palette is live and
  /// cannot be a compile-time default).
  final Color? accentColor;
  final String? change;
  final bool changePositive;
  final List<double>? sparklineData;
  final String prefix;
  final String suffix;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final hasSparkline = sparklineData != null && sparklineData!.length >= 2;
    final accent = accentColor ?? AppTheme.primary;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: AppRadius.rLg,
        border: Border.all(
          color: Theme.of(context).colorScheme.outlineVariant,
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: accent.withValues(alpha: 0.08),
            blurRadius: 12,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row: icon + change badge
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.xs),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  borderRadius: AppRadius.rSm,
                ),
                child: Icon(
                  icon,
                  size: AppIconSize.md,
                  color: accent,
                ),
              ),
              const Spacer(),
              if (change != null)
                _ChangeBadge(
                  change: change!,
                  positive: changePositive,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          // Value - large display text
          Text(
            '$prefix${_formatValue(value)}$suffix',
            style: textTheme.displayMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppTheme.onSurface,
              height: 1.0,
            ),
          ),
          const SizedBox(height: AppSpacing.xxs),
          // Label
          Text(
            label,
            style: textTheme.bodySmall?.copyWith(
              color: AppTheme.onSurfaceVariant,
              fontWeight: FontWeight.w500,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          // Sparkline (if data provided)
          if (hasSparkline) ...[
            const SizedBox(height: AppSpacing.sm),
            SizedBox(
              height: 32,
              child: _Sparkline(
                data: sparklineData!,
                color: accent,
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _formatValue(num value) {
    if (value >= 1000000) {
      return '${(value / 1000000).toStringAsFixed(1)}M';
    } else if (value >= 1000) {
      return '${(value / 1000).toStringAsFixed(1)}K';
    } else if (value is double && value != value.toInt()) {
      return value.toStringAsFixed(1);
    }
    return value.toString();
  }
}

/// Change indicator badge showing trend direction and magnitude.
class _ChangeBadge extends StatelessWidget {
  const _ChangeBadge({
    required this.change,
    required this.positive,
  });

  final String change;
  final bool positive;

  @override
  Widget build(BuildContext context) {
    final color = positive ? AppTheme.success : AppTheme.statusOverdue;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.xs,
        vertical: AppSpacing.xxs,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: AppRadius.rSm,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            positive ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
            size: AppIconSize.xs,
            color: color,
          ),
          const SizedBox(width: AppSpacing.xxs),
          Text(
            change,
            style: AppTheme.monoStyle(
              fontSize: AppTypography.caption,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

/// Sparkline micro-chart with smooth cubic curves.
///
/// Draws a fluid line through the data points using cubic Bezier curves
/// for the "Ink Stroke" aesthetic - organic, hand-drawn feel rather than
/// rigid straight segments.
class _Sparkline extends StatelessWidget {
  const _Sparkline({
    required this.data,
    required this.color,
  });

  final List<double> data;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _SparklinePainter(
        data: data,
        color: color,
      ),
      child: Container(),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  _SparklinePainter({
    required this.data,
    required this.color,
  });

  final List<double> data;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (data.length < 2) return;

    final paint = Paint()
      ..color = color
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final fillPaint = Paint()
      ..color = color.withValues(alpha: 0.08)
      ..style = PaintingStyle.fill;

    // Normalize data to fit canvas
    final minValue = data.reduce(math.min);
    final maxValue = data.reduce(math.max);
    final range = maxValue - minValue;
    final padding = size.height * 0.1;

    List<Offset> points = [];
    for (int i = 0; i < data.length; i++) {
      final x = (i / (data.length - 1)) * size.width;
      final normalizedY = range == 0 ? 0.5 : (data[i] - minValue) / range;
      final y = size.height - (normalizedY * (size.height - 2 * padding) + padding);
      points.add(Offset(x, y));
    }

    // Draw smooth curve through points using cubic Bezier
    final path = Path();
    path.moveTo(points[0].dx, points[0].dy);

    for (int i = 0; i < points.length - 1; i++) {
      final p0 = points[i];
      final p1 = points[i + 1];
      final controlPointX = (p0.dx + p1.dx) / 2;

      path.cubicTo(
        controlPointX, p0.dy,
        controlPointX, p1.dy,
        p1.dx, p1.dy,
      );
    }

    // Draw fill gradient under the curve
    final fillPath = Path.from(path);
    fillPath.lineTo(size.width, size.height);
    fillPath.lineTo(0, size.height);
    fillPath.close();
    canvas.drawPath(fillPath, fillPaint);

    // Draw the stroke line
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter oldDelegate) {
    return oldDelegate.data != data || oldDelegate.color != color;
  }
}
