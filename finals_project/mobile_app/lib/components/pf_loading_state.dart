import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../theme/app_theme.dart';

/// Loading and skeleton utilities for PrintFlow Mobile.
///
/// Provides three common patterns:
///   * [PfLoadingState.compact] — inline spinner + label for buttons/cells.
///   * [PfLoadingState.skeleton] — gray rounded rectangle that pulses
///     (static under reduced motion) for skeleton lists.
///   * [PfLoadingState.fullScreen] — centered spinner with optional message.
class PfLoadingState {
  PfLoadingState._();

  /// Inline compact loader: small spinner + optional label.
  ///
  /// Use inside table cells, button labels, or next to content that is
  /// being refreshed.
  ///
  /// Example:
  /// ```dart
  /// Row(
  ///   children: [
  ///     Text('Syncing...'),
  ///     const SizedBox(width: AppSpacing.sm),
  ///     PfLoadingState.compact(label: 'Loading'),
  ///   ],
  /// )
  /// ```
  static Widget compact({String? label}) {
    return _CompactLoader(label: label);
  }

  /// Skeleton rectangle — a gray block that pulses to indicate content
  /// is loading.
  ///
  /// Use to build skeleton screens by combining multiple [skeleton]
  /// widgets (e.g. a line for a title, a taller block for a card body).
  ///
  /// [width] defaults to double.infinity (fills parent). [height]
  /// defaults to 16 (one text line). [radius] defaults to [AppRadius.sm].
  ///
  /// Respects reduced motion: when animations are disabled the pulse
  /// is suppressed and a static surfaceContainer color is shown.
  ///
  /// Example:
  /// ```dart
  /// Column(
  ///   crossAxisAlignment: CrossAxisAlignment.start,
  ///   children: [
  ///     PfLoadingState.skeleton(width: 120, height: 20),
  ///     const SizedBox(height: AppSpacing.sm),
  ///     PfLoadingState.skeleton(height: 12),
  ///     PfLoadingState.skeleton(height: 12),
  ///   ],
  /// )
  /// ```
  static Widget skeleton({
    double? width,
    double height = 16,
    double radius = AppRadius.sm,
  }) {
    return _SkeletonLoader(
      width: width,
      height: height,
      radius: radius,
    );
  }

  /// Full-screen centered loader with an optional message.
  ///
  /// Use as the `body` of a [Scaffold] when an entire screen is loading.
  ///
  /// Example:
  /// ```dart
  /// Scaffold(
  ///   body: PfLoadingState.fullScreen('Loading orders...'),
  /// )
  /// ```
  static Widget fullScreen(String? message) {
    return _FullScreenLoader(message: message);
  }
}

class _CompactLoader extends StatelessWidget {
  const _CompactLoader({this.label});

  final String? label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // Reduced motion not applicable for compact spinner

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: AppIconSize.sm,
          height: AppIconSize.sm,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation<Color>(AppTheme.primary),
          ),
        ),
        if (label != null) ...[
          const SizedBox(width: AppSpacing.sm),
          Text(
            label!,
            style: theme.textTheme.bodySmall?.copyWith(
              color: AppTheme.onSurfaceVariant,
            ),
          ),
        ],
      ],
    );
  }
}

class _SkeletonLoader extends StatefulWidget {
  const _SkeletonLoader({
    this.width,
    required this.height,
    required this.radius,
  });

  final double? width;
  final double height;
  final double radius;

  @override
  State<_SkeletonLoader> createState() => _SkeletonLoaderState();
}

class _SkeletonLoaderState extends State<_SkeletonLoader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: AppMotion.pulse,
  )..repeat(reverse: true);

  late final Animation<double> _opacity = Tween<double>(
    begin: 0.4,
    end: 0.8,
  ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reducedMotion = MediaQuery.maybeOf(context)?.disableAnimations ?? false;

    if (reducedMotion) {
      return Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: AppTheme.surfaceContainer,
          borderRadius: BorderRadius.circular(widget.radius),
        ),
      );
    }

    return AnimatedBuilder(
      animation: _opacity,
      builder: (context, _) {
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            color: AppTheme.surfaceContainer.withValues(
              alpha: _opacity.value,
            ),
            borderRadius: BorderRadius.circular(widget.radius),
          ),
        );
      },
    );
  }
}

class _FullScreenLoader extends StatelessWidget {
  const _FullScreenLoader({this.message});

  final String? message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(AppTheme.primary),
          ),
          if (message != null) ...[
            const SizedBox(height: AppSpacing.lg),
            Text(
              message!,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppTheme.onSurfaceVariant,
              ),
            ),
          ],
        ],
      ),
    );
  }
}