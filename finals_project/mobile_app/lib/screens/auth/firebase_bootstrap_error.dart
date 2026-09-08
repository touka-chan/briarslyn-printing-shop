import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

/// A simple error screen shown when Firebase initialization fails — usually
/// because the placeholder `firebase_options.dart` has not yet been replaced
/// by `flutterfire configure`. Tells the user the exact next step.
class FirebaseBootstrapErrorApp extends StatelessWidget {
  const FirebaseBootstrapErrorApp({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: Scaffold(
        backgroundColor: AppTheme.background,
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppTheme.statusUrgent.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.cloud_off_rounded,
                      size: 56,
                      color: AppTheme.statusUrgent,
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Firebase not configured',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.onSurface,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'This is a one-time setup. The app will not run until Firebase is connected.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppTheme.onSurfaceVariant),
                  ),
                  const SizedBox(height: 24),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceContainer,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      'Steps:\n'
                      '1. Go to console.firebase.google.com and create a project.\n'
                      '2. Enable Email/Password sign-in under Authentication.\n'
                      '3. Create a Cloud Firestore database in production mode.\n'
                      '4. From the mobile_app/ folder, run:\n'
                      '     flutterfire configure --project=YOUR_PROJECT_ID\n'
                      '5. Re-run the app.',
                      style: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 13,
                        color: AppTheme.onSurface,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Error: $message',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppTheme.statusUrgent,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
