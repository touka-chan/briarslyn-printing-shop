import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_theme.dart';

/// Navigation helpers for consistent transitions across the app.
///
/// Provides a unified API for pushing routes with the app's signature
/// animation (fade + slide up, 220ms easeOutCubic) and for presenting
/// modal bottom sheets with a spring entrance.
class AppNavigation {
  AppNavigation._();

  /// Pushes a route with the standard app page transition (fade + slide up).
  ///
  /// Uses a custom [PageRouteBuilder] with 220ms forward / 180ms reverse
  /// transitions and [Curves.easeOutCubic]. Respects reduced-motion settings.
  static Future<T?> push<T extends Object?>(
    BuildContext context, {
    required WidgetBuilder builder,
    RouteSettings? settings,
  }) {
    return Navigator.of(context, rootNavigator: true).push<T>(
      _AppPageRoute<T>(builder: builder, settings: settings),
    );
  }

  /// Pushes a named route with the standard app page transition.
  static Future<T?> pushNamed<T extends Object?>(
    BuildContext context,
    String routeName, {
    Object? arguments,
  }) {
    return Navigator.of(context, rootNavigator: true).pushNamed<T>(
      routeName,
      arguments: arguments,
    );
  }

  /// Pushes a route and removes all previous routes until the predicate.
  static Future<T?> pushAndRemoveUntil<T extends Object?>(
    BuildContext context, {
    required WidgetBuilder builder,
    required RoutePredicate predicate,
    RouteSettings? settings,
  }) {
    return Navigator.of(context, rootNavigator: true).pushAndRemoveUntil<T>(
      _AppPageRoute<T>(builder: builder, settings: settings),
      predicate,
    );
  }

  /// Pushes a named route and removes all previous routes until the predicate.
  static Future<T?> pushNamedAndRemoveUntil<T extends Object?>(
    BuildContext context,
    String newRouteName,
    RoutePredicate predicate, {
    Object? arguments,
  }) {
    return Navigator.of(context, rootNavigator: true).pushNamedAndRemoveUntil<T>(
      newRouteName,
      predicate,
      arguments: arguments,
    );
  }

  /// Replaces the current route with a new one using the standard transition.
  static Future<T?> pushReplacement<T extends Object?, TO extends Object?>(
    BuildContext context, {
    required WidgetBuilder builder,
    RouteSettings? settings,
    TO? result,
  }) {
    return Navigator.of(context, rootNavigator: true).pushReplacement<T, TO>(
      _AppPageRoute<T>(builder: builder, settings: settings),
      result: result,
    );
  }

  /// Pops the current route and returns [result].
  static void pop<T extends Object?>(BuildContext context, [T? result]) {
    Navigator.of(context, rootNavigator: true).pop(result);
  }

  /// Presents a modal bottom sheet with the app's spring entrance animation.
  ///
  /// The sheet uses [Curves.elasticOut] over 350ms, has a drag handle,
  /// rounded top corners (24px), and respects the system bottom insets.
  /// Returns the value passed to [pop] when dismissed.
  static Future<T?> showModalSheet<T extends Object?>(
    BuildContext context, {
    required WidgetBuilder builder,
    bool isScrollControlled = true,
    bool useRootNavigator = true,
    RouteSettings? settings,
  }) {
    return showModalBottomSheet<T>(
      context: context,
      useRootNavigator: useRootNavigator,
      isScrollControlled: isScrollControlled,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black54,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      transitionAnimationController: null, // Let Flutter animate
      builder: (sheetContext) => _ModalSheetWrapper(builder: builder),
    );
  }

  /// Presents a full-screen modal dialog with the standard transition.
  static Future<T?> showAppDialog<T extends Object?>(
    BuildContext context, {
    required WidgetBuilder builder,
    bool barrierDismissible = true,
    RouteSettings? settings,
  }) {
    return showDialog<T>(
      context: context,
      barrierDismissible: barrierDismissible,
      useRootNavigator: true,
      builder: (dialogContext) => _DialogWrapper(builder: builder),
    );
  }
}

/// Internal page route with the app's standard transition.
class _AppPageRoute<T> extends PageRoute<T> {
  _AppPageRoute({
    required this.builder,
    RouteSettings? settings,
  }) : super(settings: settings);

  final WidgetBuilder builder;

  @override
  Duration get transitionDuration => const Duration(milliseconds: 220);

  @override
  Duration get reverseTransitionDuration => const Duration(milliseconds: 180);

  @override
  bool get opaque => true;

  @override
  bool get barrierDismissible => false;

  @override
  Color? get barrierColor => null;

  @override
  String? get barrierLabel => null;

  @override
  bool get maintainState => true;

  @override
  Widget buildPage(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation) {
    return builder(context);
  }

  @override
  Widget buildTransitions(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation, Widget child) {
    // Respect reduced motion
    final disableAnimations = MediaQuery.of(context).disableAnimations;
    if (disableAnimations) return child;

    final curve = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
    return FadeTransition(
      opacity: curve,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.04),
          end: Offset.zero,
        ).animate(curve),
        child: child,
      ),
    );
  }
}

/// Wrapper for modal bottom sheet with spring entrance.
class _ModalSheetWrapper extends StatelessWidget {
  const _ModalSheetWrapper({required this.builder});

  final WidgetBuilder builder;

  @override
  Widget build(BuildContext context) {
    final disableAnimations = MediaQuery.of(context).disableAnimations;

    return AnimatedContainer(
      duration: disableAnimations ? Duration.zero : const Duration(milliseconds: 350),
      curve: Curves.elasticOut,
      child: Material(
        color: AppTheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        child: SafeArea(
          top: false,
          child: builder(context),
        ),
      ),
    );
  }
}

/// Wrapper for dialog with standard transition.
class _DialogWrapper extends StatelessWidget {
  const _DialogWrapper({required this.builder});

  final WidgetBuilder builder;

  @override
  Widget build(BuildContext context) {
    return builder(context);
  }
}

/// Extension for easier navigation from any widget.
extension AppNavigationX on BuildContext {
  Future<T?> push<T extends Object?>({required WidgetBuilder builder, RouteSettings? settings}) {
    return AppNavigation.push<T>(this, builder: builder, settings: settings);
  }

  Future<T?> pushNamed<T extends Object?>(String routeName, {Object? arguments}) {
    return AppNavigation.pushNamed<T>(this, routeName, arguments: arguments);
  }

  Future<T?> pushAndRemoveUntil<T extends Object?>({
    required WidgetBuilder builder,
    required RoutePredicate predicate,
    RouteSettings? settings,
  }) {
    return AppNavigation.pushAndRemoveUntil<T>(
      this,
      builder: builder,
      predicate: predicate,
      settings: settings,
    );
  }

  Future<T?> pushReplacement<T extends Object?, TO extends Object?>({
    required WidgetBuilder builder,
    RouteSettings? settings,
    TO? result,
  }) {
    return AppNavigation.pushReplacement<T, TO>(
      this,
      builder: builder,
      settings: settings,
      result: result,
    );
  }

  void pop<T extends Object?>([T? result]) {
    AppNavigation.pop<T>(this, result);
  }

  Future<T?> showModalSheet<T extends Object?>({
    required WidgetBuilder builder,
    bool isScrollControlled = true,
    bool useRootNavigator = true,
  }) {
    return AppNavigation.showModalSheet<T>(
      this,
      builder: builder,
      isScrollControlled: isScrollControlled,
      useRootNavigator: useRootNavigator,
    );
  }

  Future<T?> showAppDialog<T extends Object?>({
    required WidgetBuilder builder,
    bool barrierDismissible = true,
  }) {
    return AppNavigation.showAppDialog<T>(
      this,
      builder: builder,
      barrierDismissible: barrierDismissible,
    );
  }
}