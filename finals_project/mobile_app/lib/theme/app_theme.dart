import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// PrintFlow Theme — mirrors the Next.js web dashboard's PrintFlow design system.
/// All colors and typography align with the web frontend (Tailwind v4) to ensure
/// consistent branding across mobile and web (Title 1, Section IX-A: Flutter mobile).
class AppTheme {
  AppTheme._();

  // ──────────────────────────────────────────────────────────────────────────
  // Primary palette — "Ink & Paper" theme (deeper teal for industrial feel)
  // ──────────────────────────────────────────────────────────────────────────
  static const Color primary = Color(0xFF004D53); // Ink — deeper teal
  static const Color primaryLight = Color(0xFF007B83); // Ink Light — hover/focus
  static const Color primaryContainer = Color(0xFF89F1FF);
  static const Color onPrimary = Color(0xFFFFFFFF);
  static const Color onPrimaryContainer = Color(0xFF001F24);

  // Surface / background — "Paper" tones
  static const Color background = Color(0xFFFAFDFD); // Paper — slight cool cast
  static const Color surface = Color(0xFFFFFFFF); // Paper Elevated — pure white
  static const Color surfaceContainer = Color(0xFFE8EEEE); // Paper Pressed
  static const Color surfaceContainerLow = Color(0xFFF5F8F8); // Paper Subtle
  static const Color onSurface = Color(0xFF1A1F1F); // Graphite — near-black
  static const Color onSurfaceVariant = Color(0xFF4A5454); // Graphite Muted

  // Signature accent — electric cyan for IoT/live data
  static const Color accentCyan = Color(0xFF00B4C6);

  // Status colors (refined for "Ink & Paper" theme)
  static const Color errorContainer = Color(0xFFFFDAD6);
  static const Color onErrorContainer = Color(0xFF410002);
  static const Color warningContainer = Color(0xFFFFE2A8);
  static const Color warning = Color(0xFFE87D0E); // Amber Warning

  // Success / Completed — "Forest" green
  static const Color success = Color(0xFF2A7C2E);
  static const Color successContainer = Color(0xFFD7F3D8);

  // ──────────────────────────────────────────────────────────────────────────
  // Order status colors (Title 1 FR3 priority: Overdue/Urgent/Upcoming)
  // ──────────────────────────────────────────────────────────────────────────
  static const Color statusOverdue = Color(0xFFC02828); // Crimson Overdue
  static const Color statusUrgent = Color(0xFFE87D0E); // Amber Warning
  static const Color statusUpcoming = primary; // Ink (primary)
  static const Color statusCompleted = success; // Forest Success
  static const Color statusInProduction = Color(0xFF1976D2);
  static const Color statusReadyForPickup = Color(0xFF7B1FA2);
  static const Color statusCancelled = Color(0xFF6B7280);

  // Inventory status
  static const Color stockInStock = success;
  static const Color stockLow = warning;
  static const Color stockInsufficient = Color(0xFFC02828);

  // IoT sensor — use accentCyan for live pulse
  static const Color sensorActive = accentCyan;
  static const Color sensorStale = Color(0xFFF59E0B);

  // ──────────────────────────────────────────────────────────────────────────
  // Typography — Space Grotesk for display, Inter for body, JetBrains for data
  // ──────────────────────────────────────────────────────────────────────────
  static TextStyle _spaceGrotesk({
    required double fontSize,
    required FontWeight fontWeight,
    required Color color,
  }) {
    return GoogleFonts.spaceGrotesk(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
    );
  }

  static TextStyle _inter({
    required double fontSize,
    required FontWeight fontWeight,
    required Color color,
  }) {
    return GoogleFonts.inter(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
    );
  }

  /// JetBrains Mono for monospaced text (IDs, raw data, numbers).
  static TextStyle monoStyle({
    double fontSize = 13,
    FontWeight fontWeight = FontWeight.w400,
    Color color = onSurface,
  }) {
    return GoogleFonts.jetBrainsMono(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
    );
  }

  static final TextTheme textTheme = TextTheme(
    // Display / Hero — Space Grotesk
    displayLarge: _spaceGrotesk(fontSize: 32, fontWeight: FontWeight.w700, color: onSurface),
    displayMedium: _spaceGrotesk(fontSize: 24, fontWeight: FontWeight.w600, color: onSurface),
    displaySmall: _spaceGrotesk(fontSize: 20, fontWeight: FontWeight.w600, color: onSurface),
    // Headlines — Space Grotesk
    headlineLarge: _spaceGrotesk(fontSize: 28, fontWeight: FontWeight.w700, color: onSurface),
    headlineMedium: _spaceGrotesk(fontSize: 24, fontWeight: FontWeight.w600, color: onSurface),
    headlineSmall: _spaceGrotesk(fontSize: 20, fontWeight: FontWeight.w600, color: onSurface),
    // Titles — Inter
    titleLarge: _inter(fontSize: 20, fontWeight: FontWeight.w600, color: onSurface),
    titleMedium: _inter(fontSize: 16, fontWeight: FontWeight.w600, color: onSurface),
    titleSmall: _inter(fontSize: 14, fontWeight: FontWeight.w600, color: onSurface),
    // Body — Inter
    bodyLarge: _inter(fontSize: 16, fontWeight: FontWeight.w400, color: onSurface),
    bodyMedium: _inter(fontSize: 14, fontWeight: FontWeight.w400, color: onSurfaceVariant),
    bodySmall: _inter(fontSize: 12, fontWeight: FontWeight.w400, color: onSurfaceVariant),
    // Labels — Inter
    labelLarge: _inter(fontSize: 14, fontWeight: FontWeight.w500, color: onSurface),
    labelMedium: _inter(fontSize: 12, fontWeight: FontWeight.w500, color: onSurfaceVariant),
    labelSmall: _inter(fontSize: 11, fontWeight: FontWeight.w500, color: onSurfaceVariant),
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Light theme
  // ──────────────────────────────────────────────────────────────────────────
  static ThemeData get light {
    final colorScheme = ColorScheme(
      brightness: Brightness.light,
      primary: primary,
      onPrimary: onPrimary,
      primaryContainer: primaryContainer,
      onPrimaryContainer: onPrimaryContainer,
      secondary: primary,
      onSecondary: onPrimary,
      secondaryContainer: primaryContainer,
      onSecondaryContainer: onPrimaryContainer,
      tertiary: success,
      onTertiary: onPrimary,
      tertiaryContainer: successContainer,
      onTertiaryContainer: Color(0xFF002106),
      error: statusOverdue,
      onError: onPrimary,
      errorContainer: errorContainer,
      onErrorContainer: onErrorContainer,
      surface: surface,
      onSurface: onSurface,
      surfaceContainerHighest: surfaceContainer,
      onSurfaceVariant: onSurfaceVariant,
      outline: Color(0xFF6F7979),
      outlineVariant: Color(0xFFBEC8C8),
      shadow: Colors.black,
      scrim: Colors.black,
      inverseSurface: Color(0xFF2B3231),
      onInverseSurface: background,
      inversePrimary: primaryContainer,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: background,
      textTheme: textTheme,
      pageTransitionsTheme: PageTransitionsTheme(
        builders: {
          TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        },
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: surface,
        foregroundColor: onSurface,
        elevation: 0,
        scrolledUnderElevation: 1,
        centerTitle: false,
        titleTextStyle: GoogleFonts.inter(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: onSurface,
        ),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: colorScheme.outlineVariant),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: onPrimary,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: GoogleFonts.inter(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primary,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          side: const BorderSide(color: primary),
          textStyle: GoogleFonts.inter(
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceContainer,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: primary, width: 2),
        ),
        labelStyle: GoogleFonts.inter(
          fontSize: 14,
          fontWeight: FontWeight.w400,
          color: onSurfaceVariant,
        ),
        hintStyle: GoogleFonts.inter(
          fontSize: 14,
          fontWeight: FontWeight.w400,
          color: onSurfaceVariant,
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: surface,
        selectedItemColor: primary,
        unselectedItemColor: onSurfaceVariant,
        type: BottomNavigationBarType.fixed,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        indicatorColor: primaryContainer,
        labelTextStyle: WidgetStatePropertyAll(
          GoogleFonts.inter(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: onSurface,
          ),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: Color(0xFFBEC8C8),
        thickness: 1,
        space: 1,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: surface,
        modalBackgroundColor: surface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        showDragHandle: true,
        dragHandleColor: colorScheme.outlineVariant,
        elevation: 0,
        modalElevation: 8,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        elevation: 0,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: colorScheme.inverseSurface,
        contentTextStyle: TextStyle(
          color: colorScheme.onInverseSurface,
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        elevation: 6,
      ),
    );
  }
}
