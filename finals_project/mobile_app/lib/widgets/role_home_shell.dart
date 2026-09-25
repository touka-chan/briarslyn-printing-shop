import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
    this.darkChrome = false,
    this.prefsKey,
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

  /// When true, the shell renders the dark charcoal chrome (app bar +
  /// bottom nav) that mirrors the web admin's sidebar: white brand
  /// title, white idle icons, and a white active pill. Enabled by the
  /// Cashier and Production shells; the Admin shell keeps the light
  /// chrome. UI only - navigation and screens are untouched.
  final bool darkChrome;

  /// Optional SharedPreferences key remembering the last opened tab for
  /// this role (e.g. `last_tab_production`). Survives app restarts.
  final String? prefsKey;

  @override
  State<RoleHomeShell> createState() => _RoleHomeShellState();
}

class _RoleHomeShellState extends State<RoleHomeShell> {
  late int _index = widget.initialIndex.clamp(0, widget.navItems.length - 1);

  @override
  void initState() {
    super.initState();
    _restoreLastTab();
  }

  Future<void> _restoreLastTab() async {
    final key = widget.prefsKey;
    if (key == null) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getInt(key);
      if (saved == null || !mounted) return;
      final clamped = saved.clamp(0, widget.navItems.length - 1);
      if (clamped != _index) setState(() => _index = clamped);
    } catch (_) {
      // Prefs unavailable - keep the default tab.
    }
  }

  void _onTabSelected(int i) {
    if (i == _index) return;
    HapticFeedback.selectionClick();
    setState(() => _index = i);
    final key = widget.prefsKey;
    if (key != null) {
      () async {
        try {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setInt(key, i);
        } catch (_) {}
      }();
    }
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
      bottomNavigationBar: _buildNavigationBar(context),
    );
  }

  /// The bottom navigation bar. The chrome roles wrap it in a dark theme
  /// (white active pill, white idle icons - the web sidebar's
  /// active/inactive treatment); the light path is unchanged.
  Widget _buildNavigationBar(BuildContext context) {
    final dark = widget.darkChrome;
    final bar = NavigationBar(
      selectedIndex: _index,
      onDestinationSelected: _onTabSelected,
      backgroundColor: dark ? AppTheme.chrome : AppTheme.surface,
      indicatorColor: dark ? AppTheme.onChrome : AppTheme.primaryContainer,
      height: 68,
      destinations: [
        for (final n in widget.navItems)
          NavigationDestination(
            icon: Icon(n.icon, size: AppIconSize.md),
            selectedIcon: Icon(n.iconActive, size: AppIconSize.md),
            label: n.label,
          ),
      ],
    );
    if (!dark) return bar;
    return NavigationBarTheme(
      data: NavigationBarThemeData(
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            size: AppIconSize.md,
            color: states.contains(WidgetState.selected)
                ? AppTheme.chrome
                : AppTheme.onChromeMuted,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => GoogleFonts.inter(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: states.contains(WidgetState.selected)
                ? AppTheme.onChrome
                : AppTheme.onChromeMuted,
          ),
        ),
      ),
      child: bar,
    );
  }

  Widget _buildRail(BuildContext context) {
    final dark = widget.darkChrome;
    final rail = NavigationRail(
      selectedIndex: _index,
      onDestinationSelected: _onTabSelected,
      labelType: NavigationRailLabelType.all,
      backgroundColor: dark ? AppTheme.chrome : AppTheme.surface,
      indicatorColor: dark ? AppTheme.onChrome : AppTheme.primaryContainer,
      leading: const SizedBox(height: AppSpacing.sm),
      destinations: [
        for (final n in widget.navItems)
          NavigationRailDestination(
            icon: Icon(n.icon, size: AppIconSize.md),
            selectedIcon: Icon(n.iconActive, size: AppIconSize.md),
            label: Text(n.label),
          ),
      ],
    );
    return Scaffold(
      appBar: _buildAppBar(context),
      body: SafeArea(
        child: Row(
          children: [
            if (!dark)
              rail
            else
              NavigationRailTheme(
                data: NavigationRailThemeData(
                  selectedIconTheme:
                      const IconThemeData(color: AppTheme.chrome),
                  unselectedIconTheme:
                      const IconThemeData(color: AppTheme.onChromeMuted),
                  selectedLabelTextStyle: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: AppTheme.onChrome,
                  ),
                  unselectedLabelTextStyle: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: AppTheme.onChromeMuted,
                  ),
                ),
                child: rail,
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
    final dark = widget.darkChrome;
    final titleStyle = dark
        ? GoogleFonts.poppins(
            fontSize: 19,
            fontWeight: FontWeight.w600,
            color: AppTheme.onChrome,
            height: 1.15,
          )
        : Theme.of(context).textTheme.titleLarge;
    final subtitleStyle = dark
        ? GoogleFonts.inter(
            fontSize: 12,
            fontWeight: FontWeight.w400,
            color: AppTheme.onChromeMuted,
          )
        : Theme.of(context).textTheme.bodySmall;

    return AppBar(
      backgroundColor: dark ? AppTheme.chrome : AppTheme.surface,
      foregroundColor: dark ? AppTheme.onChrome : AppTheme.onSurface,
      elevation: 0,
      // Flat charcoal bar (no scroll shadow) with a hairline divider,
      // like the web sidebar's edge.
      scrolledUnderElevation: dark ? 0 : 1,
      shape: dark
          ? const Border(bottom: BorderSide(color: AppTheme.chromeHairline))
          : null,
      systemOverlayStyle:
          dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      centerTitle: false,
      titleSpacing: dark ? AppSpacing.sm : AppSpacing.lg,
      // Brand badge on the left, mirroring the web sidebar logo.
      leadingWidth: dark ? 60 : null,
      leading: dark
          ? Padding(
              padding: const EdgeInsets.only(left: AppSpacing.lg),
              child: Center(
                child: ClipOval(
                  child: Image.asset(
                    'assets/images/logo.jpg',
                    width: 30,
                    height: 30,
                    fit: BoxFit.cover,
                  ),
                ),
              ),
            )
          : null,
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            widget.appBarTitle,
            style: titleStyle,
          ),
          if (widget.appBarSubtitle != null) ...[
            const SizedBox(height: 2),
            Text(
              widget.appBarSubtitle!,
              style: subtitleStyle,
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
