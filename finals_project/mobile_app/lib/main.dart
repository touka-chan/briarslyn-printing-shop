import 'package:flutter/material.dart';

import 'app_router.dart';
import 'auth/auth.dart';
import 'screens/auth/login_screen.dart';
import 'theme/app_theme.dart';

void main() {
  runApp(const PrintFlowApp());
}

class PrintFlowApp extends StatelessWidget {
  const PrintFlowApp({super.key});

  @override
  Widget build(BuildContext context) {
    return AuthProvider(
      authService: AuthService(),
      child: MaterialApp(
        title: 'PrintFlow Mobile',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        initialRoute: AppRoutes.login,
        onGenerateRoute: (settings) => AppRouter.onGenerateRoute(
          settings,
          fallback: (_) => const LoginScreen(),
        ),
      ),
    );
  }
}
