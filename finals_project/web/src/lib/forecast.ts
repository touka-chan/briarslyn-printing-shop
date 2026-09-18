/**
 * Demand forecasting - pure functions implementing the Title 1
 * objective 8 model (predictive ROP + time-series demand forecast).
 *
 * Method (additive Holt-Winters, weekly seasonality):
 *   - Daily checkout history per material variant is bucketed from the
 *     `rfid_events` collection (one tap = one whole unit, per scope).
 *   - When a variant has >= 2 full seasons (>= 2 * L daily samples) the
 *     additive Holt-Winters model runs and `model` is "Holt-Winters".
 *   - With thinner history the model degrades gracefully to single
 *     exponential smoothing and `model` is "Exponential Smoothing".
 *   - With zero checkout history there is nothing to smooth:
 *     `hasHistory` is false and callers fall back to the stored planning
 *     values on the inventory doc (written by seed / manual planning).
 *
 * ROP (classic reorder-point formula, documented constants):
 *   ROP = ceil(avgDailyDemand * leadTimeDays + avgDailyDemand * safetyDays)
 * i.e. expected demand over supplier lead time plus a safety buffer.
 */
import type { RfidCheckoutEvent } from "@/types";

export const FORECAST_PARAMS = {
  /** Level smoothing. */
  alpha: 0.2,
  /** Trend smoothing. */
  beta: 0.15,
  /** Seasonal smoothing. */
  gamma: 0.05,
  /** Weekly cycle in days. */
  seasonLength: 7,
  /** Days of checkout history consumed per variant. */
  historyDays: 28,
  /** Expected supplier lead time in days. */
  leadTimeDays: 3,
  /** Safety buffer in days of average demand. */
  safetyDays: 2,
} as const;

export type ForecastModel = "Holt-Winters" | "Exponential Smoothing";

export interface VariantForecast {
  /** Mean daily demand over the history window. */
  dailyAvg: number;
  /** Predicted demand for the next 7 days (whole units). */
  forecast7d: number;
  /** Dynamic reorder point (whole units). */
  rop: number;
  /** Which method actually ran. */
  model: ForecastModel;
  /** Days of history consumed. */
  samples: number;
  /** False when the variant has zero checkout events. */
  hasHistory: boolean;
}

/** Start-of-day (local) for day bucketing. */
function startOfDay(d: Date): number {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

/**
 * Bucket a variant's checkout events into whole-unit counts per day,
 * oldest first. Returns `days` buckets ending today.
 */
export function bucketDailyDemand(
  events: RfidCheckoutEvent[],
  variantId: string,
  days: number = FORECAST_PARAMS.historyDays,
  now: Date = new Date(),
): number[] {
  const today = startOfDay(now);
  const dayMs = 24 * 60 * 60 * 1000;
  const buckets = new Array<number>(days).fill(0);
  for (const e of events) {
    if (e.material_variant_id !== variantId) continue;
    const t = new Date(e.timestamp).getTime();
    if (Number.isNaN(t) || t > today + dayMs) continue;
    const idx = Math.floor((t - (today - (days - 1) * dayMs)) / dayMs);
    if (idx >= 0 && idx < days) buckets[idx] += 1;
  }
  return buckets;
}

/** Single exponential smoothing level of a series. */
export function singleExponentialSmoothing(
  series: number[],
  alpha: number = FORECAST_PARAMS.alpha,
): number {
  if (series.length === 0) return 0;
  let level = series[0];
  for (let i = 1; i < series.length; i++) {
    level = alpha * series[i] + (1 - alpha) * level;
  }
  return level;
}

export interface HoltWintersState {
  level: number;
  trend: number;
  /** Seasonal components, length L, aligned so seasonal[n-1] is latest. */
  seasonal: number[];
}

/**
 * Additive Holt-Winters fit. Returns null when the series is shorter
 * than two full seasons (callers must fall back to SES).
 */
export function holtWintersAdditive(
  series: number[],
  alpha: number = FORECAST_PARAMS.alpha,
  beta: number = FORECAST_PARAMS.beta,
  gamma: number = FORECAST_PARAMS.gamma,
  seasonLength: number = FORECAST_PARAMS.seasonLength,
): HoltWintersState | null {
  const n = series.length;
  const L = seasonLength;
  if (n < 2 * L) return null;

  const avg = (a: number[]) =>
    a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  const firstSeason = series.slice(0, L);
  const secondSeason = series.slice(L, 2 * L);

  let level = avg(firstSeason);
  let trend = (avg(secondSeason) - avg(firstSeason)) / L;
  // Seasonal init: deviation of each first-season day from the level.
  const seasonal = firstSeason.map((v) => v - level);

  for (let t = 0; t < n; t++) {
    const prevLevel = level;
    const s = seasonal[t % L];
    level = alpha * (series[t] - s) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonal[t % L] = gamma * (series[t] - level) + (1 - gamma) * s;
  }
  return { level, trend, seasonal };
}

/** Sum of the next `steps` Holt-Winters forecasts from a fitted state. */
export function holtWintersForecastSum(
  state: HoltWintersState,
  steps: number,
  seasonLength: number = FORECAST_PARAMS.seasonLength,
): number {
  const L = seasonLength;
  let sum = 0;
  for (let m = 1; m <= steps; m++) {
    const seasonal = state.seasonal[(state.seasonal.length - L + ((m - 1) % L)) % L];
    sum += state.level + m * state.trend + seasonal;
  }
  return Math.max(0, sum);
}

/** Classic ROP: expected demand over lead time + safety buffer. */
export function computeROP(
  dailyAvg: number,
  leadTimeDays: number = FORECAST_PARAMS.leadTimeDays,
  safetyDays: number = FORECAST_PARAMS.safetyDays,
): number {
  if (dailyAvg <= 0) return 0;
  return Math.ceil(dailyAvg * leadTimeDays + dailyAvg * safetyDays);
}

/**
 * Full per-variant forecast from raw checkout events. Pure - safe to
 * call inside `useMemo` on every snapshot.
 */
export function forecastVariantDemand(
  events: RfidCheckoutEvent[],
  variantId: string,
  now: Date = new Date(),
): VariantForecast {
  const series = bucketDailyDemand(events, variantId, FORECAST_PARAMS.historyDays, now);
  const total = series.reduce((s, v) => s + v, 0);
  if (total <= 0) {
    return { dailyAvg: 0, forecast7d: 0, rop: 0, model: "Exponential Smoothing", samples: series.length, hasHistory: false };
  }
  const dailyAvg = total / series.length;
  const hw = holtWintersAdditive(series);
  if (hw) {
    const forecast7d = Math.round(holtWintersForecastSum(hw, 7));
    return {
      dailyAvg,
      forecast7d,
      rop: computeROP(dailyAvg),
      model: "Holt-Winters",
      samples: series.length,
      hasHistory: true,
    };
  }
  const level = singleExponentialSmoothing(series);
  return {
    dailyAvg,
    forecast7d: Math.round(level * 7),
    rop: computeROP(dailyAvg),
    model: "Exponential Smoothing",
    samples: series.length,
    hasHistory: true,
  };
}
