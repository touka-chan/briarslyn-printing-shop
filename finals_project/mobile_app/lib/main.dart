import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'app_router.dart';
import 'auth/auth.dart';
import 'firebase_options.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/firebase_bootstrap_error.dart';
import 'services/live_activity_service.dart';
import 'theme/app_theme.dart';
import 'theme/theme_controller.dart';
import 'widgets/offline_banner.dart';

/// Top-level singleton - constructed once after Firebase initializes, then
/// passed into [AuthProvider]. Anywhere in the app, [AuthProvider.of]
/// retrieves the same instance.
final AuthService _auth = AuthService();

/// App-wide messenger so live-activity SnackBars can be shown from the
/// watcher (which lives outside the widget tree).
final GlobalKey<ScaffoldMessengerState> scaffoldMessengerKey =
    GlobalKey<ScaffoldMessengerState>();

/// Keeps the live-activity watcher in sync with the auth state: watch
/// while signed in, stop on sign-out.
void _syncLiveActivityWatcher() {
  if (_auth.isLoggedIn) {
    LiveActivityService.instance.start();
  } else {
    LiveActivityService.instance.stop();
  }
}

/// Last uid whose stored appearance was applied, and the preference that
/// was applied for it. The profile doc trails the Firebase user by a
/// moment, so the mode is applied once per uid when the snapshot with the
/// stored `theme` actually arrives - never re-applied after that, which
/// keeps the optimistic toggle from being reverted by its own write.
String? _appliedThemeUid;
String? _appliedTheme;

void _syncThemeFromProfile() {
  final uid = _auth.currentUid;
  if (uid == null) {
    if (_appliedThemeUid != null) {
      _appliedThemeUid = null;
      _appliedTheme = null;
      applyStoredTheme(null); // sign-out returns to light
    }
    return;
  }
  final user = _auth.currentUser;
  if (user == null) return; // profile snapshot still loading
  if (uid == _appliedThemeUid && _appliedTheme != null) return;
  _appliedThemeUid = uid;
  _appliedTheme = user.theme ?? 'light';
  applyStoredTheme(user.theme);
}

/// Shows one live-activity change as a floating SnackBar (icon + title +
/// detail). Tones stay in the app's monochrome palette; the icon carries
/// the meaning.
void _showLiveActivitySnackBar(LiveActivityEvent event) {
  final messenger = scaffoldMessengerKey.currentState;
  if (messenger == null) return;

  late final Color background;
  late final IconData icon;
  switch (event.tone) {
    case 'success':
      background = AppTheme.success;
      icon = Icons.check_circle_outline;
      break;
    case 'warning':
      background = AppTheme.warning;
      icon = Icons.warning_amber_rounded;
      break;
    case 'error':
      background = AppTheme.statusOverdue;
      icon = Icons.error_outline;
      break;
    default:
      background = AppTheme.primary;
      icon = Icons.info_outline;
  }

  messenger.showSnackBar(
    SnackBar(
      behavior: SnackBarBehavior.floating,
      backgroundColor: background,
      duration: const Duration(seconds: 4),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      content: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppTheme.onPrimary, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  event.title,
                  style: TextStyle(
                    color: AppTheme.onPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  event.detail,
                  style: TextStyle(
                    color: AppTheme.onPrimary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    await _auth.bootstrap();

    // Live activity: every change made on any device (mobile or web, any
    // role) becomes a SnackBar here. Started/stopped with the session.
    LiveActivityService.onEvent = _showLiveActivitySnackBar;
    _auth.addListener(_syncLiveActivityWatcher);
    _syncLiveActivityWatcher();

    // Appearance: apply the signed-in user's saved mode before the first
    // frame (signed-out devices stay light).
    _auth.addListener(_syncThemeFromProfile);
    _syncThemeFromProfile();

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
      child: ValueListenableBuilder<bool>(
        valueListenable: themeNotifier,
        builder: (context, _, _) => MaterialApp(
          title: 'Brialyns Art Sign',
          debugShowCheckedModeBanner: false,
          scaffoldMessengerKey: scaffoldMessengerKey,
          theme: AppTheme.light,
          initialRoute: AppRoutes.login,
          // Global offline strip above every screen.
          builder: (context, child) =>
              OfflineBanner(child: child ?? const SizedBox.shrink()),
          onGenerateRoute: (settings) => AppRouter.onGenerateRoute(
            settings,
            fallback: (_) => const LoginScreen(),
          ),
        ),
      ),
    );
  }
}
