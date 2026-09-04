import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../theme/app_theme.dart';

/// Navigation item for the bottom nav/rail.
class NavItem {
  const NavItem({
    required this.label,
    required this.icon,
    required this.activeIcon,
    this.route,
  });

  final String label;
  final IconData icon;
  final IconData activeIcon;
  final String? route;
}

/// A responsive bottom navigation bar that collapses to a [NavigationRail]
/// on medium+ screens (600dp+ width).
class PfBottomNav extends StatelessWidget {
  const PfBottomNav({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onTap,
    this.backgroundColor,
    this.selectedItemColor,
    this.unselectedItemColor,
    this.indicatorColor,
    this.height = 72,
    this.railWidth = 88,
    this.showLabels = true,
  });

  final List<NavItem> items;
  final int currentIndex;
  final ValueChanged<int> onTap;
  final Color? backgroundColor;
  final Color? selectedItemColor;
  final Color? unselectedItemColor;
  final Color? indicatorColor;
  final double height;
  final double railWidth;
  final bool showLabels;

  @override
  Widget build(BuildContext context) {
    final isMediumOrLarger = MediaQuery.of(context).size.width >= 600;

    if (isMediumOrLarger) {
      return _buildRail(context);
    }
    return _buildBottomNav(context);
  }

  Widget _buildBottomNav(BuildContext context) {
    final bgColor = backgroundColor ?? AppTheme.surface;
    final selectedColor = selectedItemColor ?? AppTheme.primary;
    final unselectedColor = unselectedItemColor ?? AppTheme.onSurfaceVariant;
    final indicator = indicatorColor ?? AppTheme.primary.withValues(alpha: 0.15);

    return Container(
      height: height,
      decoration: BoxDecoration(
        color: bgColor,
        border: Border(
          top: BorderSide(
            color: Theme.of(context).colorScheme.outlineVariant,
            width: 1,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: items.asMap().entries.map((entry) {
            final index = entry.key;
            final item = entry.value;
            final isSelected = index == currentIndex;

            return Expanded(
              child: _NavItemButton(
                item: item,
                isSelected: isSelected,
                onTap: () => onTap(index),
                selectedColor: selectedColor,
                unselectedColor: unselectedColor,
                indicatorColor: indicator,
                showLabel: showLabels,
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildRail(BuildContext context) {
    final theme = Theme.of(context);
    final bgColor = backgroundColor ?? AppTheme.surface;
    final selectedColor = selectedItemColor ?? AppTheme.primary;
    final unselectedColor = unselectedItemColor ?? AppTheme.onSurfaceVariant;

    return NavigationRail(
      extended: true,
      minWidth: railWidth,
      minExtendedWidth: railWidth + 64,
      backgroundColor: bgColor,
      selectedIndex: currentIndex,
      onDestinationSelected: onTap,
      selectedLabelTextStyle: theme.textTheme.labelSmall?.copyWith(
        color: selectedColor,
        fontWeight: FontWeight.w600,
      ),
      unselectedLabelTextStyle: theme.textTheme.labelSmall?.copyWith(
        color: unselectedColor,
        fontWeight: FontWeight.w500,
      ),
      indicatorColor: indicatorColor ?? AppTheme.primary.withValues(alpha: 0.15),
      indicatorShape: RoundedRectangleBorder(
        borderRadius: AppRadius.rMd,
      ),
      leading: const SizedBox(height: AppSpacing.lg),
      trailing: Expanded(
        child: Align(
          alignment: Alignment.bottomCenter,
          child: Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.lg),
            child: Text(
              'PrintFlow',
              style: theme.textTheme.labelSmall?.copyWith(
                color: AppTheme.onSurfaceVariant,
              ),
            ),
          ),
        ),
      ),
      destinations: items.map((item) {
        return NavigationRailDestination(
          icon: Icon(item.icon, size: AppIconSize.md),
          selectedIcon: Icon(item.activeIcon, size: AppIconSize.md),
          label: Text(item.label),
        );
      }).toList(),
    );
  }
}

class _NavItemButton extends StatelessWidget {
  const _NavItemButton({
    required this.item,
    required this.isSelected,
    required this.onTap,
    required this.selectedColor,
    required this.unselectedColor,
    required this.indicatorColor,
    required this.showLabel,
  });

  final NavItem item;
  final bool isSelected;
  final VoidCallback onTap;
  final Color selectedColor;
  final Color unselectedColor;
  final Color indicatorColor;
  final bool showLabel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.rMd,
        child: AnimatedContainer(
          duration: AppMotion.fast,
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.symmetric(
            vertical: AppSpacing.sm,
            horizontal: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: isSelected ? indicatorColor : Colors.transparent,
            borderRadius: AppRadius.rMd,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                isSelected ? item.activeIcon : item.icon,
                size: AppIconSize.md,
                color: isSelected ? selectedColor : unselectedColor,
              ),
              if (showLabel) ...[
                const SizedBox(height: 2),
                Text(
                  item.label,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: isSelected ? selectedColor : unselectedColor,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                    fontSize: AppTypography.caption,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Shell widget that holds the navigation bar/rail and renders the active screen
/// via an [IndexedStack] to preserve tab state when switching.
class PfRoleShell extends StatefulWidget {
  const PfRoleShell({
    super.key,
    required this.items,
    required this.screens,
    this.initialIndex = 0,
    this.appBarBuilder,
    this.backgroundColor,
  });

  final List<NavItem> items;
  final List<Widget> screens;
  final int initialIndex;
  final PreferredSizeWidget Function(BuildContext, int)? appBarBuilder;
  final Color? backgroundColor;

  @override
  State<PfRoleShell> createState() => _PfRoleShellState();
}

class _PfRoleShellState extends State<PfRoleShell> with TickerProviderStateMixin {
  late int _currentIndex;
  late PageController _pageController;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _onTap(int index) {
    if (index == _currentIndex) return;
    setState(() => _currentIndex = index);
    _pageController.animateToPage(
      index,
      duration: AppMotion.base,
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final isMediumOrLarger = MediaQuery.of(context).size.width >= 600;

    return Scaffold(
      backgroundColor: widget.backgroundColor ?? AppTheme.background,
      body: isMediumOrLarger
          ? _buildRailLayout(context)
          : _buildBottomNavLayout(context),
    );
  }

  Widget _buildBottomNavLayout(BuildContext context) {
    return Column(
      children: [
        if (widget.appBarBuilder != null)
          widget.appBarBuilder!(context, _currentIndex),
        Expanded(
          child: PageView(
            controller: _pageController,
            onPageChanged: (i) => setState(() => _currentIndex = i),
            physics: const NeverScrollableScrollPhysics(),
            children: widget.screens,
          ),
        ),
        PfBottomNav(
          items: widget.items,
          currentIndex: _currentIndex,
          onTap: _onTap,
        ),
      ],
    );
  }

  Widget _buildRailLayout(BuildContext context) {
    return Row(
      children: [
        PfBottomNav(
          items: widget.items,
          currentIndex: _currentIndex,
          onTap: _onTap,
        ),
        const VerticalDivider(
          width: 1,
          thickness: 1,
        ),
        Expanded(
          child: Column(
            children: [
              if (widget.appBarBuilder != null)
                widget.appBarBuilder!(context, _currentIndex),
              Expanded(
                child: PageView(
                  controller: _pageController,
                  onPageChanged: (i) => setState(() => _currentIndex = i),
                  physics: const NeverScrollableScrollPhysics(),
                  children: widget.screens,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}