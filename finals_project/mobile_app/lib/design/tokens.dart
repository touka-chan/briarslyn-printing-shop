import 'package:flutter/material.dart';

// Spacing scale (8pt grid + 4pt micro)
class AppSpacing {
  static const double xxs = 2;
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;
  static const double huge = 48;
}

// Border radius scale
class AppRadius {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double pill = 999;

  // As BorderRadius
  static const BorderRadius rXs = BorderRadius.all(Radius.circular(xs));
  static const BorderRadius rSm = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius rMd = BorderRadius.all(Radius.circular(md));
  static const BorderRadius rLg = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius rXl = BorderRadius.all(Radius.circular(xl));
  static const BorderRadius rPill = BorderRadius.all(Radius.circular(pill));
}

// Shadows (use List<BoxShadow> so we can compose them in BoxDecoration)
class AppShadow {
  static const Color _base = Color(0xFF000000);
  static List<BoxShadow> get sm => [
    BoxShadow(color: _base.withValues(alpha: 0.04), blurRadius: 2, offset: Offset(0, 1)),
  ];
  static List<BoxShadow> get md => [
    BoxShadow(color: _base.withValues(alpha: 0.06), blurRadius: 12, offset: Offset(0, 4)),
  ];
  static List<BoxShadow> get lg => [
    BoxShadow(color: _base.withValues(alpha: 0.08), blurRadius: 24, offset: Offset(0, 12)),
  ];
  static List<BoxShadow> glow(Color tint) => [
    BoxShadow(color: tint.withValues(alpha: 0.25), blurRadius: 16, offset: Offset(0, 4)),
  ];
}

// Motion tokens
class AppMotion {
  static const Duration fast = Duration(milliseconds: 150);
  static const Duration base = Duration(milliseconds: 220);
  static const Duration slow = Duration(milliseconds: 350);
  static const Duration pulse = Duration(milliseconds: 1400); // IoT sensor
  static const Duration countUp = Duration(milliseconds: 800);
  static const Duration stagger = Duration(milliseconds: 60);

  // Curves
  static const Curve easeOutCubic = Curves.easeOutCubic;
  static const Curve easeInCubic = Curves.easeInCubic;
  static const Curve easeOutBack = Curves.easeOutBack;
  static const Curve easeInOutCubic = Curves.easeInOutCubic;
}

// Icon sizes
class AppIconSize {
  static const double xs = 14;
  static const double sm = 18;
  static const double md = 22;
  static const double lg = 28;
  static const double xl = 36;
}

// Breakpoints
class AppBreakpoints {
  static const double compactMax = 600;
  static const double mediumMax = 840;

  static bool isCompact(BuildContext context) =>
      MediaQuery.sizeOf(context).width < compactMax;
  static bool isMediumOrLarger(BuildContext context) =>
      MediaQuery.sizeOf(context).width >= compactMax;
  static bool isExpanded(BuildContext context) =>
      MediaQuery.sizeOf(context).width >= mediumMax;
}

// Responsive helpers
class AppResponsive {
  static double screenPadding(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width < 360) return 12;
    if (width < 600) return 16;
    if (width < 840) return 24;
    return 32;
  }
}

// Typography — the app uses Inter (display + body) and JetBrains Mono (data).
// We expose semantic helpers; the actual TextStyle is provided by Theme.of(context).
class AppTypography {
  // Family keys (google_fonts will resolve these in app_theme.dart)
  static const String display = 'Inter';
  static const String body = 'Inter';
  static const String mono = 'JetBrainsMono';

  // Sizes
  static const double caption = 11;
  static const double label = 12;
  static const double bodySm = 13;
  static const double bodyMd = 14;
  static const double bodyLg = 16;
  static const double titleMd = 18;
  static const double titleLg = 20;
  static const double titleXl = 24;
  static const double displayMd = 28;
  static const double displayLg = 32;
}
