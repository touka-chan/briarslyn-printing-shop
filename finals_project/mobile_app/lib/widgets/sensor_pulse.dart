import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// IoT sensor indicator with pulse animation - mirrors the web "Sensor (IoT)"
/// column with active/stale pulse dot. Title 1 Section X (ESP32 RFID).
class SensorPulse extends StatefulWidget {
  final String sensorId;
  final bool isStale;
  final bool showLabel;
  final double dotSize;

  const SensorPulse({
    super.key,
    required this.sensorId,
    this.isStale = false,
    this.showLabel = true,
    this.dotSize = 8,
  });

  @override
  State<SensorPulse> createState() => _SensorPulseState();
}

class _SensorPulseState extends State<SensorPulse>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.isStale ? AppTheme.sensorStale : AppTheme.sensorActive;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (!widget.isStale)
          AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              final t = _controller.value;
              return Stack(
                alignment: Alignment.center,
                children: [
                  Opacity(
                    opacity: (1 - t).clamp(0.0, 1.0),
                    child: Container(
                      width: widget.dotSize * (1 + t * 1.4),
                      height: widget.dotSize * (1 + t * 1.4),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.35),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                  Container(
                    width: widget.dotSize,
                    height: widget.dotSize,
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              );
            },
          )
        else
          Container(
            width: widget.dotSize,
            height: widget.dotSize,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
        if (widget.showLabel) ...[
          const SizedBox(width: 6),
          Text(
            widget.sensorId,
            style: const TextStyle(
              fontFamily: 'monospace',
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: AppTheme.onSurfaceVariant,
            ),
          ),
        ],
      ],
    );
  }
}
