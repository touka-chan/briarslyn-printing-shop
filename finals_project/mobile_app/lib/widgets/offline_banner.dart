import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Global offline strip, installed above the whole app in
/// `MaterialApp.builder`. Shows a thin red band ("No internet connection")
/// the moment connectivity drops, and hides itself when it returns.
/// Firestore retries its listeners on its own, so the strip is purely
/// informational - screens keep their own error/retry cards.
class OfflineBanner extends StatefulWidget {
  const OfflineBanner({super.key, required this.child});

  final Widget child;

  @override
  State<OfflineBanner> createState() => _OfflineBannerState();
}

class _OfflineBannerState extends State<OfflineBanner> {
  bool _offline = false;
  StreamSubscription<List<ConnectivityResult>>? _sub;

  @override
  void initState() {
    super.initState();
    _refresh();
    try {
      _sub = Connectivity().onConnectivityChanged.listen((results) {
        _set((results));
      });
    } catch (_) {
      // Plugin unavailable (e.g. unsupported platform) - stay online.
    }
  }

  Future<void> _refresh() async {
    try {
      final results = await Connectivity().checkConnectivity();
      _set(results);
    } catch (_) {}
  }

  void _set(List<ConnectivityResult> results) {
    final offline =
        results.isEmpty || results.every((r) => r == ConnectivityResult.none);
    if (mounted && offline != _offline) {
      setState(() => _offline = offline);
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_offline) return widget.child;

    return Column(
      children: [
        Container(
          width: double.infinity,
          color: AppTheme.statusOverdue,
          padding: EdgeInsets.only(
            top: MediaQuery.of(context).padding.top + 5,
            bottom: 6,
            left: 14,
            right: 14,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.wifi_off_rounded, size: 14, color: AppTheme.onPrimary),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  'No internet connection - changes sync when back online',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.onPrimary,
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          // The strip now owns the status-bar inset; children must not
          // pad for it again or every screen gains a phantom gap.
          child: MediaQuery.removePadding(
            context: context,
            removeTop: true,
            child: widget.child,
          ),
        ),
      ],
    );
  }
}
