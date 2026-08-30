import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/tokens.dart';
import '../theme/app_theme.dart';
import '../utils/responsive.dart';

/// A navigation item for [RoleHomeShell].
class NavItem {
  const NavItem({
    required this.label,
    required this.icon,
    required this.iconActive,
    required this.screen,
  });

  final String label;
  final IconData icon;
  final IconData iconActive;
  final Widget screen;
}

/// A shell widget that provides a bottom navigation (or side rail on wider
/// screens) for a given role. The selected index is preserved across rebuilds
/// via [IndexedStack] so each tab's state is retained.
class RoleHomeShell extends StatefulWidget {
  const RoleHomeShell({
    super.key,
    required this.appBarTitle,
    required this.appBarSubtitle,
    required this.navItems,
    this.appBarTrailing,
    this.appBarTrailingActions = const [],
    this.appBarBottom,
    this.initialIndex = 0,
  });

  /// Title shown in the app bar (e.g. "POS" or "Production Queue").
  final String appBarTitle;

  /// Optional small caption under the title (e.g. "Brialyns Art Sign").
  final String? appBarSubtitle;

  /// Bottom nav destinations. The first item is the default landing screen.
  final List<NavItem> navItems;

  /// Optional widget rendered as the trailing icon(s) in the app bar.
  final Widget? appBarTrailing;

  /// Optional list of additional trailing action widgets (rendered after
  /// [appBarTrailing], left to right). Useful for stacking e.g. a
  /// notifications bell next to a logout button.
  final List<Widget> appBarTrailingActions;

  /// Optional widget rendered in the app bar's `bottom` slot (e.g. a sensor
  /// status strip).
  final PreferredSizeWidget? appBarBottom;

  /// Initial tab index.
  final int initialIndex;

  @override
  State<RoleHomeShell> createState() => _RoleHomeShellState();
}

class _RoleHomeShellState extends State<RoleHomeShell> {
  late int _index = widget.initialIndex.clamp(0, widget.navItems.length - 1);

  void _onTabSelected(int i) {
    if (i == _index) return;
    HapticFeedback.selectionClick();
    setState(() => _index = i);
  }

  @override
  Widget build(BuildContext context) {
    return ResponsiveBuilder(
      builder: (context, isCompact, isMediumOrLarger) {
        if (isCompact) {
          return _buildBottomNav(context);
        }
        return _buildRail(context);
      },
    );
  }

  Widget _buildBottomNav(BuildContext context) {
    return Scaffold(
      appBar: _buildAppBar(context),
      body: SafeArea(
        bottom: false,
        child: IndexedStack(
          index: _index,
          children: widget.navItems.map((n) => n.screen).toList(),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _onTabSelected,
        backgroundColor: AppTheme.surface,
        indicatorColor: AppTheme.primaryContainer,
        height: 68,
        destinations: [
          for (final n in widget.navItems)
            NavigationDestination(
              icon: Icon(n.icon, size: AppIconSize.md),
              selectedIcon: Icon(n.iconActive, size: AppIconSize.md),
              label: n.label,
            ),
        ],
      ),
    );
  }

  Widget _buildRail(BuildContext context) {
    return Scaffold(
      appBar: _buildAppBar(context),
      body: SafeArea(
        child: Row(
          children: [
            NavigationRail(
              selectedIndex: _index,
              onDestinationSelected: _onTabSelected,
              labelType: NavigationRailLabelType.all,
              backgroundColor: AppTheme.surface,
              indicatorColor: AppTheme.primaryContainer,
              leading: const SizedBox(height: AppSpacing.sm),
              destinations: [
                for (final n in widget.navItems)
                  NavigationRailDestination(
                    icon: Icon(n.icon, size: AppIconSize.md),
                    selectedIcon: Icon(n.iconActive, size: AppIconSize.md),
                    label: Text(n.label),
                  ),
              ],
            ),
            const VerticalDivider(width: 1, thickness: 1),
            Expanded(
              child: IndexedStack(
                index: _index,
                children: widget.navItems.map((n) => n.screen).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context) {
    return AppBar(
      backgroundColor: AppTheme.surface,
      foregroundColor: AppTheme.onSurface,
      elevation: 0,
      scrolledUnderElevation: 1,
      centerTitle: false,
      titleSpacing: AppSpacing.lg,
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            widget.appBarTitle,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          if (widget.appBarSubtitle != null) ...[
            const SizedBox(height: 2),
            Text(
              widget.appBarSubtitle!,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
      actions: [
        if (widget.appBarTrailing != null)
          Padding(
            padding: const EdgeInsets.only(right: AppSpacing.sm),
            child: widget.appBarTrailing!,
          ),
        ...widget.appBarTrailingActions.map(
          (w) => Padding(
            padding: const EdgeInsets.only(right: AppSpacing.sm),
            child: w,
          ),
        ),
      ],
      bottom: widget.appBarBottom,
    );
  }
}
