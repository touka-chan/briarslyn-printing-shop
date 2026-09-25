import 'package:flutter/material.dart';

import 'screens/auth/login_screen.dart';
import 'screens/auth/no_profile_screen.dart';
import 'screens/admin/admin_shell.dart';
import 'screens/cashier/cashier_shell.dart';
import 'screens/cashier/cashier_new_order.dart';
import 'screens/cashier/cashier_orders.dart';
import 'screens/cashier/cashier_customers.dart';
import 'screens/cashier/order_detail.dart';
import 'screens/production/production_shell.dart';
import 'theme/theme_controller.dart';

/// A simple centralized list of named routes for the app.
///
/// We intentionally avoid GoRouter because the app is small (~12 screens
/// across 3 roles). A static route table keeps the routing surface obvious
/// and easy to scan. Use [AppRouter.of] from any widget to push a named
/// route.
class AppRoutes {
  AppRoutes._();

  // Auth
  static const String login = '/login';
  static const String noProfile = '/auth/no-profile';

  // Admin / Owner
  static const String adminHome = '/admin/home';

  // Cashier
  static const String cashierHome = '/cashier/home';
  static const String cashierNewOrder = '/cashier/new-order';
  static const String cashierOrders = '/cashier/orders';
  static const String cashierCustomers = '/cashier/customers';
  static String cashierOrderDetail(String id) => '/cashier/order/$id';

  // Production
  static const String productionHome = '/production/home';
  static const String productionQueue = '/production/queue';
  static const String productionInventory = '/production/inventory';
  static const String productionSensor = '/production/sensor';
  static String productionOrderDetail(String id) => '/production/order/$id';
}

/// Centralized `onGenerateRoute` used by `MaterialApp`. Maps a route name to
/// the screen that should be pushed. Routes not listed here will fall through
/// to the provided [fallback] builder (defaults to the login screen).
class AppRouter {
  AppRouter._();

  static Route<dynamic>? onGenerateRoute(
    RouteSettings settings, {
    required WidgetBuilder fallback,
  }) {
    switch (settings.name) {
      case AppRoutes.login:
        return _pageRoute(settings, (_) => const LoginScreen());
      case AppRoutes.noProfile:
        return _pageRoute(settings, (_) => const NoProfileScreen());

      // Admin / Owner
      case AppRoutes.adminHome:
        return _pageRoute(settings, (_) => const AdminShellScreen());

      // Cashier - single shell with bottom nav, plus standalone deep-links
      case AppRoutes.cashierHome:
        return _pageRoute(settings, (_) => const CashierShellScreen());
      case AppRoutes.cashierNewOrder:
        return _pageRoute(settings, (_) => const CashierNewOrderScreen());
      case AppRoutes.cashierOrders:
        return _pageRoute(settings, (_) => const CashierOrdersScreen());
      case AppRoutes.cashierCustomers:
        return _pageRoute(settings, (_) => const CashierCustomersScreen());

      // Production - single shell with bottom nav
      case AppRoutes.productionHome:
      case AppRoutes.productionQueue:
      case AppRoutes.productionInventory:
      case AppRoutes.productionSensor:
        return _pageRoute(settings, (_) => const ProductionShellScreen());

      // Order detail (parameterized)
      default:
        if (settings.name?.startsWith('/cashier/order/') ?? false) {
          final id = settings.name!.split('/').last;
          return _pageRoute(
            settings,
            (_) => OrderDetailScreen(orderId: id),
          );
        }
        if (settings.name?.startsWith('/production/order/') ?? false) {
          final id = settings.name!.split('/').last;
          return _pageRoute(
            settings,
            (_) => OrderDetailScreen(orderId: id),
          );
        }
        return _pageRoute(settings, fallback);
    }
  }

  static PageRoute<T> _pageRoute<T>(RouteSettings settings, WidgetBuilder builder) {
    return PageRouteBuilder<T>(
      settings: settings,
      transitionDuration: const Duration(milliseconds: 220),
      reverseTransitionDuration: const Duration(milliseconds: 180),
      pageBuilder: (context, animation, secondary) =>
          _ModeAware(builder: builder),
      transitionsBuilder: (context, animation, secondary, child) {
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
      },
    );
  }
}

/// Rebuilds the routed page whenever the appearance mode flips. The page's
/// subtree uses `AppTheme` statics (not only `Theme.of`), so a rebuild has to
/// be forced from above for every color to repaint after a toggle.
class _ModeAware extends StatelessWidget {
  const _ModeAware({required this.builder});

  final WidgetBuilder builder;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: themeNotifier,
      builder: (context, _, _) => builder(context),
    );
  }
}
