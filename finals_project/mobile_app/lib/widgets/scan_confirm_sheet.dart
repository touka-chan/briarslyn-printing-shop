import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../auth/auth.dart';
import '../design/tokens.dart';
import '../models/inventory_item.dart';
import '../models/rfid_event.dart';
import '../services/firebase_rfid.dart' as fb_rfid;
import '../services/inventory_service.dart';
import '../services/usage_service.dart';
import '../theme/app_theme.dart';
import '../components/pf_button.dart';

/// What a confirmed tap means:
///   * [stockIn]      - apply `logStockIn(qty)` to the selected item
///   * [adjust]       - set the stock to [ScanConfirmSheet.targetStock]
///   * [reorderPoint] - set the ROP to [ScanConfirmSheet.newReorderPoint]
///   * [bind]         - only (re)bind the tapped tag to the selected item
///   * [capture]      - for a not-yet-created item: just return the UID
///   * [lookup]       - return the UID so the caller can open/create the item
enum ScanConfirmMode { stockIn, adjust, reorderPoint, bind, capture, lookup }

/// Opens the "waiting for scan" sheet and returns the UID that was
/// consumed (null when cancelled). The caller must render it above the
/// current screen; the sheet handles its own subscription + timeout.
Future<String?> showScanConfirmSheet(
  BuildContext context, {
  required ScanConfirmMode mode,
  InventoryItem? item,
  int? qty,
  String? note,
  int? targetStock,
  int? newReorderPoint,
}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    isDismissible: false,
    enableDrag: false,
    builder: (_) => ScanConfirmSheet(
      mode: mode,
      item: item,
      qty: qty,
      note: note,
      targetStock: targetStock,
      newReorderPoint: newReorderPoint,
    ),
  );
}

class ScanConfirmSheet extends StatefulWidget {
  const ScanConfirmSheet({
    super.key,
    required this.mode,
    this.item,
    this.qty,
    this.note,
    this.targetStock,
    this.newReorderPoint,
  }) : assert(
          item != null ||
              mode == ScanConfirmMode.capture ||
              mode == ScanConfirmMode.lookup,
          'item is required except in capture/lookup mode',
        );

  final ScanConfirmMode mode;
  final InventoryItem? item;
  final int? qty;
  final String? note;

  /// New absolute stock value for [ScanConfirmMode.adjust].
  final int? targetStock;

  /// New reorder point for [ScanConfirmMode.reorderPoint].
  final int? newReorderPoint;

  @override
  State<ScanConfirmSheet> createState() => _ScanConfirmSheetState();
}

enum _Phase { waiting, warning, success, timeout }

class _ScanConfirmSheetState extends State<ScanConfirmSheet> {
  static const int _timeoutSeconds = 60;

  StreamSubscription<List<RfidCheckoutEvent>>? _sub;
  Timer? _timer;
  int _secondsLeft = _timeoutSeconds;

  _Phase _phase = _Phase.waiting;
  String? _message;
  bool _busy = false;
  bool _consumed = false;
  String? _baselineKey;

  @override
  void initState() {
    super.initState();
    _listen();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _phase != _Phase.waiting || _busy) return;
      if (_secondsLeft <= 1) {
        setState(() {
          _phase = _Phase.timeout;
          _secondsLeft = 0;
        });
        _timer?.cancel();
      } else {
        setState(() => _secondsLeft--);
      }
    });
  }

  void _listen() {
    _sub = fb_rfid.subscribeRfidEventsStream(limit: 5).listen(
      (events) {
        if (!mounted || events.isEmpty) return;
        final latest = events.first;
        final key =
            '${latest.tagUid}|${latest.timestamp.microsecondsSinceEpoch}';
        if (_baselineKey == null) {
          // First snapshot: remember what was already there so only a
          // genuinely NEW tap is consumed.
          _baselineKey = key;
          return;
        }
        if (key == _baselineKey) return;
        _baselineKey = key;
        if (_phase != _Phase.waiting || _busy || _consumed) return;
        _onTap(latest);
      },
      onError: (_) {},
    );
  }

  Future<void> _onTap(RfidCheckoutEvent event) async {
    final tagUid = event.tagUid.trim().toUpperCase();
    if (tagUid.isEmpty) return;
    final auth = AuthProvider.of(context);
    setState(() {
      _busy = true;
      _consumed = true;
    });
    try {
      if (widget.mode == ScanConfirmMode.lookup) {
        // No writes: the caller routes the UID (open the matching item or
        // offer to create one). The owner is only used for the label.
        final owner = await InventoryService.findVariantByTag(tagUid);
        _succeed(
          owner == null
              ? 'Free tag - not bound to any item'
              : 'Found: $owner',
          tagUid,
          popValue: tagUid,
        );
        return;
      }

      final owner = await InventoryService.findVariantByTag(tagUid);

      if (widget.mode == ScanConfirmMode.capture) {
        if (owner != null) {
          _warn('This tag is already bound to $owner');
          return;
        }
        _succeed('New tag scanned', tagUid, popValue: tagUid);
        return;
      }

      final item = widget.item!;
      final itemTag = (item.tagUid ?? '').trim().toUpperCase();

      if (owner != null && owner != item.materialVariantId) {
        _warn('This tag is bound to $owner');
        return;
      }
      final appliesToItem = widget.mode == ScanConfirmMode.stockIn ||
          widget.mode == ScanConfirmMode.adjust ||
          widget.mode == ScanConfirmMode.reorderPoint;
      if (appliesToItem && itemTag.isNotEmpty && itemTag != tagUid) {
        _warn('Mismatch: ${item.materialVariantId} is bound to $itemTag');
        return;
      }

      var boundNow = false;
      if (owner == null && itemTag != tagUid) {
        await InventoryService.bindTag(
          materialVariantId: item.materialVariantId,
          tagUid: tagUid,
          previousTag: item.tagUid,
          auth: auth,
        );
        boundNow = true;
      }

      if (widget.mode == ScanConfirmMode.bind) {
        _succeed(
          boundNow ? 'Tag bound' : 'Tag already bound',
          tagUid,
          popValue: tagUid,
        );
        return;
      }

      if (widget.mode == ScanConfirmMode.adjust) {
        final target = widget.targetStock ?? item.currentStock;
        await InventoryService.updateStock(
          materialVariantId: item.materialVariantId,
          newStock: target,
          auth: auth,
        );
        _succeed(
          'Adjusted: ${item.materialVariantId} = $target',
          tagUid,
          popValue: tagUid,
        );
        return;
      }

      if (widget.mode == ScanConfirmMode.reorderPoint) {
        final rop = widget.newReorderPoint ?? item.reorderPoint;
        await InventoryService.updateReorderPoint(
          materialVariantId: item.materialVariantId,
          newReorderPoint: rop,
          auth: auth,
        );
        _succeed(
          'New ROP: ${item.materialVariantId} = $rop',
          tagUid,
          popValue: tagUid,
        );
        return;
      }

      // stockIn
      await UsageService.logStockIn(
        materialVariantId: item.materialVariantId,
        qty: widget.qty ?? 1,
        note: widget.note ?? 'RFID scan receive',
        source: 'rfid',
        auth: auth,
      );
      _succeed(
        'Received: +${widget.qty ?? 1} ${item.materialVariantId}',
        tagUid,
        popValue: tagUid,
      );
    } on PermissionDeniedException catch (e) {
      _warn(e.message);
    } catch (e) {
      _warn('Failed: $e');
    }
  }

  /// Warning keeps the sheet open and lets the operator tap the correct
  /// tag instead (the timer keeps running).
  void _warn(String message) {
    if (!mounted) return;
    HapticFeedback.heavyImpact();
    setState(() {
      _busy = false;
      _consumed = false;
      _phase = _Phase.warning;
      _message = message;
    });
  }

  void _succeed(String title, String tagUid, {String? popValue}) {
    if (!mounted) return;
    HapticFeedback.mediumImpact();
    setState(() {
      _busy = false;
      _phase = _Phase.success;
      _message = '$title\nTag: $tagUid';
    });
    // Auto-close so the operator can continue immediately.
    Future.delayed(const Duration(milliseconds: 1600), () {
      if (mounted) Navigator.pop(context, popValue);
    });
  }

  void _tryAgain() {
    setState(() {
      _phase = _Phase.waiting;
      _message = null;
      _busy = false;
      _consumed = false;
      _secondsLeft = _timeoutSeconds;
    });
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _phase != _Phase.waiting || _busy) return;
      if (_secondsLeft <= 1) {
        setState(() {
          _phase = _Phase.timeout;
          _secondsLeft = 0;
        });
        _timer?.cancel();
      } else {
        setState(() => _secondsLeft--);
      }
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    _timer?.cancel();
    super.dispose();
  }

  String get _title {
    switch (widget.mode) {
      case ScanConfirmMode.stockIn:
        return 'Stock In - Scan to confirm';
      case ScanConfirmMode.adjust:
        return 'Adjust Stock - Scan to confirm';
      case ScanConfirmMode.reorderPoint:
        return 'Reorder Point - Scan to confirm';
      case ScanConfirmMode.bind:
        return 'Bind RFID tag';
      case ScanConfirmMode.capture:
        return 'Scan the new tag';
      case ScanConfirmMode.lookup:
        return 'Find by scan';
    }
  }

  String get _subtitle {
    final item = widget.item;
    if (item == null) {
      return widget.mode == ScanConfirmMode.lookup
          ? 'Tap the tag of the item to find'
          : 'Tap the new tag on the reader';
    }
    final extra = switch (widget.mode) {
      ScanConfirmMode.stockIn => '  -  Receive +${widget.qty ?? 1}',
      ScanConfirmMode.adjust =>
        '  -  New stock: ${widget.targetStock ?? item.currentStock}',
      ScanConfirmMode.reorderPoint =>
        '  -  New ROP: ${widget.newReorderPoint ?? item.reorderPoint}',
      _ => '',
    };
    return '${item.materialVariantId} - ${item.itemType}$extra';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: AppSpacing.md),
              decoration: BoxDecoration(
                color: AppTheme.surfaceContainer,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Text(
            _title,
            style: Theme.of(context)
                .textTheme
                .headlineSmall
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            _subtitle,
            style: AppTheme.monoStyle(
              fontSize: 12,
              color: AppTheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          Center(child: _statusVisual()),
          const SizedBox(height: AppSpacing.md),
          Center(child: _statusText()),
          const SizedBox(height: AppSpacing.xl),
          if (_phase == _Phase.timeout)
            Row(
              children: [
                Expanded(
                  child: PfButton.outlined(
                    label: 'Cancel',
                    fullWidth: true,
                    onPressed: () => Navigator.pop(context),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: PfButton.filled(
                    label: 'Try again',
                    icon: Icons.refresh_rounded,
                    fullWidth: true,
                    onPressed: _tryAgain,
                  ),
                ),
              ],
            )
          else if (_phase != _Phase.success)
            PfButton.outlined(
              label: 'Cancel',
              fullWidth: true,
              onPressed: _busy ? null : () => Navigator.pop(context),
            ),
        ],
      ),
    );
  }

  Widget _statusVisual() {
    switch (_phase) {
      case _Phase.waiting:
        return SizedBox(
          width: 84,
          height: 84,
          child: Stack(
            alignment: Alignment.center,
            children: [
              const SizedBox(
                width: 84,
                height: 84,
                child: CircularProgressIndicator(strokeWidth: 3),
              ),
              Container(
                width: 62,
                height: 62,
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.10),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.nfc_rounded,
                    size: 30, color: AppTheme.primary),
              ),
            ],
          ),
        );
      case _Phase.warning:
        return _circle(
          icon: Icons.warning_amber_rounded,
          color: AppTheme.warning,
        );
      case _Phase.success:
        return _circle(
          icon: Icons.check_circle_outline_rounded,
          color: AppTheme.statusCompleted,
        );
      case _Phase.timeout:
        return _circle(
          icon: Icons.timer_off_outlined,
          color: AppTheme.onSurfaceVariant,
        );
    }
  }

  Widget _circle({required IconData icon, required Color color}) {
    return Container(
      width: 84,
      height: 84,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        shape: BoxShape.circle,
      ),
      child: Icon(icon, size: 40, color: color),
    );
  }

  Widget _statusText() {
    final base = Theme.of(context).textTheme.bodyMedium!;
    switch (_phase) {
      case _Phase.waiting:
        final hint = switch (widget.mode) {
          ScanConfirmMode.capture =>
            'Tap the NEW tag on the reader now...',
          ScanConfirmMode.lookup =>
            'Tap the tag of the item to find...',
          _ =>
            'Tap the sticker/tag of ${widget.item?.materialVariantId ?? ''} on the reader now...',
        };
        return Column(
          children: [
            Text(
              hint,
              textAlign: TextAlign.center,
              style: base.copyWith(
                color: AppTheme.onSurface,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: AppSpacing.xxs),
            Text(
              '$_secondsLeft seconds left',
              textAlign: TextAlign.center,
              style: base.copyWith(color: AppTheme.onSurfaceVariant),
            ),
          ],
        );
      case _Phase.warning:
        return Text(
          _message ?? '',
          textAlign: TextAlign.center,
          style: base.copyWith(
            color: AppTheme.warning,
            fontWeight: FontWeight.w600,
          ),
        );
      case _Phase.success:
        return Text(
          _message ?? '',
          textAlign: TextAlign.center,
          style: base.copyWith(
            color: AppTheme.statusCompleted,
            fontWeight: FontWeight.w600,
          ),
        );
      case _Phase.timeout:
        return Text(
          'No scan detected. Try again.',
          textAlign: TextAlign.center,
          style: base.copyWith(color: AppTheme.onSurfaceVariant),
        );
    }
  }
}
