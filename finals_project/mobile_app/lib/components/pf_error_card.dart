import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../theme/app_theme.dart';
import 'pf_button.dart';

/// Full-width error card for failed Firestore feeds (permission denied,
/// offline). Used instead of a silent empty state so a feed failure is
/// visible and recoverable.
///
/// Streams auto-recover on reconnect; [onRetry] (re-subscribe via a
/// nonce key) is for permission/config errors. Omit it and the card
/// just explains (e.g. inside stateless screens).
class PfErrorCard extends StatelessWidget {
  const PfErrorCard({
    super.key,
    this.title = "Couldn't load data",
    required this.message,
    this.details,
    this.onRetry,
  });

  final String title;
  final String message;
  final String? details;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppTheme.statusOverdue.withValues(alpha: 0.06),
        borderRadius: AppRadius.rLg,
        border: Border.all(
          color: AppTheme.statusOverdue.withValues(alpha: 0.25),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppTheme.statusOverdue.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.cloud_off_outlined,
              size: AppIconSize.lg,
              color: AppTheme.statusOverdue,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            title,
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w600),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            message,
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: AppTheme.onSurfaceVariant),
            textAlign: TextAlign.center,
          ),
          if (details != null && details!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              details!,
              style: AppTheme.monoStyle(
                fontSize: 11,
                color: AppTheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          if (onRetry != null) ...[
            const SizedBox(height: AppSpacing.md),
            PfButton.outlined(
              label: 'Retry',
              icon: Icons.refresh_rounded,
              onPressed: onRetry,
            ),
          ],
        ],
      ),
    );
  }
}
