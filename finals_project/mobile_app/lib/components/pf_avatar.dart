import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// A simple circular avatar that displays 1-2 initials from a name.
///
/// The avatar has a primary-tinted background (primary at 12% alpha) with
/// the initials rendered in the primary color. If the name is empty, a
/// person icon is shown instead.
///
/// Used for customer avatars in order lists and detail views.
class PfAvatar extends StatelessWidget {
  const PfAvatar({
    super.key,
    required this.name,
    this.size = 36,
  });

  /// The full name to extract initials from (e.g., "John Doe" → "JD").
  final String name;

  /// The diameter of the avatar circle.
  final double size;

  @override
  Widget build(BuildContext context) {
    final initials = _extractInitials(name);
    final fontSize = size * 0.4;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppTheme.primary.withValues(alpha: 0.12),
        shape: BoxShape.circle,
      ),
      child: Center(
        child: initials.isEmpty
            ? Icon(
                Icons.person_outline_rounded,
                size: size * 0.55,
                color: AppTheme.primary,
              )
            : Text(
                initials,
                style: TextStyle(
                  fontSize: fontSize,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.primary,
                  height: 1.0,
                ),
              ),
      ),
    );
  }

  /// Extracts up to 2 initials from a name.
  ///
  /// Examples:
  /// - "John Doe" → "JD"
  /// - "Alice" → "A"
  /// - "Mary Jane Watson" → "MW"
  /// - "" → ""
  String _extractInitials(String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return '';

    final parts = trimmed.split(RegExp(r'\s+'));
    if (parts.length == 1) {
      return parts[0].substring(0, 1).toUpperCase();
    }

    // Take first char of first name and first char of last name
    return '${parts.first.substring(0, 1)}${parts.last.substring(0, 1)}'
        .toUpperCase();
  }
}
