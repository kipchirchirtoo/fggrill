/**
 * Layer 3 / Stage 1 — statistical variance anomaly detection.
 *
 * Plain statistics over each item's OWN variance history (rolling mean,
 * standard deviation, z-score, sustained-trend runs, day-of-week baselines
 * once enough history exists). No external ML library, no trained model —
 * Stage 2 (learned classification) is deliberately NOT built here; it needs
 * real human-labeled outcomes from variance_anomaly_flags.status first.
 *
 * Confidence tiers:
 *   < MIN_HISTORY_DAYS (7) of history → NO outlier flags at all (a brand-new
 *     item must never produce a confident-looking anomaly), only an optional
 *     'low_confidence' marker when the day's variance is materially nonzero.
 *   7–13 days  → flags emitted with confidence 'medium'
 *   14+ days   → confidence 'high'
 */

export interface VarianceHistoryPoint {
  date: string; // YYYY-MM-DD
  variance: number;
}

export interface VarianceAnomalyFlag {
  anomaly_type: 'single_day_outlier' | 'sustained_trend' | 'low_confidence';
  z_score: number | null;
  trend_days: number | null;
  current_value: number;
  rolling_mean: number | null;
  rolling_stddev: number | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface AnomalyOptions {
  zThreshold?: number; // default 2 (classic 2-sigma outlier)
  trendMinDays?: number; // default 5 consecutive same-direction days
  rollingWindowDays?: number; // default 30
  dayOfWeekMinWeeks?: number; // default 4 weeks before DOW baselines apply
  minHistoryDays?: number; // default 7
  materialityFloor?: number; // |variance| below this is never low_confidence-flagged
}

const DEFAULTS: Required<AnomalyOptions> = {
  zThreshold: 2,
  trendMinDays: 5,
  rollingWindowDays: 30,
  dayOfWeekMinWeeks: 4,
  minHistoryDays: 7,
  materialityFloor: 0.5,
};

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

const stddev = (xs: number[], mu: number): number => {
  if (xs.length < 2) return 0;
  const variance = xs.reduce((a, b) => a + (b - mu) * (b - mu), 0) / (xs.length - 1);
  return Math.sqrt(variance);
};

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/**
 * Detects anomalies for ONE item given its current day value and its own
 * trailing history (most recent last; must NOT include the current day).
 */
export function detectVarianceAnomalies(
  currentValue: number,
  currentDate: string,
  history: VarianceHistoryPoint[],
  options: AnomalyOptions = {}
): VarianceAnomalyFlag[] {
  const opts = { ...DEFAULTS, ...options };
  const flags: VarianceAnomalyFlag[] = [];

  const sorted = [...history]
    .filter((h) => h.date < currentDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  const window = sorted.slice(-opts.rollingWindowDays);
  const values = window.map((h) => h.variance);

  // ── Too little history: never emit a confident flag ───────────────────────
  if (values.length < opts.minHistoryDays) {
    if (Math.abs(currentValue) >= opts.materialityFloor) {
      flags.push({
        anomaly_type: 'low_confidence',
        z_score: null,
        trend_days: null,
        current_value: round3(currentValue),
        rolling_mean: values.length ? round3(mean(values)) : null,
        rolling_stddev: null,
        confidence: 'low',
      });
    }
    return flags;
  }

  const confidence: 'high' | 'medium' = values.length >= 14 ? 'high' : 'medium';

  // ── Baseline selection: day-of-week aware once enough history exists ──────
  // A "high" Saturday should be judged against Saturdays, not Tuesdays — but
  // only once ≥ dayOfWeekMinWeeks weeks of history AND ≥4 same-DOW samples.
  let baseline = values;
  const totalSpanDays =
    (Date.parse(sorted[sorted.length - 1].date) - Date.parse(sorted[0].date)) / 86_400_000 + 1;
  if (totalSpanDays >= opts.dayOfWeekMinWeeks * 7) {
    const dow = new Date(`${currentDate}T00:00:00Z`).getUTCDay();
    const sameDow = window
      .filter((h) => new Date(`${h.date}T00:00:00Z`).getUTCDay() === dow)
      .map((h) => h.variance);
    if (sameDow.length >= 4) baseline = sameDow;
  }

  const mu = mean(baseline);
  const sigma = stddev(baseline, mu);

  // ── Single-day z-score outlier ─────────────────────────────────────────────
  if (sigma > 1e-9) {
    const z = (currentValue - mu) / sigma;
    if (Math.abs(z) > opts.zThreshold) {
      flags.push({
        anomaly_type: 'single_day_outlier',
        z_score: round3(Math.max(-100, Math.min(100, z))),
        trend_days: null,
        current_value: round3(currentValue),
        rolling_mean: round3(mu),
        rolling_stddev: round3(sigma),
        confidence,
      });
    }
  } else if (Math.abs(currentValue - mu) > Math.max(opts.materialityFloor, Math.abs(mu) * 0.5)) {
    // Perfectly flat history (σ≈0) with a material deviation today — a real
    // break from pattern even though a z-score is undefined.
    flags.push({
      anomaly_type: 'single_day_outlier',
      z_score: null,
      trend_days: null,
      current_value: round3(currentValue),
      rolling_mean: round3(mu),
      rolling_stddev: 0,
      confidence,
    });
  }

  // ── Sustained same-direction trend (slow leakage detector) ────────────────
  // Counts consecutive same-sign days ENDING with the current day. Catches
  // e.g. 5+ straight negative-VAR days on one item even when no single day
  // trips the z-score — the classic signature of a miscalibrated yield ratio.
  const direction = Math.sign(currentValue);
  if (direction !== 0) {
    let run = 1; // current day
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (Math.sign(sorted[i].variance) === direction) run += 1;
      else break;
    }
    if (run >= opts.trendMinDays) {
      flags.push({
        anomaly_type: 'sustained_trend',
        z_score: null,
        trend_days: run,
        current_value: round3(currentValue),
        rolling_mean: round3(mu),
        rolling_stddev: round3(sigma),
        confidence,
      });
    }
  }

  return flags;
}
