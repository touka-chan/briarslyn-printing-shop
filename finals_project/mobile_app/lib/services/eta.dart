// PrintFlow Mobile - live backlog-based ETA (Title 1 objective 9).
//
// Dart mirror of `getLiveETA` in `web/src/lib/derived.ts`. Same spec:
//
//   rank       = position in the priority-sorted active queue
//   unitsAhead = quantities of all active orders ahead of it
//   rate       = completed units/day over the last 7 days, or the
//                cold-start fallback when there is no history
//   etaDays    = ceil((unitsAhead + ownQty) / rate), minimum 1
//   ETA        = today + etaDays
//
// `basedOn` is honest about live signals: `backlog` always, `capacity`
// only with real completion history, `job_complexity` only when bigger
// than the median active order.
import '../models/order.dart';

/// Cold-start daily throughput (units/day) with no completion history.
/// Documented assumption - `capacity` is omitted from `basedOn` then.
const int fallbackDailyUnits = 10;

/// Active (unfinished) statuses forming the backlog.
bool isActiveStatus(String status) =>
    status == 'Pending' ||
    status == 'In Production' ||
    status == 'Ready for Pickup';

/// Live priority from a target date (web `getPriority` rule).
String livePriority(DateTime targetDate, [DateTime? now]) {
  final n = now ?? DateTime.now();
  final today = DateTime(n.year, n.month, n.day);
  final target =
      DateTime(targetDate.year, targetDate.month, targetDate.day);
  final days = target.difference(today).inDays;
  if (days < 0) return 'Overdue';
  if (days <= 2) return 'Urgent';
  return 'Upcoming';
}

int _priorityWeight(String priority) => switch (priority) {
      'Overdue' => 0,
      'Urgent' => 1,
      _ => 2,
    };

/// Completed units finished in the trailing 7 days (throughput signal).
int completedUnitsLast7d(List<Order> orders, [DateTime? now]) {
  final n = now ?? DateTime.now();
  final start = n.subtract(const Duration(days: 7));
  var sum = 0;
  for (final o in orders) {
    final done = o.completedAt;
    if (o.status == 'Completed' &&
        done != null &&
        !done.isBefore(start)) {
      sum += o.quantity < 0 ? 0 : o.quantity;
    }
  }
  return sum;
}

class EtaResult {
  final DateTime date;
  final List<String> basedOn;

  const EtaResult({required this.date, required this.basedOn});
}

EtaResult liveEta({
  required Order order,
  required List<Order> active,
  required double historyUnitsPerDay,
  DateTime? now,
}) {
  final n = now ?? DateTime.now();
  final ranked = List<Order>.from(active)
    ..sort((a, b) {
      final w = _priorityWeight(livePriority(a.targetDate, n))
          .compareTo(_priorityWeight(livePriority(b.targetDate, n)));
      if (w != 0) return w;
      final t = a.targetDate.compareTo(b.targetDate);
      if (t != 0) return t;
      return a.orderId.compareTo(b.orderId);
    });
  var rank = ranked.indexWhere((o) => o.orderId == order.orderId);
  if (rank < 0) rank = 0;
  var unitsAhead = 0;
  for (var i = 0; i < rank && i < ranked.length; i++) {
    final q = ranked[i].quantity;
    unitsAhead += q < 0 ? 0 : q;
  }
  final ownQty = order.quantity < 1 ? 1 : order.quantity;
  final hasHistory = historyUnitsPerDay > 0;
  final rate = hasHistory ? historyUnitsPerDay : fallbackDailyUnits.toDouble();
  var etaDays = ((unitsAhead + ownQty) / rate).ceil();
  if (etaDays < 1) etaDays = 1;
  final today = DateTime(n.year, n.month, n.day);
  final date = today.add(Duration(days: etaDays));
  final qtys = active.map((o) => o.quantity).toList()..sort();
  final median = qtys.isEmpty ? 0 : qtys[qtys.length ~/ 2];
  final basedOn = <String>['backlog'];
  if (hasHistory) basedOn.add('capacity');
  if (qtys.isNotEmpty && ownQty > median) basedOn.add('job_complexity');
  return EtaResult(date: date, basedOn: basedOn);
}
