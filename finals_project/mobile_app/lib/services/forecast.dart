// PrintFlow Mobile - demand forecasting (pure Dart, no Firebase).
//
// Dart mirror of `web/src/lib/forecast.ts` so both platforms defend the
// same Title 1 objective 8 story: additive Holt-Winters (weekly season)
// on real `rfid_events` checkout history, graceful fallback to single
// exponential smoothing on thin history, and the classic ROP formula:
//
//   ROP = ceil(avgDailyDemand * leadTimeDays + avgDailyDemand * safetyDays)
//
// When a variant has zero checkout events there is nothing to smooth -
// [VariantForecast.hasHistory] is false and callers keep the stored
// planning values on the inventory doc.
import '../models/rfid_event.dart';

/// Model constants shared with the web dashboard.
abstract final class ForecastParams {
  /// Level smoothing.
  static const double alpha = 0.2;

  /// Trend smoothing.
  static const double beta = 0.15;

  /// Seasonal smoothing.
  static const double gamma = 0.05;

  /// Weekly cycle in days.
  static const int seasonLength = 7;

  /// Days of checkout history consumed per variant.
  static const int historyDays = 28;

  /// Expected supplier lead time in days.
  static const int leadTimeDays = 3;

  /// Safety buffer in days of average demand.
  static const int safetyDays = 2;
}

/// Per-variant forecast result.
class VariantForecast {
  /// Mean daily demand over the history window.
  final double dailyAvg;

  /// Predicted demand for the next 7 days (whole units).
  final int forecast7d;

  /// Dynamic reorder point (whole units).
  final int rop;

  /// Which method actually ran.
  final String model; // 'Holt-Winters' | 'Exponential Smoothing'

  /// Days of history consumed.
  final int samples;

  /// False when the variant has zero checkout events.
  final bool hasHistory;

  const VariantForecast({
    required this.dailyAvg,
    required this.forecast7d,
    required this.rop,
    required this.model,
    required this.samples,
    required this.hasHistory,
  });
}

/// Fitted additive Holt-Winters state.
class HoltWintersState {
  final double level;
  final double trend;

  /// Seasonal components, length L, aligned so the last entry is latest.
  final List<double> seasonal;

  const HoltWintersState({
    required this.level,
    required this.trend,
    required this.seasonal,
  });
}

DateTime _startOfDay(DateTime d) => DateTime(d.year, d.month, d.day);

/// Bucket a variant's checkout events into whole-unit counts per day,
/// oldest first. Returns [days] buckets ending today.
List<int> bucketDailyDemand(
  List<RfidCheckoutEvent> events,
  String variantId, {
  int days = ForecastParams.historyDays,
  DateTime? now,
}) {
  final today = _startOfDay(now ?? DateTime.now()).millisecondsSinceEpoch;
  const dayMs = 24 * 60 * 60 * 1000;
  final buckets = List<int>.filled(days, 0);
  for (final e in events) {
    if (e.materialVariantId != variantId) continue;
    final t = e.timestamp.millisecondsSinceEpoch;
    if (t > today + dayMs) continue;
    final idx = ((t - (today - (days - 1) * dayMs)) / dayMs).floor();
    if (idx >= 0 && idx < days) buckets[idx] += 1;
  }
  return buckets;
}

/// Single exponential smoothing level of a series.
double singleExponentialSmoothing(
  List<int> series, [
  double alpha = ForecastParams.alpha,
]) {
  if (series.isEmpty) return 0;
  var level = series.first.toDouble();
  for (var i = 1; i < series.length; i++) {
    level = alpha * series[i] + (1 - alpha) * level;
  }
  return level;
}

/// Additive Holt-Winters fit. Returns null when the series is shorter
/// than two full seasons (callers must fall back to SES).
HoltWintersState? holtWintersAdditive(
  List<int> series, [
  double alpha = ForecastParams.alpha,
  double beta = ForecastParams.beta,
  double gamma = ForecastParams.gamma,
  int seasonLength = ForecastParams.seasonLength,
]) {
  final n = series.length;
  final l = seasonLength;
  if (n < 2 * l) return null;

  double avg(List<int> a) =>
      a.fold<int>(0, (s, v) => s + v) / (a.isEmpty ? 1 : a.length);
  final firstSeason = series.sublist(0, l);
  final secondSeason = series.sublist(l, 2 * l);

  var level = avg(firstSeason);
  var trend = (avg(secondSeason) - avg(firstSeason)) / l;
  // Seasonal init: deviation of each first-season day from the level.
  var seasonal = firstSeason.map((v) => v - level).toList();

  for (var t = 0; t < n; t++) {
    final prevLevel = level;
    final s = seasonal[t % l];
    level = alpha * (series[t] - s) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonal[t % l] = gamma * (series[t] - level) + (1 - gamma) * s;
  }
  return HoltWintersState(level: level, trend: trend, seasonal: seasonal);
}

/// Sum of the next [steps] Holt-Winters forecasts from a fitted state.
double holtWintersForecastSum(
  HoltWintersState state,
  int steps, [
  int seasonLength = ForecastParams.seasonLength,
]) {
  final l = seasonLength;
  var sum = 0.0;
  for (var m = 1; m <= steps; m++) {
    final seasonal =
        state.seasonal[(state.seasonal.length - l + ((m - 1) % l)) % l];
    sum += state.level + m * state.trend + seasonal;
  }
  return sum < 0 ? 0 : sum;
}

/// Classic ROP: expected demand over lead time + safety buffer.
int computeROP(
  double dailyAvg, [
  int leadTimeDays = ForecastParams.leadTimeDays,
  int safetyDays = ForecastParams.safetyDays,
]) {
  if (dailyAvg <= 0) return 0;
  return (dailyAvg * leadTimeDays + dailyAvg * safetyDays).ceil();
}

/// Full per-variant forecast from raw checkout events. Pure - safe to
/// call inside `build`/`useMemo`-style code on every snapshot.
VariantForecast forecastVariantDemand(
  List<RfidCheckoutEvent> events,
  String variantId, {
  DateTime? now,
}) {
  final series = bucketDailyDemand(events, variantId, now: now);
  final total = series.fold<int>(0, (s, v) => s + v);
  if (total <= 0) {
    return VariantForecast(
      dailyAvg: 0,
      forecast7d: 0,
      rop: 0,
      model: 'Exponential Smoothing',
      samples: series.length,
      hasHistory: false,
    );
  }
  final dailyAvg = total / series.length;
  final hw = holtWintersAdditive(series);
  if (hw != null) {
    return VariantForecast(
      dailyAvg: dailyAvg,
      forecast7d: holtWintersForecastSum(hw, 7).round(),
      rop: computeROP(dailyAvg),
      model: 'Holt-Winters',
      samples: series.length,
      hasHistory: true,
    );
  }
  final level = singleExponentialSmoothing(series);
  return VariantForecast(
    dailyAvg: dailyAvg,
    forecast7d: (level * 7).round(),
    rop: computeROP(dailyAvg),
    model: 'Exponential Smoothing',
    samples: series.length,
    hasHistory: true,
  );
}
