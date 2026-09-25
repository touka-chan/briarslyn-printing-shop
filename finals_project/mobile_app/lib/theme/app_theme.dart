import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// PrintFlow Theme - mirrors the Next.js web dashboard's PrintFlow design system.
/// Colors, typography, radii, and component treatments match the web
/// (`web/src/app/globals.css` + `web/src/components/ui/*`): monochrome
/// brand ramp, Poppins display + Inter body + JetBrains Mono data.
/// (Title 1, Section IX-A: Flutter mobile.)
///
/// DARK MODE: the palette fields below are intentionally MUTABLE (not
/// `const`). [applyMode] swaps the whole ramp at runtime; a root rebuild
/// (see `themeNotifier` in `theme/theme_controller.dart`) then repaints
/// every screen because components read these fields during build.
class AppTheme {
  AppTheme._();

  // --------------------------------------------------------------------------
  // Live palette - starts on the light ramp, [applyMode] flips it.
  // --------------------------------------------------------------------------
  static bool _isDark = false;

  /// True when the dark ramp is active.
  static bool get isDark => _isDark;

  // ---- light ramp (originals) ----
  static const Color _lPrimary = Color(0xFF17171C); // Charcoal - near-black
  static const Color _lPrimaryLight = Color(0xFF000000); // interaction darken
  static const Color _lPrimaryContainer = Color(0xFFE7E7EA);
  static const Color _lOnPrimary = Color(0xFFFFFFFF);
  static const Color _lOnPrimaryContainer = Color(0xFF111114);
  static const Color _lBackground = Color(0xFFFBF9F4); // warm paper white
  static const Color _lSurface = Color(0xFFFFFFFF);
  static const Color _lSurfaceContainer = Color(0xFFF0EEE9);
  static const Color _lSurfaceContainerLow = Color(0xFFF7F4EF);
  static const Color _lSurfaceContainerHigh = Color(0xFFEAE8E3);
  static const Color _lOnSurface = Color(0xFF131315);
  static const Color _lOnSurfaceVariant = Color(0xFF52525B);
  static const Color _lErrorContainer = Color(0xFFE4E4E7);
  static const Color _lOnErrorContainer = Color(0xFF18181B);
  static const Color _lWarningContainer = Color(0xFFF0F0F2);
  static const Color _lWarning = Color(0xFF52525B); // Slate Warning
  static const Color _lSuccess = Color(0xFF27272A);
  static const Color _lSuccessContainer = Color(0xFFE7E7EA);
  static const Color _lStatusOverdue = Color(0xFF18181B);
  static const Color _lStatusUrgent = Color(0xFF52525B);
  static const Color _lStatusCompleted = Color(0xFF3F3F46);
  static const Color _lStatusInProduction = Color(0xFF27272A);
  static const Color _lStatusReadyForPickup = Color(0xFF3F3F46);
  static const Color _lStatusCancelled = Color(0xFF737373);
  static const Color _lStockInsufficient = Color(0xFF18181B);
  static const Color _lSensorStale = Color(0xFFA1A1AA);
  static const Color _lOutline = Color(0xFF737373);
  static const Color _lOutlineVariant = Color(0xFFD4D4D8);

  // ---- dark ramp ----
  // Charcoal canvas + near-white text, the same #17171C family as the web
  // dark surfaces. Primary buttons invert to white-on-black exactly like
  // the web's `dark:bg-white dark:text-black` buttons.
  static const Color _dPrimary = Color(0xFFFFFFFF);
  static const Color _dPrimaryLight = Color(0xFFFFFFFF);
  static const Color _dPrimaryContainer = Color(0xFF26262E);
  static const Color _dOnPrimary = Color(0xFF17171C);
  static const Color _dOnPrimaryContainer = Color(0xFFF4F4F5);
  static const Color _dBackground = Color(0xFF0F0F12); // near-black canvas
  static const Color _dSurface = Color(0xFF17171C); // web sidebar charcoal
  static const Color _dSurfaceContainer = Color(0xFF202027);
  static const Color _dSurfaceContainerLow = Color(0xFF1B1B21);
  static const Color _dSurfaceContainerHigh = Color(0xFF26262E);
  static const Color _dOnSurface = Color(0xFFF4F4F5);
  static const Color _dOnSurfaceVariant = Color(0xFFA1A1AA);
  static const Color _dErrorContainer = Color(0xFF2A2A31);
  static const Color _dOnErrorContainer = Color(0xFFF4F4F5);
  static const Color _dWarningContainer = Color(0xFF24242B);
  static const Color _dWarning = Color(0xFFD4D4D8);
  static const Color _dSuccess = Color(0xFFE4E4E7);
  static const Color _dSuccessContainer = Color(0xFF26262E);
  static const Color _dStatusOverdue = Color(0xFFF4F4F5); // brightest = urgent
  static const Color _dStatusUrgent = Color(0xFFD4D4D8);
  static const Color _dStatusCompleted = Color(0xFFA1A1AA);
  static const Color _dStatusInProduction = Color(0xFFE4E4E7);
  static const Color _dStatusReadyForPickup = Color(0xFFA1A1AA);
  static const Color _dStatusCancelled = Color(0xFF71717A);
  static const Color _dStockInsufficient = Color(0xFFF4F4F5);
  static const Color _dSensorStale = Color(0xFF71717A);
  static const Color _dOutline = Color(0xFF52525B);
  static const Color _dOutlineVariant = Color(0xFF2E2E36);

  // ---- live fields (components read these; do not const them) ----
  static Color primary = _lPrimary;
  static Color primaryLight = _lPrimaryLight;
  static Color primaryContainer = _lPrimaryContainer;
  static Color onPrimary = _lOnPrimary;
  static Color onPrimaryContainer = _lOnPrimaryContainer;
  static Color background = _lBackground;
  static Color surface = _lSurface;
  static Color surfaceContainer = _lSurfaceContainer;
  static Color surfaceContainerLow = _lSurfaceContainerLow;
  static Color surfaceContainerHigh = _lSurfaceContainerHigh;
  static Color onSurface = _lOnSurface;
  static Color onSurfaceVariant = _lOnSurfaceVariant;
  static Color errorContainer = _lErrorContainer;
  static Color onErrorContainer = _lOnErrorContainer;
  static Color warningContainer = _lWarningContainer;
  static Color warning = _lWarning;
  static Color success = _lSuccess;
  static Color successContainer = _lSuccessContainer;
  static Color statusOverdue = _lStatusOverdue;
  static Color statusUrgent = _lStatusUrgent;
  static Color statusUpcoming = _lPrimary; // follows primary
  static Color statusCompleted = _lStatusCompleted;
  static Color statusInProduction = _lStatusInProduction;
  static Color statusReadyForPickup = _lStatusReadyForPickup;
  static Color statusCancelled = _lStatusCancelled;
  static Color stockInStock = _lSuccess; // follows success
  static Color stockLow = _lWarning; // follows warning
  static Color stockInsufficient = _lStockInsufficient;
  static Color sensorActive = _lPrimary; // follows primary
  static Color sensorStale = _lSensorStale;
  static Color outline = _lOutline;
  static Color outlineVariant = _lOutlineVariant;

  // Former electric-cyan accent - repointed to primary (mono system).
  static Color accentCyan = _lPrimary; // follows primary

  // Chrome (app bar + bottom nav) - always the web sidebar charcoal; a
  // hairline separates it from the (dark) surface in dark mode too.
  static const Color chrome = Color(0xFF17171C);
  static const Color onChrome = Color(0xFFFFFFFF);
  static const Color onChromeMuted = Color(0xB3FFFFFF); // white 70%
  static const Color chromeHairline = Color(0x1AFFFFFF); // white 10%

  /// Switches the live palette. Call, then rebuild the app (the root
  /// listens to `themeNotifier`) so every widget re-reads the fields.
  static void applyMode(bool dark) {
    _isDark = dark;
    primary = dark ? _dPrimary : _lPrimary;
    primaryLight = dark ? _dPrimaryLight : _lPrimaryLight;
    primaryContainer = dark ? _dPrimaryContainer : _lPrimaryContainer;
    onPrimary = dark ? _dOnPrimary : _lOnPrimary;
    onPrimaryContainer = dark ? _dOnPrimaryContainer : _lOnPrimaryContainer;
    background = dark ? _dBackground : _lBackground;
    surface = dark ? _dSurface : _lSurface;
    surfaceContainer = dark ? _dSurfaceContainer : _lSurfaceContainer;
    surfaceContainerLow = dark ? _dSurfaceContainerLow : _lSurfaceContainerLow;
    surfaceContainerHigh =
        dark ? _dSurfaceContainerHigh : _lSurfaceContainerHigh;
    onSurface = dark ? _dOnSurface : _lOnSurface;
    onSurfaceVariant = dark ? _dOnSurfaceVariant : _lOnSurfaceVariant;
    errorContainer = dark ? _dErrorContainer : _lErrorContainer;
    onErrorContainer = dark ? _dOnErrorContainer : _lOnErrorContainer;
    warningContainer = dark ? _dWarningContainer : _lWarningContainer;
    warning = dark ? _dWarning : _lWarning;
    success = dark ? _dSuccess : _lSuccess;
    successContainer = dark ? _dSuccessContainer : _lSuccessContainer;
    statusOverdue = dark ? _dStatusOverdue : _lStatusOverdue;
    statusUrgent = dark ? _dStatusUrgent : _lStatusUrgent;
    statusCompleted = dark ? _dStatusCompleted : _lStatusCompleted;
    statusInProduction = dark ? _dStatusInProduction : _lStatusInProduction;
    statusReadyForPickup =
        dark ? _dStatusReadyForPickup : _lStatusReadyForPickup;
    statusCancelled = dark ? _dStatusCancelled : _lStatusCancelled;
    stockInsufficient = dark ? _dStockInsufficient : _lStockInsufficient;
    sensorStale = dark ? _dSensorStale : _lSensorStale;
    outline = dark ? _dOutline : _lOutline;
    outlineVariant = dark ? _dOutlineVariant : _lOutlineVariant;
    // Followers.
    accentCyan = primary;
    statusUpcoming = primary;
    stockInStock = success;
    stockLow = warning;
    sensorActive = primary;
  }

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
    Color? color,
  }) {
    return GoogleFonts.jetBrainsMono(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color ?? onSurface,
    );
  }

  /// Rebuilt on every access so the current palette's text colors apply.
  static TextTheme get textTheme => TextTheme(
        // Display / Hero - Poppins
        displayLarge:
            _poppins(fontSize: 32, fontWeight: FontWeight.w700, color: onSurface),
        displayMedium:
            _poppins(fontSize: 24, fontWeight: FontWeight.w600, color: onSurface),
        displaySmall:
            _poppins(fontSize: 20, fontWeight: FontWeight.w600, color: onSurface),
        // Headlines - Poppins
        headlineLarge:
            _poppins(fontSize: 28, fontWeight: FontWeight.w700, color: onSurface),
        headlineMedium:
            _poppins(fontSize: 24, fontWeight: FontWeight.w600, color: onSurface),
        headlineSmall:
            _poppins(fontSize: 20, fontWeight: FontWeight.w600, color: onSurface),
        // Titles - Inter
        titleLarge: _inter(
            fontSize: 20, fontWeight: FontWeight.w600, color: onSurface),
        titleMedium: _inter(
            fontSize: 16, fontWeight: FontWeight.w600, color: onSurface),
        titleSmall: _inter(
            fontSize: 14, fontWeight: FontWeight.w600, color: onSurface),
        // Body - Inter
        bodyLarge: _inter(
            fontSize: 16, fontWeight: FontWeight.w400, color: onSurface),
        bodyMedium: _inter(
            fontSize: 14, fontWeight: FontWeight.w400, color: onSurfaceVariant),
        bodySmall: _inter(
            fontSize: 12, fontWeight: FontWeight.w400, color: onSurfaceVariant),
        // Labels - Inter
        labelLarge: _inter(
            fontSize: 14, fontWeight: FontWeight.w500, color: onSurface),
        labelMedium: _inter(
            fontSize: 12, fontWeight: FontWeight.w500, color: onSurfaceVariant),
        labelSmall: _inter(
            fontSize: 11, fontWeight: FontWeight.w500, color: onSurfaceVariant),
      );

  // --------------------------------------------------------------------------
  // ThemeData for the ACTIVE mode. A getter (not cached) so a root rebuild
  // after [applyMode] always produces the current palette.
  // --------------------------------------------------------------------------
  static ThemeData get light {
    final colorScheme = ColorScheme(
      brightness: _isDark ? Brightness.dark : Brightness.light,
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
      outline: outline,
      outlineVariant: outlineVariant,
      shadow: Colors.black,
      scrim: Colors.black,
      inverseSurface: _isDark ? const Color(0xFFF4F4F5) : const Color(0xFF17171C),
      onInverseSurface: _isDark ? const Color(0xFF17171C) : background,
      inversePrimary: primaryContainer,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: _isDark ? Brightness.dark : Brightness.light,
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
          side: BorderSide(color: outlineVariant),
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
          side: BorderSide(color: primary),
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
          borderSide: BorderSide(color: primary, width: 2),
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
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
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
      dividerTheme: DividerThemeData(
        color: outlineVariant,
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
        dragHandleColor: outlineVariant,
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
