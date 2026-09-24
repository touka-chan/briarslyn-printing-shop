// PrintFlow Mobile - local-write suppression marks.
//
// Short-lived, in-memory markers for changes THIS device just made. The
// [LiveActivityService] watcher would otherwise raise a duplicate
// SnackBar for a write the acting screen already confirmed. Same design
// as the web `web/src/lib/live-activity.ts`.
//
// Kept in its own import-free file so both the watcher and the leaf
// services (including `firebase_rfid.dart`, which the watcher imports)
// can use it without circular imports.
class LiveActivityMarks {
  LiveActivityMarks._();

  static const int _windowMs = 5000;
  static final Map<String, int> _marks = {};

  /// Remember that this device just changed `kind:id`
  /// (kind: 'order' | 'inventory' | 'sensor').
  static void mark(String kind, String id) {
    final now = DateTime.now().millisecondsSinceEpoch;
    _marks['$kind:$id'] = now;
    if (_marks.length > 200) {
      _marks.removeWhere((_, t) => now - t > 15000);
    }
  }

  /// True when this device changed `kind:id` within the last [windowMs].
  static bool isLocal(String kind, String id, {int windowMs = _windowMs}) {
    final t = _marks['$kind:$id'];
    return t != null && DateTime.now().millisecondsSinceEpoch - t < windowMs;
  }

  /// Clears all marks (called when the watcher stops).
  static void clear() => _marks.clear();
}
