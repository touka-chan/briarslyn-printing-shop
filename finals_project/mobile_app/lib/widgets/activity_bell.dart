import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/live_activity_service.dart';
import '../screens/notifications/notifications_screen.dart';
import '../theme/app_theme.dart';

/// App bar bell with an unread badge: lights up whenever real changes
/// happen anywhere (same feed as the live-activity SnackBars). Opening the
/// Notifications screen clears the count.
class ActivityBellButton extends StatelessWidget {
  const ActivityBellButton({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: LiveActivityService.unreadCount,
      builder: (context, count, _) {
        final bell = IconButton(
          icon: const Icon(Icons.notifications_outlined),
          visualDensity: VisualDensity.compact,
          onPressed: () {
            HapticFeedback.selectionClick();
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const NotificationsScreen()),
            );
          },
          tooltip: 'Notifications',
        );
        if (count <= 0) return bell;
        return Stack(
          clipBehavior: Clip.none,
          children: [
            bell,
            Positioned(
              right: 3,
              top: 3,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                constraints: const BoxConstraints(minWidth: 16),
                decoration: BoxDecoration(
                  color: AppTheme.statusUrgent,
                  borderRadius: BorderRadius.circular(9),
                  border: Border.all(color: AppTheme.chrome, width: 1.5),
                ),
                child: Text(
                  count > 9 ? '9+' : '$count',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.onPrimary,
                    height: 1.25,
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
