import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../auth/auth.dart';
import '../theme/app_theme.dart';

/// Role-aware "chrome" helpers.
///
/// The Cashier and Production shells render a dark charcoal app bar +
/// bottom nav (the web admin's sidebar identity). Full-screen pages that
/// are shared across roles (Profile, Notifications, Order Detail) call
/// these helpers so their app bar matches the shell they were opened
/// from. The Admin/Owner shell keeps the light chrome.
///
/// UI only - nothing here reads or changes app state beyond the
/// signed-in role already exposed by [AuthService].
bool usesDarkChrome(BuildContext context) {
  final auth = AuthProvider.of(context);
  return auth.isCashier || auth.isProduction;
}

/// App-bar background for the current role (chrome or light surface).
Color chromeBarBackground(BuildContext context) =>
    usesDarkChrome(context) ? AppTheme.chrome : AppTheme.surface;

/// App-bar foreground (icons + title) for the current role.
Color chromeBarForeground(BuildContext context) =>
    usesDarkChrome(context) ? AppTheme.onChrome : AppTheme.onSurface;

/// Status-bar (clock/battery) style matching the app bar above it.
SystemUiOverlayStyle chromeBarOverlay(BuildContext context) =>
    usesDarkChrome(context)
        ? SystemUiOverlayStyle.light
        : SystemUiOverlayStyle.dark;
