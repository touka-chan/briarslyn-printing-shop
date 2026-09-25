// PrintFlow Mobile - live activity watcher.
//
// Mirror of the web `web/src/lib/live-activity-diff.ts` + the header's
// diff loop: subscribes to orders / inventory / sensors / usage_events /
// users and turns every real change into a [LiveActivityEvent]. The app
// shell (main.dart) shows a SnackBar for events with `alert: true`.
//
// Covering every staff action means notifications stay consistent
// regardless of role: cashier, production, admin and owner all see the
// same feed of changes made on any device.
//
// Self-inflicted changes are suppressed: each service calls
// [LiveActivityService.markLocal] right after its write, so the acting
// device doesn't double-announce an action its own screen already
// confirmed (the web does the same via `markLocalActivity`).
import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/app_user.dart';
import '../models/inventory_item.dart';
import '../models/order.dart';
import '../models/usage_event.dart';
import 'firebase_inventory.dart' as fb_inventory;
import 'firebase_orders.dart' as fb_orders;
import 'firebase_rfid.dart' as fb_rfid;
import 'firebase_usage.dart' as fb_usage;
import 'firebase_users.dart' as fb_users;
import 'live_activity_marks.dart';

/// A real change detected by [LiveActivityService].
class LiveActivityEvent {
  const LiveActivityEvent({
    required this.id,
    required this.tone,
    required this.title,
    required this.detail,
    required this.alert,
  });

  final String id;

  /// 'success' | 'warning' | 'error' | 'info' - drives the SnackBar tone.
  final String tone;
  final String title;
  final String detail;

  /// True = show a SnackBar. False = feed-only (coalesced sub-events and
  /// sign-ins stay quiet on mobile; the notifications screen shows them).
  final bool alert;
}

class _OrderState {
  const _OrderState({
    required this.status,
    required this.paymentStatus,
    required this.paymentMethod,
  });
  final String status;
  final String paymentStatus;
  final String paymentMethod;
}

class _InvState {
  const _InvState({required this.stock, required this.rop});
  final int stock;
  final int rop;
}

class _SensorSnapshot {
  const _SensorSnapshot({required this.online, required this.mode});
  final bool online;
  final String mode;
}

class _StockChange {
  const _StockChange({
    required this.variantId,
    required this.itemType,
    required this.from,
    required this.to,
  });
  final String variantId;
  final String itemType;
  final int from;
  final int to;
}

class LiveActivityService {
  LiveActivityService._();

  static final LiveActivityService instance = LiveActivityService._();

  /// Emitter wired in main.dart to the global ScaffoldMessenger.
  static void Function(LiveActivityEvent event)? onEvent;

  /// Unread live-activity count for the app bar bell badge. Bumped once
  /// per real change (self-inflicted changes never get here); the
  /// Notifications screen resets it when opened.
  static final ValueNotifier<int> unreadCount = ValueNotifier<int>(0);

  // ---- watcher state ----------------------------------------------------
  final List<StreamSubscription<dynamic>> _subs = [];
  bool _active = false;

  final Map<String, _OrderState> _prevOrders = {};
  final Map<String, _InvState> _prevInventory = {};
  final Map<String, _SensorSnapshot> _prevSensors = {};
  final Map<String, String> _prevUsers = {};
  final Set<String> _seenUsage = {};

  /// Variant ids touched by a usage event recently - the matching stock
  /// change is already announced by that event.
  final Map<String, int> _usageTouched = {};

  /// Stock changes are buffered briefly so the matching usage event can
  /// claim the snackbar even when snapshots arrive out of order.
  final Map<String, _StockChange> _stockBuffer = {};
  Timer? _stockTimer;

  final Map<String, String> _userNames = {};

  bool _hydratedOrders = false;
  bool _hydratedInventory = false;
  bool _hydratedSensors = false;
  bool _hydratedUsage = false;
  bool _hydratedUsers = false;

  bool get isRunning => _active;

  /// Starts the watcher. Safe to call repeatedly (e.g. after every auth
  /// change) - a second call while running is a no-op.
  void start() {
    if (_active) return;
    _active = true;

    _subs.add(fb_orders.subscribeOrdersStream().listen(
      _diffOrders,
      onError: (e) => debugPrint('[live] orders feed failed: $e'),
    ));
    _subs.add(fb_inventory.subscribeInventoryStream().listen(
      _diffInventory,
      onError: (e) => debugPrint('[live] inventory feed failed: $e'),
    ));
    _subs.add(fb_rfid.subscribeSensorsStream().listen(
      _diffSensors,
      onError: (e) => debugPrint('[live] sensors feed failed: $e'),
    ));
    _subs.add(fb_usage.subscribeUsageEventsStream(limit: 100).listen(
      _diffUsage,
      onError: (e) => debugPrint('[live] usage feed failed: $e'),
    ));
    _subs.add(fb_users.subscribeUsersStream().listen(
      _diffUsers,
      onError: (e) => debugPrint('[live] users feed failed: $e'),
    ));
  }

  /// Stops the watcher and re-arms hydration for the next sign-in.
  void stop() {
    if (!_active) return;
    _active = false;
    for (final s in _subs) {
      s.cancel();
    }
    _subs.clear();
    _stockTimer?.cancel();
    _stockTimer = null;
    _prevOrders.clear();
    _prevInventory.clear();
    _prevSensors.clear();
    _prevUsers.clear();
    _seenUsage.clear();
    _usageTouched.clear();
    _stockBuffer.clear();
    _userNames.clear();
    LiveActivityMarks.clear();
    _hydratedOrders = false;
    _hydratedInventory = false;
    _hydratedSensors = false;
    _hydratedUsage = false;
    _hydratedUsers = false;
  }

  void _emit(List<LiveActivityEvent> events) {
    if (events.isEmpty || onEvent == null) return;
    // Every real change marks the bell unread; the Notifications screen
    // clears it when opened.
    unreadCount.value += events.length;
    // Cap snackbars per batch so a burst (auto-deduct touching several
    // materials) never floods the screen - mirrors the web header.
    var shown = 0;
    for (final e in events) {
      if (!e.alert) continue;
      if (shown >= 3) break;
      shown++;
      onEvent!(e);
    }
  }

  // ---- orders -----------------------------------------------------------

  void _diffOrders(List<Order> rows) {
    final events = <LiveActivityEvent>[];
    final now = DateTime.now().millisecondsSinceEpoch;
    final next = <String, _OrderState>{};
    for (final o in rows) {
      final state = _OrderState(
        status: o.status,
        paymentStatus: o.paymentStatus ?? '',
        paymentMethod: o.paymentMethod ?? '',
      );
      final before = _prevOrders[o.orderId];
      final local = LiveActivityMarks.isLocal('order', o.orderId);
      if (before == null) {
        events.add(LiveActivityEvent(
          id: 'evt-order-new-${o.orderId}',
          tone: 'success',
          title: 'New order received',
          detail:
              '${o.orderId} - ${o.customerName} (${o.itemType} x${o.quantity})',
          alert: !local,
        ));
      } else {
        if (before.status != state.status) {
          final cancelled = state.status == 'Cancelled';
          events.add(LiveActivityEvent(
            id: 'evt-order-status-${o.orderId}-${state.status}-$now',
            tone: cancelled ? 'error' : 'info',
            title: cancelled
                ? 'Order cancelled'
                : 'Order ${o.orderId}: ${before.status} -> ${state.status}',
            detail:
                '${o.customerName} - ${o.itemType} x${o.quantity}',
            alert: !local,
          ));
        }
        if (before.paymentStatus != state.paymentStatus ||
            before.paymentMethod != state.paymentMethod) {
          events.add(LiveActivityEvent(
            id: 'evt-order-payment-${o.orderId}-$now',
            tone: 'success',
            title: 'Payment updated',
            detail: '${o.orderId} - '
                '${state.paymentStatus.isEmpty ? "Unpaid" : state.paymentStatus}'
                '${state.paymentMethod.isEmpty ? "" : " via ${state.paymentMethod}"}',
            alert: !local,
          ));
        }
      }
      next[o.orderId] = state;
    }
    _prevOrders
      ..clear()
      ..addAll(next);
    if (_hydratedOrders) {
      _emit(events);
    } else {
      _hydratedOrders = true;
    }
  }

  // ---- inventory --------------------------------------------------------

  void _diffInventory(List<InventoryItem> rows) {
    final events = <LiveActivityEvent>[];
    final changes = <_StockChange>[];
    final now = DateTime.now().millisecondsSinceEpoch;
    final next = <String, _InvState>{};
    for (final it in rows) {
      final id = it.materialVariantId;
      final state = _InvState(stock: it.currentStock, rop: it.reorderPoint);
      final before = _prevInventory[id];
      if (before == null) {
        events.add(LiveActivityEvent(
          id: 'evt-item-new-$id-$now',
          tone: 'info',
          title: 'Material added',
          detail:
              '$id - ${it.itemType} (stock ${it.currentStock}, ROP ${it.reorderPoint})',
          alert: false,
        ));
      } else {
        if (before.stock != state.stock) {
          changes.add(_StockChange(
            variantId: id,
            itemType: it.itemType,
            from: before.stock,
            to: state.stock,
          ));
        }
        if (before.rop != state.rop) {
          events.add(LiveActivityEvent(
            id: 'evt-rop-$id-$now',
            tone: 'info',
            title: 'Reorder point updated',
            detail: '$id - ${it.itemType} (${before.rop} -> ${state.rop})',
            alert: !LiveActivityMarks.isLocal('inventory', id),
          ));
        }
      }
      next[id] = state;
    }
    for (final entry in _prevInventory.entries) {
      if (!next.containsKey(entry.key)) {
        events.add(LiveActivityEvent(
          id: 'evt-item-del-${entry.key}-$now',
          tone: 'warning',
          title: 'Material removed',
          detail: '${entry.key} (stock was ${entry.value.stock})',
          alert: false,
        ));
      }
    }
    _prevInventory
      ..clear()
      ..addAll(next);
    if (!_hydratedInventory) {
      _hydratedInventory = true;
      return;
    }
    _emit(events);
    if (changes.isNotEmpty) {
      for (final ch in changes) {
        _stockBuffer[ch.variantId] = ch;
      }
      _stockTimer ??= Timer(const Duration(milliseconds: 1200), _flushStock);
    }
  }

  void _flushStock() {
    _stockTimer = null;
    final pending = Map<String, _StockChange>.from(_stockBuffer);
    _stockBuffer.clear();
    if (pending.isEmpty) return;
    final now = DateTime.now().millisecondsSinceEpoch;
    final events = <LiveActivityEvent>[];
    for (final ch in pending.values) {
      final touchedAt = _usageTouched[ch.variantId];
      // Covered by a usage / auto-deduct snackbar from the same movement.
      if (touchedAt != null && now - touchedAt < 12000) continue;
      events.add(LiveActivityEvent(
        id: 'evt-stock-${ch.variantId}-$now',
        tone: ch.to < ch.from ? 'warning' : 'success',
        title: 'Stock adjusted: ${ch.variantId}',
        detail: '${ch.itemType} - ${ch.from} -> ${ch.to}',
        alert: !LiveActivityMarks.isLocal('inventory', ch.variantId),
      ));
    }
    _emit(events);
  }

  // ---- sensors ----------------------------------------------------------

  void _diffSensors(Map<String, fb_rfid.SensorState> sensors) {
    final events = <LiveActivityEvent>[];
    final now = DateTime.now().millisecondsSinceEpoch;
    final next = <String, _SensorSnapshot>{};
    for (final entry in sensors.entries) {
      final id = entry.key;
      final state = _SensorSnapshot(
        online: entry.value.online,
        mode: entry.value.tapMode,
      );
      final before = _prevSensors[id];
      // A sensor appearing for the first time is setup, not news.
      if (before == null) {
        next[id] = state;
        continue;
      }
      final local = LiveActivityMarks.isLocal('sensor', id);
      if (before.online != state.online) {
        events.add(LiveActivityEvent(
          id: 'evt-sensor-$id-${state.online ? "on" : "off"}-$now',
          tone: state.online ? 'success' : 'warning',
          title: 'Sensor $id ${state.online ? "online" : "offline"}',
          detail: 'ESP32 station status changed',
          alert: !local,
        ));
      }
      if (before.mode != state.mode) {
        events.add(LiveActivityEvent(
          id: 'evt-sensor-mode-$id-$now',
          tone: 'info',
          title: 'Sensor $id mode changed',
          detail: '${before.mode.isEmpty ? "-" : before.mode} -> ${state.mode}',
          alert: !local,
        ));
      }
      next[id] = state;
    }
    _prevSensors
      ..clear()
      ..addAll(next);
    if (_hydratedSensors) {
      _emit(events);
    } else {
      _hydratedSensors = true;
    }
  }

  // ---- usage events -----------------------------------------------------

  void _diffUsage(List<UsageEvent> rows) {
    final events = <LiveActivityEvent>[];
    final next = <String>{};
    final now = DateTime.now().millisecondsSinceEpoch;
    var autoDeductCount = 0;
    String? autoDeductOrderId;
    var autoDeductAnyAlert = false;

    for (final u in rows) {
      final id = u.id ?? '${u.materialVariantId}-${u.timestamp}';
      next.add(id);
      if (_seenUsage.contains(id)) continue;

      _usageTouched[u.materialVariantId] = now;
      final local = LiveActivityMarks.isLocal('inventory', u.materialVariantId);
      final actor = u.byUid == null ? null : _userNames[u.byUid];
      final actorText = actor == null ? '' : ' by $actor';

      if (u.source == 'auto-deduct') {
        autoDeductCount++;
        autoDeductOrderId ??= u.orderId;
        if (!local) autoDeductAnyAlert = true;
        events.add(LiveActivityEvent(
          id: 'evt-usage-$id',
          tone: 'info',
          title: 'Auto-deduct -${u.qty} ${u.materialVariantId}',
          detail: u.orderId == null ? 'Recipe deduction' : 'Order ${u.orderId}',
          alert: false,
        ));
        continue;
      }

      if (u.direction == 'in') {
        events.add(LiveActivityEvent(
          id: 'evt-usage-$id',
          tone: 'success',
          title: 'Stock in +${u.qty} ${u.materialVariantId}',
          detail: [
            if (u.reason != null && u.reason!.isNotEmpty) u.reason!,
            if (actorText.isNotEmpty) actorText.trim(),
          ].join(' - '),
          alert: !local,
        ));
      } else {
        events.add(LiveActivityEvent(
          id: 'evt-usage-$id',
          tone: 'warning',
          title: 'Usage -${u.qty} ${u.materialVariantId}',
          detail: [
            u.reason ?? u.source,
            if (u.orderId != null) 'order ${u.orderId}',
            if (actorText.isNotEmpty) actorText.trim(),
          ].join(' - '),
          alert: !local,
        ));
      }
    }

    _seenUsage
      ..clear()
      ..addAll(next);

    if (!_hydratedUsage) {
      _hydratedUsage = true;
      return;
    }
    if (autoDeductCount > 0 && autoDeductAnyAlert) {
      events.add(LiveActivityEvent(
        id: 'evt-autodeduct-$now',
        tone: 'info',
        title:
            'Auto-deduct: $autoDeductCount material${autoDeductCount == 1 ? "" : "s"}',
        detail: autoDeductOrderId == null
            ? 'Recipe deducted for a production order'
            : 'Order $autoDeductOrderId entered production',
        alert: true,
      ));
    }
    _emit(events);
  }

  // ---- users (sign-ins) -------------------------------------------------

  void _diffUsers(List<AppUser> rows) {
    final events = <LiveActivityEvent>[];
    final now = DateTime.now().millisecondsSinceEpoch;
    final next = <String, String>{};
    for (final u in rows) {
      _userNames[u.id] = u.name.isNotEmpty
          ? u.name
          : (u.email.isNotEmpty ? u.email : u.id);
      final signedInAt = u.lastLogin ?? '';
      final before = _prevUsers[u.id];
      if (before != null && before != signedInAt && signedInAt.isNotEmpty) {
        events.add(LiveActivityEvent(
          id: 'evt-login-${u.id}-$now',
          tone: 'info',
          title: '${u.name.isEmpty ? u.email : u.name} signed in',
          detail: '${u.role} - ${u.email}',
          alert: false,
        ));
      }
      next[u.id] = signedInAt;
    }
    _prevUsers
      ..clear()
      ..addAll(next);
    if (_hydratedUsers) {
      _emit(events);
    } else {
      _hydratedUsers = true;
    }
  }
}
