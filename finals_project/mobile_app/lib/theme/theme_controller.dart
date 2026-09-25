import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

import 'app_theme.dart';

/// App-wide appearance mode.
///
/// [themeNotifier] flips when the mode changes; the root `MaterialApp`
/// listens to it and rebuilds after [AppTheme.applyMode] swapped the live
/// palette, so every screen repaints. The choice is stored on the user's
/// profile doc (`users/{uid}.theme`) so it follows the account across
/// devices; signed-out devices default to light.
final ValueNotifier<bool> themeNotifier = ValueNotifier<bool>(false);

/// Applies a stored preference ('dark' | 'light' | null -> light) unless
/// the live mode already matches.
void applyStoredTheme(String? pref) {
  final dark = pref == 'dark';
  if (dark == AppTheme.isDark) return;
  AppTheme.applyMode(dark);
  themeNotifier.value = dark;
}

/// Switches the mode immediately and persists it best-effort. The UI never
/// blocks on (or fails because of) the write.
Future<void> setDarkMode({required bool dark, String? uid}) async {
  AppTheme.applyMode(dark);
  themeNotifier.value = dark;
  if (uid == null || uid.isEmpty) return;
  try {
    await FirebaseFirestore.instance.collection('users').doc(uid).set(
      <String, dynamic>{
        'theme': dark ? 'dark' : 'light',
        'updated_at': FieldValue.serverTimestamp(),
      },
      SetOptions(merge: true),
    );
  } catch (e) {
    debugPrint('[theme] persist failed: $e');
  }
}
