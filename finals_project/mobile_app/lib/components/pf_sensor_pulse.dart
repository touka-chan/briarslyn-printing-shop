import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../theme/app_theme.dart';

/// A live "sensor online" indicator with a pulsing dot animation.
///
/// Displays a small circular dot that pulses (scales from 1.0 to 1.4) when
/// [online] is true. The dot color changes based on the online state:
/// - Online: emerald green ([AppTheme.sensorActive])
/// - Offline: amber ([AppTheme.sensorStale])
///
/// Optionally displays a label next to the dot and a "last sync" timestamp
/// below. Respects reduced motion accessibility setting.
class PfSensorPulse extends StatefulWidget {
  const PfSensorPulse({
    super.key,
    this.online = true,
    required this.label,
    this.lastSync,
  });

  /// Whether the sensor is currently online and active.
  final bool online;

  /// The label to display next to the pulse dot (e.g., "RFID-001").
  final String label;

  /// Optional last sync timestamp (e.g., "12s ago").
  final String? lastSync;

  @override
  State<PfSensorPulse> createState() => _PfSensorPulseState();
}

class _PfSensorPulseState extends State<PfSensorPulse>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: AppMotion.pulse,
  );

  late final Animation<double> _scaleAnimation = Tween<double>(
    begin: 1.0,
    end: 1.4,
  ).animate(
    CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    ),
  );

  @override
  void initState() {
    super.initState();
    _updateAnimation();
  }

  @override
  void didUpdateWidget(covariant PfSensorPulse oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.online != widget.online) {
      _updateAnimation();
    }
  }

  void _updateAnimation() {
    if (widget.online) {
      final reducedMotion =
          MediaQuery.maybeOf(context)?.disableAnimations ?? false;
      if (!reducedMotion) {
        _controller.repeat(reverse: true);
      }
    } else {
      _controller.stop();
      _controller.value = 0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.online
        ? AppTheme.sensorActive
        : AppTheme.sensorStale;

    final reducedMotion =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Pulse dot
        SizedBox(
          width: 12,
          height: 12,
          child: widget.online && !reducedMotion
              ? AnimatedBuilder(
                  animation: _scaleAnimation,
                  builder: (context, child) {
                    return Transform.scale(
                      scale: _scaleAnimation.value,
                      child: child,
                    );
                  },
                  child: Container(
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                    ),
                  ),
                )
              : Container(
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                  ),
                ),
        ),
        const SizedBox(width: AppSpacing.xs),

        // Label and last sync
        Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                fontWeight: FontWeight.w500,
                color: AppTheme.onSurfaceVariant,
              ),
            ),
            if (widget.lastSync != null) ...[
              const SizedBox(height: 2),
              Text(
                widget.lastSync!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontSize: 10,
                  color: AppTheme.onSurfaceVariant.withValues(alpha: 0.7),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}
