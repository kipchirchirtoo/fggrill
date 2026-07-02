import {
  detectVarianceAnomalies,
  VarianceHistoryPoint,
} from '../services/variance-anomaly.service';

const day = (offset: number): string => {
  const d = new Date(Date.UTC(2026, 5, 1)); // 2026-06-01 base
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().split('T')[0];
};

/** n days of history ending the day before `current` (offset n-1). */
const makeHistory = (values: number[]): VarianceHistoryPoint[] =>
  values.map((variance, i) => ({ date: day(i), variance }));

describe('detectVarianceAnomalies — Stage 1 statistics', () => {
  it('flags a clear injected outlier after 20 normal days with an appropriate z-score', () => {
    // 20 days of mild noise around −0.5, then a big spike day.
    const history = makeHistory([
      -0.4, -0.6, -0.5, -0.3, -0.7, -0.5, -0.4, -0.6, -0.5, -0.5,
      -0.4, -0.6, -0.3, -0.7, -0.5, -0.4, -0.6, -0.5, -0.5, -0.4,
    ]);
    const flags = detectVarianceAnomalies(-8, day(20), history);
    const outlier = flags.find((f) => f.anomaly_type === 'single_day_outlier');
    expect(outlier).toBeDefined();
    expect(Math.abs(outlier!.z_score!)).toBeGreaterThan(2);
    expect(outlier!.confidence).toBe('high'); // 20 days ⇒ high confidence
    expect(outlier!.rolling_mean).toBeCloseTo(-0.5, 1);
  });

  it('does NOT produce a confident anomaly flag on a brand-new item (2-3 days history)', () => {
    const history = makeHistory([-0.5, -0.6]);
    const flags = detectVarianceAnomalies(-9, day(2), history);
    expect(flags.some((f) => f.anomaly_type === 'single_day_outlier')).toBe(false);
    expect(flags.some((f) => f.anomaly_type === 'sustained_trend')).toBe(false);
    // At most a low-confidence marker — never a confident flag.
    for (const f of flags) {
      expect(f.anomaly_type).toBe('low_confidence');
      expect(f.confidence).toBe('low');
    }
  });

  it('stays silent for an immaterial value with no history', () => {
    expect(detectVarianceAnomalies(-0.1, day(0), [])).toHaveLength(0);
  });

  it('detects a sustained same-direction trend even when no single day is an outlier', () => {
    // Mixed history, then 5 consecutive mildly-negative days ending today —
    // classic slow leakage / miscalibrated yield ratio signature.
    const history = makeHistory([
      0.4, -0.3, 0.5, -0.2, 0.3, -0.4, 0.2, 0.6, -0.5, 0.3,
      -0.6, -0.5, -0.4, -0.6, // 4 consecutive negatives before today
    ]);
    const flags = detectVarianceAnomalies(-0.5, day(14), history);
    const trend = flags.find((f) => f.anomaly_type === 'sustained_trend');
    expect(trend).toBeDefined();
    expect(trend!.trend_days).toBe(5);
  });

  it('does not report a trend below the 5-day minimum', () => {
    const history = makeHistory([0.4, 0.3, 0.5, 0.2, 0.4, 0.3, 0.5, -0.4, -0.5, -0.6]);
    const flags = detectVarianceAnomalies(-0.5, day(10), history); // 4th consecutive negative
    expect(flags.some((f) => f.anomaly_type === 'sustained_trend')).toBe(false);
  });

  it('uses medium confidence between 7 and 13 days of history', () => {
    const history = makeHistory([-0.5, -0.4, -0.6, -0.5, -0.4, -0.6, -0.5, -0.4]);
    const flags = detectVarianceAnomalies(-7, day(8), history);
    const outlier = flags.find((f) => f.anomaly_type === 'single_day_outlier');
    expect(outlier).toBeDefined();
    expect(outlier!.confidence).toBe('medium');
  });

  it('applies day-of-week baselines once 4+ weeks of history exist', () => {
    // 42 days: Saturdays run at −6, all other days at −1. A −6 Saturday must
    // NOT be flagged (normal for Saturdays) even though it is a global outlier.
    const history: VarianceHistoryPoint[] = [];
    for (let i = 0; i < 42; i++) {
      const date = day(i);
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
      history.push({ date, variance: dow === 6 ? -6 + (i % 3) * 0.1 : -1 + (i % 3) * 0.1 });
    }
    const current = day(42 + 5); // find the next Saturday from base
    const currentDow = new Date(`${current}T00:00:00Z`).getUTCDay();
    // day(0)=2026-06-01 is a Monday, so day(47)=2026-07-18 — verify Saturday.
    expect(currentDow).toBe(6);
    const flags = detectVarianceAnomalies(-6, current, history);
    expect(flags.some((f) => f.anomaly_type === 'single_day_outlier')).toBe(false);
  });
});
