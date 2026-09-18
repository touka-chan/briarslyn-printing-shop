import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/tokens.dart';
import '../theme/app_theme.dart';

/// A clean, opinionated [TextFormField] wrapper used by PrintFlow Mobile.
///
/// Features:
///   * Optional floating-style [label] rendered above the field.
///   * Optional [helper] text below the field in onSurfaceVariant.
///   * Optional [errorText] shown in red below the field (takes priority
///     over [helper]).
///   * Optional leading [prefixIcon] and trailing [suffixIcon].
///   * When [monospace] is true the input text is rendered in JetBrains
///     Mono (via [AppTheme.monoStyle]) - useful for IDs and codes.
///   * Filled with [AppTheme.surfaceContainer], borderless until focused,
///     then a 2px primary border is shown.
///
/// The component is intentionally a `StatelessWidget` that returns a
/// [TextFormField] so it can be plugged into [Form] validators directly
/// via [validator].
///
/// Example:
/// ```dart
/// PfTextField(
///   label: 'Customer name',
///   helper: 'As shown on the receipt',
///   prefixIcon: Icons.person_outline,
///   textInputAction: TextInputAction.next,
///   onChanged: (v) => setState(() => _name = v),
/// )
/// ```
class PfTextField extends StatelessWidget {
  /// Creates a text field. All parameters except [controller] are optional.
  const PfTextField({
    super.key,
    this.label,
    this.helper,
    this.errorText,
    this.prefixIcon,
    this.suffixIcon,
    this.monospace = false,
    this.keyboardType,
    this.textInputAction,
    this.obscureText = false,
    this.onChanged,
    this.controller,
    this.validator,
    this.maxLines = 1,
    this.minLines,
    this.enabled = true,
    this.autofocus = false,
    this.hintText,
    this.inputFormatters,
    this.focusNode,
    this.onFieldSubmitted,
  });

  /// Optional field label displayed above the input.
  final String? label;

  /// Optional helper text displayed below the field.
  final String? helper;

  /// Optional error text. When supplied, replaces [helper] and tints the
  /// border red.
  final String? errorText;

  /// Optional leading icon (rendered as a Material icon).
  final IconData? prefixIcon;

  /// Optional trailing widget. Use [Icon] for icons or a small button.
  final Widget? suffixIcon;

  /// When true, the input text uses JetBrains Mono. Use for IDs and codes.
  final bool monospace;

  /// Keyboard type (e.g. `TextInputType.emailAddress`).
  final TextInputType? keyboardType;

  /// Action key (e.g. `TextInputAction.next`).
  final TextInputAction? textInputAction;

  /// When true, input is obscured (passwords).
  final bool obscureText;

  /// Called on every text change.
  final ValueChanged<String>? onChanged;

  /// Optional controller.
  final TextEditingController? controller;

  /// Optional form validator.
  final FormFieldValidator<String>? validator;

  /// Maximum number of lines for the input. Defaults to 1.
  final int? maxLines;

  /// Minimum number of lines. Ignored when [maxLines] is null.
  final int? minLines;

  /// Whether the field is enabled.
  final bool enabled;

  /// Whether to focus the field on first build.
  final bool autofocus;

  /// Placeholder text shown when the field is empty.
  final String? hintText;

  /// Input formatters (e.g. `FilteringTextInputFormatter.digitsOnly`).
  final List<TextInputFormatter>? inputFormatters;

  /// Optional focus node.
  final FocusNode? focusNode;

  /// Called when the user submits the field (e.g. taps the "done" key).
  final ValueChanged<String>? onFieldSubmitted;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final hasError = errorText != null && errorText!.isNotEmpty;
    final effectiveBorderColor = hasError
        ? AppTheme.statusOverdue
        : colorScheme.primary;
    final inputStyle = monospace
        ? AppTheme.monoStyle(fontSize: 14, color: AppTheme.onSurface)
        : theme.textTheme.bodyLarge;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (label != null) ...[
          Text(
            label!,
            style: theme.textTheme.labelLarge?.copyWith(
              color: AppTheme.onSurface,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
        ],
        TextFormField(
          controller: controller,
          focusNode: focusNode,
          enabled: enabled,
          autofocus: autofocus,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          obscureText: obscureText,
          onChanged: onChanged,
          validator: validator,
          maxLines: obscureText ? 1 : maxLines,
          minLines: minLines,
          inputFormatters: inputFormatters,
          onFieldSubmitted: onFieldSubmitted,
          style: inputStyle,
          cursorColor: AppTheme.primary,
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: AppTheme.surfaceContainer,
            hintText: hintText,
            hintStyle: theme.textTheme.bodyLarge?.copyWith(
              color: AppTheme.onSurfaceVariant.withValues(alpha: 0.7),
            ),
            prefixIcon: prefixIcon != null
                ? Icon(
                    prefixIcon,
                    size: AppIconSize.md,
                    color: AppTheme.onSurfaceVariant,
                  )
                : null,
            suffixIcon: suffixIcon,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.md,
            ),
            border: OutlineInputBorder(
              borderRadius: AppRadius.rMd,
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: AppRadius.rMd,
              borderSide: BorderSide(
                color: colorScheme.outlineVariant,
                width: 1,
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: AppRadius.rMd,
              borderSide: BorderSide(
                color: effectiveBorderColor,
                width: 2,
              ),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: AppRadius.rMd,
              borderSide: BorderSide(
                color: AppTheme.statusOverdue,
                width: 1,
              ),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: AppRadius.rMd,
              borderSide: BorderSide(
                color: AppTheme.statusOverdue,
                width: 2,
              ),
            ),
            disabledBorder: OutlineInputBorder(
              borderRadius: AppRadius.rMd,
              borderSide: BorderSide(
                color: colorScheme.outlineVariant.withValues(alpha: 0.5),
                width: 1,
              ),
            ),
          ),
        ),
        if (hasError) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            errorText!,
            style: theme.textTheme.bodySmall?.copyWith(
              color: AppTheme.statusOverdue,
            ),
          ),
        ] else if (helper != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            helper!,
            style: theme.textTheme.bodySmall,
          ),
        ],
      ],
    );
  }
}
