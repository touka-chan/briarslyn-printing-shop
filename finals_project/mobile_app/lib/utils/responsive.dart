import 'package:flutter/material.dart';

/// Responsive design helper for PrintFlow Mobile.
///
/// Provides breakpoint-based utilities and widgets for adaptive layouts.
///
/// Breakpoints:
/// - Compact: width < 600
/// - Medium: 600 <= width < 840
/// - Expanded: width >= 840
class Responsive {
  /// Returns true if the screen width is less than 600 (compact).
  static bool isCompact(BuildContext context) {
    return MediaQuery.of(context).size.width < 600;
  }

  /// Returns true if the screen width is 600 or larger (medium or expanded).
  static bool isMediumOrLarger(BuildContext context) {
    return MediaQuery.of(context).size.width >= 600;
  }

  /// Returns true if the screen width is 840 or larger (expanded).
  static bool isExpanded(BuildContext context) {
    return MediaQuery.of(context).size.width >= 840;
  }

  /// Returns adaptive screen padding based on screen width.
  ///
  /// - 12 if width < 360
  /// - 16 if width < 600
  /// - 24 if width < 840
  /// - 32 otherwise
  static double screenPadding(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    if (width < 360) return 12;
    if (width < 600) return 16;
    if (width < 840) return 24;
    return 32;
  }

  /// Returns a value based on the current breakpoint.
  ///
  /// - Returns [expanded] if width >= 840 and [expanded] is provided
  /// - Returns [medium] if 600 <= width < 840 and [medium] is provided
  /// - Falls back to [compact] otherwise
  ///
  /// Example:
  /// ```dart
  /// final fontSize = Responsive.value<double>(
  ///   context,
  ///   compact: 14,
  ///   medium: 16,
  ///   expanded: 18,
  /// );
  /// ```
  static T value<T>(
    BuildContext context, {
    required T compact,
    T? medium,
    T? expanded,
  }) {
    final width = MediaQuery.of(context).size.width;

    if (width >= 840 && expanded != null) {
      return expanded;
    }

    if (width >= 600 && medium != null) {
      return medium;
    }

    return compact;
  }
}

/// A widget that rebuilds when the screen size changes.
///
/// Provides breakpoint information to the builder function.
///
/// Example:
/// ```dart
/// ResponsiveBuilder(
///   builder: (context, isCompact, isMediumOrLarger) {
///     return isCompact
///       ? CompactLayout()
///       : ExpandedLayout();
///   },
/// )
/// ```
class ResponsiveBuilder extends StatelessWidget {
  final Widget Function(
    BuildContext context,
    bool isCompact,
    bool isMediumOrLarger,
  ) builder;

  const ResponsiveBuilder({
    super.key,
    required this.builder,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        return builder(
          context,
          width < 600,
          width >= 600,
        );
      },
    );
  }
}

/// Shows the child widget only when the screen is compact (width < 600).
///
/// Example:
/// ```dart
/// ShowOnCompact(
///   child: MobileNavigation(),
/// )
/// ```
class ShowOnCompact extends StatelessWidget {
  final Widget child;

  const ShowOnCompact({
    super.key,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 600) {
          return child;
        }
        return const SizedBox.shrink();
      },
    );
  }
}

/// Shows the child widget only when the screen is medium or larger (width >= 600).
///
/// Example:
/// ```dart
/// ShowOnMediumOrLarger(
///   child: DesktopNavigation(),
/// )
/// ```
class ShowOnMediumOrLarger extends StatelessWidget {
  final Widget child;

  const ShowOnMediumOrLarger({
    super.key,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth >= 600) {
          return child;
        }
        return const SizedBox.shrink();
      },
    );
  }
}
