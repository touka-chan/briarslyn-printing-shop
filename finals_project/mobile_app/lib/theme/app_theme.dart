import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// PrintFlow Theme - mirrors the Next.js web dashboard's PrintFlow design system.
/// Colors, typography, radii, and component treatments match the web
/// (`web/src/app/globals.css` + `web/src/components/ui/*`): monochrome
/// brand ramp, Poppins display + Inter body + JetBrains Mono data.
/// (Title 1, Section IX-A: Flutter mobile.)
class AppTheme {
  AppTheme._();

  // --------------------------------------------------------------------------
  // Monochrome brand ramp - matches web `--color-printflow-*` (light).
  // Semantic roles share the ramp; meaning comes from shade + label +
  // icon, never hue alone.
  // --------------------------------------------------------------------------
  static const Color primary = Color(0xFF17171C); // Charcoal - near-black
  static const Color primaryLight = Color(0xFF000000); // interaction darken
  static const Color primaryContainer = Color(0xFFE7E7EA);
  static const Color onPrimary = Color(0xFFFFFFFF);
  static const Color onPrimaryContainer = Color(0xFF111114);

  // Surface / background - matches web bg + surface + containers.
  static const Color background = Color(0xFFFBF9F4); // warm paper white
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceContainer = Color(0xFFF0EEE9);
  static const Color surfaceContainerLow = Color(0xFFF7F4EF);
  static const Color surfaceContainerHigh = Color(0xFFEAE8E3);
  static const Color onSurface = Color(0xFF131315);
  static const Color onSurfaceVariant = Color(0xFF52525B);

  // Former electric-cyan accent - repointed to primary (mono system).
  static const Color accentCyan = primary;

  // Status containers - monochrome ramp (matches web tokens).
  static const Color errorContainer = Color(0xFFE4E4E7);
  static const Color onErrorContainer = Color(0xFF18181B);
  static const Color warningContainer = Color(0xFFF0F0F2);
  static const Color warning = Color(0xFF52525B); // Slate Warning

  // Success - deep charcoal (+ tinted container).
  static const Color success = Color(0xFF27272A);
  static const Color successContainer = Color(0xFFE7E7EA);

  // --------------------------------------------------------------------------
  // Order status colors - monochrome ramp (darkest = most urgent).
  // --------------------------------------------------------------------------
  static const Color statusOverdue = Color(0xFF18181B);
  static const Color statusUrgent = Color(0xFF52525B);
  static const Color statusUpcoming = primary;
  static const Color statusCompleted = Color(0xFF3F3F46);
  static const Color statusInProduction = Color(0xFF27272A);
  static const Color statusReadyForPickup = Color(0xFF3F3F46);
  static const Color statusCancelled = Color(0xFF737373);

  // Inventory status
  static const Color stockInStock = success;
  static const Color stockLow = warning;
  static const Color stockInsufficient = Color(0xFF18181B);

  // IoT sensor - monochrome pulse (active = solid, stale = muted).
  static const Color sensorActive = primary;
  static const Color sensorStale = Color(0xFFA1A1AA);

  // --------------------------------------------------------------------------
  // Typography - Poppins for display, Inter for body, JetBrains for data.
  // Matches web: Poppins 700/800 display + system-sans body (Inter is the
  // closest humanist sans on Android) + mono IDs.
  // --------------------------------------------------------------------------
  static TextStyle _poppins({
    required double fontSize,
    required FontWeight fontWeight,
    required Color color,
  }) {
    return GoogleFonts.poppins(
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
    // Display / Hero - Poppins
    displayLarge: _poppins(fontSize: 32, fontWeight: FontWeight.w700, color: onSurface),
    displayMedium: _poppins(fontSize: 24, fontWeight: FontWeight.w600, color: onSurface),
    displaySmall: _poppins(fontSize: 20, fontWeight: FontWeight.w600, color: onSurface),
    // Headlines - Poppins
    headlineLarge: _poppins(fontSize: 28, fontWeight: FontWeight.w700, color: onSurface),
    headlineMedium: _poppins(fontSize: 24, fontWeight: FontWeight.w600, color: onSurface),
    headlineSmall: _poppins(fontSize: 20, fontWeight: FontWeight.w600, color: onSurface),
    // Titles - Inter
    titleLarge: _inter(fontSize: 20, fontWeight: FontWeight.w600, color: onSurface),
    titleMedium: _inter(fontSize: 16, fontWeight: FontWeight.w600, color: onSurface),
    titleSmall: _inter(fontSize: 14, fontWeight: FontWeight.w600, color: onSurface),
    // Body - Inter
    bodyLarge: _inter(fontSize: 16, fontWeight: FontWeight.w400, color: onSurface),
    bodyMedium: _inter(fontSize: 14, fontWeight: FontWeight.w400, color: onSurfaceVariant),
    bodySmall: _inter(fontSize: 12, fontWeight: FontWeight.w400, color: onSurfaceVariant),
    // Labels - Inter
    labelLarge: _inter(fontSize: 14, fontWeight: FontWeight.w500, color: onSurface),
    labelMedium: _inter(fontSize: 12, fontWeight: FontWeight.w500, color: onSurfaceVariant),
    labelSmall: _inter(fontSize: 11, fontWeight: FontWeight.w500, color: onSurfaceVariant),
  );

  // --------------------------------------------------------------------------
  // Light theme
  // --------------------------------------------------------------------------
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
      tertiary: onSurfaceVariant,
      onTertiary: onPrimary,
      tertiaryContainer: primaryContainer,
      onTertiaryContainer: onPrimaryContainer,
      error: statusOverdue,
      onError: onPrimary,
      errorContainer: errorContainer,
      onErrorContainer: onErrorContainer,
      surface: surface,
      onSurface: onSurface,
      surfaceContainerHighest: surfaceContainer,
      onSurfaceVariant: onSurfaceVariant,
      outline: const Color(0xFF737373),
      outlineVariant: const Color(0xFFD4D4D8),
      shadow: Colors.black,
      scrim: Colors.black,
      inverseSurface: const Color(0xFF17171C),
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
        titleTextStyle: GoogleFonts.poppins(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: onSurface,
        ),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: colorScheme.outlineVariant),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: onPrimary,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          textStyle: GoogleFonts.poppins(
            fontSize: 14,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primary,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
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
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
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
        color: Color(0xFFD4D4D8),
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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
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
