import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/tokens.dart';

/// A widget that animates a numeric value from its previous value (or 0 on
/// first build) to [value] over [duration] using an `easeOutCubic` curve.
///
/// Supports `int`, `double`, and `String` values:
///   * `int`   - rendered without decimals.
///   * `double` - rendered with up to 2 decimal places.
///   * `String` - rendered as-is.
///
/// Respects [MediaQuery.disableAnimationsOf]; when accessibility animations
/// are disabled the final value is shown immediately without animating.
class AnimatedCountUp extends StatefulWidget {
  const AnimatedCountUp({
    super.key,
    required this.value,
    this.duration = AppMotion.countUp,
    this.style,
    this.prefix = '',
    this.suffix = '',
    this.textAlign,
  });

  /// Target value to animate to.
  final Object value;

  /// Duration of the count-up animation.
  final Duration duration;

  /// Optional text style. Defaults to `Theme.of(context).textTheme.titleLarge`.
  final TextStyle? style;

  /// Optional prefix prepended to the formatted number.
  final String prefix;

  /// Optional suffix appended to the formatted number.
  final String suffix;

  /// Optional text alignment.
  final TextAlign? textAlign;

  @override
  State<AnimatedCountUp> createState() => _AnimatedCountUpState();
}

class _AnimatedCountUpState extends State<AnimatedCountUp>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late Animation<double> _animation;
  double _previousValue = 0;
  bool _firstFrame = true;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
    );
    _previousValue = 0;
    _animation = Tween<double>(begin: 0, end: _toDouble(widget.value)).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_firstFrame) {
      _firstFrame = false;
      WidgetsBinding.instance.addPostFrameCallback((_) => _startAnimation());
    }
  }

  @override
  void didUpdateWidget(covariant AnimatedCountUp oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value) {
      _previousValue = _toDouble(oldWidget.value);
      _animation = Tween<double>(
        begin: _previousValue,
        end: _toDouble(widget.value),
      ).animate(
        CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
      );
      _startAnimation();
    }
  }

  void _startAnimation() {
    if (!mounted) return;
    final reducedMotion = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (reducedMotion) {
      _controller.value = 1;
      return;
    }
    _controller
      ..reset()
      ..forward();
  }

  double _toDouble(Object value) {
    if (value is int) return value.toDouble();
    if (value is double) return value;
    return 0;
  }

  String _format(Object value) {
    if (value is int) return value.toString();
    if (value is double) {
      if (value == value.truncateToDouble()) {
        return value.toStringAsFixed(0);
      }
      return value.toStringAsFixed(2);
    }
    return value.toString();
  }

  String _formatAnimated(double current) {
    final target = widget.value;
    if (target is int) {
      return current.round().toString();
    }
    if (target is double) {
      if (current == current.truncateToDouble()) {
        return current.toStringAsFixed(0);
      }
      return current.toStringAsFixed(2);
    }
    return current.toStringAsFixed(0);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reducedMotion =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final textStyle =
        widget.style ?? Theme.of(context).textTheme.titleLarge;

    if (widget.value is String) {
      return Text(
        '${widget.prefix}${widget.value}${widget.suffix}',
        style: textStyle,
        textAlign: widget.textAlign,
      );
    }

    if (reducedMotion) {
      return Text(
        '${widget.prefix}${_format(widget.value)}${widget.suffix}',
        style: textStyle,
        textAlign: widget.textAlign,
      );
    }

    return AnimatedBuilder(
      animation: _animation,
      builder: (context, _) {
        return Text(
          '${widget.prefix}${_formatAnimated(_animation.value)}${widget.suffix}',
          style: textStyle,
          textAlign: widget.textAlign,
        );
      },
    );
  }
}

/// Internal animated item used by [StaggeredFadeIn]. Each item fades in and
/// slides upward into place.
class _StaggeredItem extends StatelessWidget {
  const _StaggeredItem({
    required this.child,
    required this.animation,
  });

  final Widget child;
  final Animation<double> animation;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (context, builderChild) {
        final t = animation.value.clamp(0.0, 1.0);
        return Opacity(
          opacity: t,
          child: Transform.translate(
            offset: Offset(0, 16 * (1 - t)),
            child: builderChild,
          ),
        );
      },
      child: child,
    );
  }
}

/// A widget that renders a [Column] (with `mainAxisSize: min`) and fades in
/// each child sequentially with a configurable stagger.
class StaggeredFadeIn extends StatefulWidget {
  const StaggeredFadeIn({
    super.key,
    required this.children,
    this.delay = Duration.zero,
    this.stagger = const Duration(milliseconds: 60),
    this.duration = const Duration(milliseconds: 350),
    this.spacing = 0,
  });

  /// Children to render inside the column. Each is animated independently.
  final List<Widget> children;

  /// Delay before the first child starts animating.
  final Duration delay;

  /// Time between the start of each successive child.
  final Duration stagger;

  /// Duration of each child's individual animation.
  final Duration duration;

  /// Vertical spacing inserted between children.
  final double spacing;

  @override
  State<StaggeredFadeIn> createState() => _StaggeredFadeInState();
}

class _StaggeredFadeInState extends State<StaggeredFadeIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  bool _firstFrame = true;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: _totalDuration(),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_firstFrame) {
      _firstFrame = false;
      WidgetsBinding.instance.addPostFrameCallback((_) => _kickoff());
    }
  }

  @override
  void didUpdateWidget(covariant StaggeredFadeIn oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.children.length != widget.children.length ||
        oldWidget.delay != widget.delay ||
        oldWidget.stagger != widget.stagger ||
        oldWidget.duration != widget.duration) {
      _controller.duration = _totalDuration();
      _kickoff();
    }
  }

  Duration _totalDuration() {
    final extra = widget.children.isEmpty
        ? Duration.zero
        : widget.stagger * (widget.children.length - 1);
    return widget.delay + widget.duration + extra;
  }

  void _kickoff() {
    if (!mounted) return;
    final reducedMotion =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (reducedMotion) {
      _controller.value = 1;
      return;
    }
    _controller
      ..reset()
      ..forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reducedMotion =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;

    final children = <Widget>[];
    for (var i = 0; i < widget.children.length; i++) {
      final start = widget.delay.inMilliseconds +
          (widget.stagger.inMilliseconds * i);
      final end = start + widget.duration.inMilliseconds;
      final total = _controller.duration!.inMilliseconds;

      final Animation<double> animation;
      if (reducedMotion) {
        animation = AlwaysStoppedAnimation<double>(1);
      } else {
        final begin = total == 0 ? 0.0 : start / total;
        final finish = total == 0 ? 1.0 : (end / total).clamp(0.0, 1.0);
        animation = CurvedAnimation(
          parent: _controller,
          curve: Interval(begin, finish, curve: Curves.easeOutCubic),
        );
      }

      children.add(
        _StaggeredItem(
          animation: animation,
          child: widget.children[i],
        ),
      );

      if (widget.spacing > 0 && i < widget.children.length - 1) {
        children.add(SizedBox(height: widget.spacing));
      }
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: children,
    );
  }
}

/// A widget that wraps [child] and applies a press-down scale animation when
/// the user taps. The default scale factor is 0.97, configurable via [scale].
class PressScale extends StatefulWidget {
  const PressScale({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.scale = 0.97,
    this.enabled = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double scale;
  final bool enabled;

  @override
  State<PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends State<PressScale>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: AppMotion.fast,
    reverseDuration: AppMotion.fast,
  );

  late final Animation<double> _scaleAnim =
      Tween<double>(begin: 1.0, end: widget.scale).animate(
    CurvedAnimation(
      parent: _ctrl,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    ),
  );

  void _handleTapDown(TapDownDetails _) {
    if (!widget.enabled) return;
    HapticFeedback.selectionClick();
    _ctrl.forward();
  }

  void _handleTapUp(TapUpDetails _) {
    if (!widget.enabled) return;
    _ctrl.reverse();
  }

  void _handleTapCancel() {
    if (!widget.enabled) return;
    _ctrl.reverse();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reducedMotion =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final canInteract = widget.enabled &&
        (widget.onTap != null || widget.onLongPress != null);

    if (reducedMotion || !canInteract) {
      return widget.child;
    }

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: _handleTapDown,
      onTapUp: _handleTapUp,
      onTapCancel: _handleTapCancel,
      onTap: widget.onTap,
      onLongPress: widget.onLongPress,
      child: AnimatedBuilder(
        animation: _scaleAnim,
        builder: (context, child) {
          return Transform.scale(
            scale: _scaleAnim.value,
            child: child,
          );
        },
        child: widget.child,
      ),
    );
  }
}

/// A small helper that adds tactile [HapticFeedback] to tap interactions.
class PressFeedback {
  PressFeedback._();

  /// Wraps [onTap] so that a `lightImpact` haptic fires immediately before the
  /// callback is invoked. Returns a no-op when [onTap] is null.
  static VoidCallback wrap(VoidCallback? onTap) {
    if (onTap == null) return () {};
    return () {
      HapticFeedback.lightImpact();
      onTap();
    };
  }

  /// Fires a `selectionClick` haptic. Use for picking / toggling controls.
  static void selection() => HapticFeedback.selectionClick();

  /// Fires a `lightImpact` haptic. Use for generic taps.
  static void light() => HapticFeedback.lightImpact();

  /// Fires a `mediumImpact` haptic. Use for primary actions.
  static void medium() => HapticFeedback.mediumImpact();
}
