import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'app_router.dart';
import 'auth/auth.dart';
import 'firebase_options.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/firebase_bootstrap_error.dart';
import 'theme/app_theme.dart';

/// Top-level singleton - constructed once after Firebase initializes, then
/// passed into [AuthProvider]. Anywhere in the app, [AuthProvider.of]
/// retrieves the same instance.
final AuthService _auth = AuthService();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    await _auth.bootstrap();
    runApp(const PrintFlowApp());
  } on FirebaseException catch (e) {
    // Config placeholder (REPLACE_ME) makes the SDK throw. Show a clear
    // error screen rather than a crash.
    debugPrint('[main] Firebase init failed: ${e.message}');
    runApp(FirebaseBootstrapErrorApp(message: e.message ?? 'Unknown Firebase error'));
  } catch (e) {
    debugPrint('[main] Init failed: $e');
    runApp(FirebaseBootstrapErrorApp(message: e.toString()));
  }
}

class PrintFlowApp extends StatelessWidget {
  const PrintFlowApp({super.key});

  @override
  Widget build(BuildContext context) {
    return AuthProvider(
      authService: _auth,
      child: MaterialApp(
        title: 'Brialyns Art Sign',
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
