import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../theme/app_theme.dart';

/// A custom app bar used across all screens for consistent styling.
///
/// Features:
/// - Leading icon (back or menu)
/// - Left-aligned title with weight 600
/// - Optional subtitle in onSurfaceVariant at 12sp
/// - Trailing actions slot
/// - Optional bottom slot for search fields / sensor status bar
class PfAppBar extends StatelessWidget implements PreferredSizeWidget {
  const PfAppBar({
    super.key,
    this.leading,
    this.automaticallyImplyLeading = true,
    required this.title,
    this.subtitle,
    this.actions,
    this.bottom,
    this.backgroundColor = AppTheme.surface,
    this.foregroundColor = AppTheme.onSurface,
    this.elevation = 0,
    this.centerTitle = false,
    this.titleSpacing = AppSpacing.md,
    this.toolbarHeight = kToolbarHeight,
  });

  final Widget? leading;
  final bool automaticallyImplyLeading;
  final String title;
  final String? subtitle;
  final List<Widget>? actions;
  final PreferredSizeWidget? bottom;
  final Color backgroundColor;
  final Color foregroundColor;
  final double elevation;
  final bool centerTitle;
  final double titleSpacing;
  final double toolbarHeight;

  @override
  Size get preferredSize => Size.fromHeight(
    toolbarHeight + (bottom?.preferredSize.height ?? 0),
  );

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final effectiveLeading = leading ??
        (automaticallyImplyLeading && Navigator.canPop(context)
            ? IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: () => Navigator.pop(context),
                tooltip: 'Back',
              )
            : null);

    return AppBar(
      backgroundColor: backgroundColor,
      foregroundColor: foregroundColor,
      elevation: elevation,
      surfaceTintColor: Colors.transparent,
      centerTitle: centerTitle,
      titleSpacing: titleSpacing,
      toolbarHeight: toolbarHeight,
      leading: effectiveLeading,
      leadingWidth: effectiveLeading != null ? 56 : 0,
      title: subtitle != null
          ? Column(
              crossAxisAlignment: centerTitle ? CrossAxisAlignment.center : CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: foregroundColor,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle!,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: foregroundColor.withValues(alpha: 0.6),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            )
          : Text(
              title,
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
                color: foregroundColor,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
      actions: actions,
      bottom: bottom,
    );
  }
}

/// A simple sensor status bar widget for the production app bar bottom slot.
class PfSensorStatusBar extends StatelessWidget {
  const PfSensorStatusBar({
    super.key,
    required this.sensorId,
    required this.isOnline,
    this.lastSync,
  });

  final String sensorId;
  final bool isOnline;
  final Duration? lastSync;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 40,
      color: AppTheme.surfaceContainer,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      child: Row(
        children: [
          // Pulse indicator
          _PulseDot(isOnline: isOnline),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              '$sensorId • RFID station ${isOnline ? "online" : "offline"}',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: isOnline ? AppTheme.sensorActive : AppTheme.sensorStale,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),
          if (lastSync != null)
            Text(
              'Last sync: ${_formatDuration(lastSync!)} ago',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppTheme.onSurfaceVariant,
                  ),
            ),
        ],
      ),
    );
  }

  String _formatDuration(Duration d) {
    if (d.inSeconds < 60) return '${d.inSeconds}s';
    if (d.inMinutes < 60) return '${d.inMinutes}m';
    return '${d.inHours}h';
  }
}

class _PulseDot extends StatefulWidget {
  const _PulseDot({required this.isOnline});
  final bool isOnline;

  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1400),
      vsync: this,
    )..repeat(reverse: true);
    _animation = Tween<double>(begin: 0.4, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void didUpdateWidget(covariant _PulseDot oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isOnline != oldWidget.isOnline) {
      if (widget.isOnline) {
        _controller.repeat(reverse: true);
      } else {
        _controller.stop();
        _controller.value = 0;
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.isOnline) {
      return Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(
          color: AppTheme.sensorStale,
          shape: BoxShape.circle,
        ),
      );
    }

    return AnimatedBuilder(
      animation: _animation,
      builder: (_, child) => Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(
          color: AppTheme.sensorActive.withValues(alpha: _animation.value),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: AppTheme.sensorActive.withValues(alpha: _animation.value * 0.5),
              blurRadius: 8 * _animation.value,
              spreadRadius: 2 * _animation.value,
            ),
          ],
        ),
      ),
    );
  }
}