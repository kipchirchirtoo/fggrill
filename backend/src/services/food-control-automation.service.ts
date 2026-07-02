import db from '../db';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import notificationService from './notification.service';
import {
  DailyFoodControlReport,
  generateDailyFoodControlReport,
  generateReportSummary,
} from './food-control-report.service';
import {
  detectVarianceAnomalies,
  VarianceAnomalyFlag,
  VarianceHistoryPoint,
} from './variance-anomaly.service';

/**
 * Automated Daily Food Control Engine — Layer 1 (trigger/pipeline) + Layer 3
 * Stage 1 (statistical anomaly pass).
 *
 * Event path: fired (fire-and-forget) from the SAME lifecycle moment the
 * system already uses to finalize a commercial day — right after
 * snapshotPreviousClosedCommercialDay in startShift/approveShiftOpening
 * (cashier-shifts.controller). No competing "day closed" definition is
 * introduced: a day is final when the next cashier shift opens, exactly as
 * daily_control_snapshots already treats it.
 *
 * Fallback path: nightly cron at 02:00 Africa/Nairobi sweeps for closed but
 * unprocessed branch/days (see scheduler.service) and logs a warning when it
 * catches one — that means the event path missed it and has a bug.
 *
 * Credentials: reuses the existing shared supabase client and db pool —
 * no separate connection path, no new env vars (Layer 2 requirement).
 *
 * Idempotency: food_control_processing_runs is UNIQUE(branch_id,
 * control_date) and all writes are delete-then-insert or upsert, so
 * re-processing a branch/day is safe.
 */

export type TriggerSource = 'event' | 'fallback' | 'manual';

export interface ProcessDayResult {
  branch_id: number;
  date: string;
  skipped: boolean;
  status: 'success' | 'failed' | 'already_processed';
  anomalies_found: number;
  shorts_value: number | null;
  duration_ms: number;
  error?: string;
}

const num = (v: any): number => (typeof v === 'number' ? v : Number(v) || 0);

async function q(sql: string, params: any[]): Promise<any[]> {
  try {
    const { rows } = await db.query(sql, params);
    return rows || [];
  } catch (err) {
    if (/timed out/i.test((err as Error).message)) {
      const { rows } = await db.query(sql, params);
      return rows || [];
    }
    throw err;
  }
}

/** Trailing per-item variance history for the anomaly pass (one query). */
async function loadVarianceHistories(
  branchId: number,
  date: string
): Promise<Map<string, VarianceHistoryPoint[]>> {
  const rows = await q(
    `SELECT item_sku, variance_date::text AS date, COALESCE(variance_qty, 0) AS variance
       FROM food_control_variance
      WHERE branch_id = $1
        AND variance_date >= ($2::date - INTERVAL '45 days')
        AND variance_date < $2::date
      ORDER BY item_sku, variance_date`,
    [branchId, date]
  );
  const map = new Map<string, VarianceHistoryPoint[]>();
  for (const r of rows) {
    const list = map.get(r.item_sku) || [];
    list.push({ date: r.date, variance: num(r.variance) });
    map.set(r.item_sku, list);
  }
  return map;
}

async function loadTrailingShorts(
  branchId: number,
  date: string
): Promise<Array<{ variance_date: string; total_shorts_value: number }>> {
  const rows = await q(
    `SELECT variance_date::text, COALESCE(SUM(variance_value), 0) AS total
       FROM food_control_variance
      WHERE branch_id = $1
        AND variance_date >= ($2::date - INTERVAL '7 days')
        AND variance_date < $2::date
      GROUP BY variance_date ORDER BY variance_date`,
    [branchId, date]
  ).catch(() => []);
  return rows.map((r: any) => ({
    variance_date: r.variance_date,
    total_shorts_value: num(r.total),
  }));
}

interface PersistedAnomaly extends VarianceAnomalyFlag {
  item_ref: string;
  item_name: string;
}

async function persistAnomalyFlags(
  branchId: number,
  date: string,
  anomalies: PersistedAnomaly[]
): Promise<void> {
  // Idempotent per day: only replace flags still awaiting investigation, so a
  // reprocess never wipes a human-labeled outcome (that's Stage-2 training data).
  const { error: delErr } = await supabase
    .from('variance_anomaly_flags')
    .delete()
    .eq('branch_id', branchId)
    .eq('date', date)
    .eq('status', 'new');
  if (delErr) throw new Error(`anomaly flag cleanup failed: ${delErr.message}`);

  if (!anomalies.length) return;
  const { error } = await supabase.from('variance_anomaly_flags').upsert(
    anomalies.map((a) => ({
      branch_id: branchId,
      item_ref: a.item_ref,
      item_name: a.item_name,
      date,
      anomaly_type: a.anomaly_type,
      z_score: a.z_score,
      trend_days: a.trend_days,
      current_value: a.current_value,
      rolling_mean: a.rolling_mean,
      rolling_stddev: a.rolling_stddev,
      confidence: a.confidence,
      status: 'new',
    })),
    { onConflict: 'branch_id,date,item_ref,anomaly_type', ignoreDuplicates: true }
  );
  if (error) throw new Error(`anomaly flag insert failed: ${error.message}`);
}

async function loadNotificationThreshold(branchId: number): Promise<number> {
  const { data } = await supabase
    .from('branch_food_control_config')
    .select('variance_threshold, enable_food_control')
    .eq('branch_id', branchId)
    .maybeSingle();
  if (data && data.enable_food_control === false) return Number.POSITIVE_INFINITY;
  const threshold = num(data?.variance_threshold);
  return threshold > 0 ? threshold : 5000; // KES default
}

async function notifyCriticalFindings(
  branchId: number,
  date: string,
  report: DailyFoodControlReport,
  anomalies: PersistedAnomaly[]
): Promise<void> {
  const threshold = await loadNotificationThreshold(branchId);
  const totalShorts = report.totals.controls_shorts_value;
  const highAnomalies = anomalies.filter(
    (a) => a.confidence === 'high' && a.anomaly_type !== 'low_confidence'
  );

  const bigLoss = totalShorts <= -threshold;
  if (!bigLoss && highAnomalies.length === 0) return;

  const parts: string[] = [];
  if (bigLoss) parts.push(`Shorts.v for ${date} is KES ${totalShorts.toFixed(0)} (threshold ${threshold}).`);
  if (highAnomalies.length) {
    const top = highAnomalies
      .slice(0, 3)
      .map((a) =>
        a.anomaly_type === 'sustained_trend'
          ? `${a.item_name}: ${a.trend_days} straight days of same-direction variance`
          : `${a.item_name}: ${a.z_score}σ outside its normal range`
      )
      .join('; ');
    parts.push(`${highAnomalies.length} statistical anomal${highAnomalies.length === 1 ? 'y' : 'ies'}: ${top}.`);
  }
  const message = `Daily food control for ${date}: ${parts.join(' ')} Open the Food Control report to review.`;

  // Same delivery mechanism used elsewhere (e.g. void approvals) — in-app
  // notifications per role, branch-scoped.
  for (const role of ['branch_accountant', 'branch_storekeeper']) {
    await notificationService.notifyRole(role, 'Food Control alert', message, {
      type: 'warning',
      category: 'food_control',
      priority: bigLoss ? 'urgent' : 'high',
      branchId,
      actionUrl: '/branch-accountant/daily-controls-lina',
      metadata: { date, shorts_value: totalShorts, anomalies: highAnomalies.length },
    });
  }
}

async function recordRun(run: {
  branch_id: number;
  control_date: string;
  status: 'success' | 'failed';
  trigger_source: TriggerSource;
  duration_ms: number;
  anomalies_found: number;
  shorts_value: number | null;
  error?: string | null;
  ai_summary?: any;
}): Promise<void> {
  const { error } = await supabase.from('food_control_processing_runs').upsert(
    {
      ...run,
      error: run.error || null,
      ai_summary: run.ai_summary ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'branch_id,control_date' }
  );
  if (error) {
    logger.error('food-control-automation: failed to record run', {
      branch_id: run.branch_id,
      control_date: run.control_date,
      error: error.message,
    });
  }
}

/**
 * Pipeline steps (a)–(e) for one branch/commercial-day. Idempotent: safe to
 * call repeatedly; skips days already successfully processed unless forced.
 */
export async function processFoodControlDay(
  branchId: number,
  date: string,
  triggerSource: TriggerSource = 'manual',
  { force = false }: { force?: boolean } = {}
): Promise<ProcessDayResult> {
  const startedAt = Date.now();

  if (!force) {
    const { data: existing } = await supabase
      .from('food_control_processing_runs')
      .select('id, status')
      .eq('branch_id', branchId)
      .eq('control_date', date)
      .eq('status', 'success')
      .maybeSingle();
    if (existing) {
      return {
        branch_id: branchId,
        date,
        skipped: true,
        status: 'already_processed',
        anomalies_found: 0,
        shorts_value: null,
        duration_ms: Date.now() - startedAt,
      };
    }
  }

  logger.info('food-control-automation: processing day', {
    branch_id: branchId,
    control_date: date,
    trigger_source: triggerSource,
  });

  try {
    // (a)+(b) Deterministic variance + report. The report persists the day's
    // results into food_control_variance (delete+insert — idempotent). The
    // daily_control_snapshots row is owned by the existing
    // snapshotPreviousClosedCommercialDay job and NOT duplicated here.
    const report = await generateDailyFoodControlReport(branchId, date, {
      withAiSummary: false,
    });

    // (d) Stage-1 statistical anomaly pass against each item's own history.
    const histories = await loadVarianceHistories(branchId, date);
    const anomalies: PersistedAnomaly[] = [];
    for (const row of report.right_panel) {
      const ref = row.item_sku || row.item_name;
      const flags = detectVarianceAnomalies(row.variance, date, histories.get(ref) || []);
      for (const flag of flags) {
        anomalies.push({ ...flag, item_ref: ref, item_name: row.item_name });
      }
    }
    await persistAnomalyFlags(branchId, date, anomalies);

    // AI interpretation, now with the statistical context ("2.3σ beyond
    // normal", "6th straight negative day") — optional, degrades to null.
    const trailing = await loadTrailingShorts(branchId, date);
    const aiSummary = await generateReportSummary(report, trailing, anomalies.map((a) => ({
      item: a.item_name,
      anomaly_type: a.anomaly_type,
      z_score: a.z_score,
      trend_days: a.trend_days,
      confidence: a.confidence,
    })));

    // (e) Alerts for critical findings via the existing notification service.
    try {
      await notifyCriticalFindings(branchId, date, report, anomalies);
    } catch (err) {
      logger.warn('food-control-automation: notification step failed (non-fatal)', {
        branch_id: branchId,
        error: (err as Error).message,
      });
    }

    const result: ProcessDayResult = {
      branch_id: branchId,
      date,
      skipped: false,
      status: 'success',
      anomalies_found: anomalies.length,
      shorts_value: report.totals.controls_shorts_value,
      duration_ms: Date.now() - startedAt,
    };
    await recordRun({
      branch_id: branchId,
      control_date: date,
      status: 'success',
      trigger_source: triggerSource,
      duration_ms: result.duration_ms,
      anomalies_found: anomalies.length,
      shorts_value: report.totals.controls_shorts_value,
      ai_summary: aiSummary,
    });
    logger.info('food-control-automation: day processed', { ...result });
    return result;
  } catch (err) {
    const message = (err as Error).message;
    await recordRun({
      branch_id: branchId,
      control_date: date,
      status: 'failed',
      trigger_source: triggerSource,
      duration_ms: Date.now() - startedAt,
      anomalies_found: 0,
      shorts_value: null,
      error: message,
    });
    logger.error('food-control-automation: day processing failed', {
      branch_id: branchId,
      control_date: date,
      error: message,
    });
    return {
      branch_id: branchId,
      date,
      skipped: false,
      status: 'failed',
      anomalies_found: 0,
      shorts_value: null,
      duration_ms: Date.now() - startedAt,
      error: message,
    };
  }
}

/**
 * Finds closed-but-unprocessed branch/days (same commercial-day resolution as
 * snapshotPreviousClosedCommercialDay: the UTC date of the closed cashier
 * shift's shift_start) and runs the pipeline for each. Used by both the
 * event hook (scoped to one branch) and the nightly fallback (all branches).
 */
export async function processFoodControlForClosedDays(
  { branchId, triggerSource = 'manual' }: { branchId?: number; triggerSource?: TriggerSource } = {}
): Promise<ProcessDayResult[]> {
  const nairobiToday = new Date(Date.now() + 3 * 3_600_000).toISOString().split('T')[0];
  const pending = await q(
    `SELECT DISTINCT csl.branch_id, csl.shift_start::date::text AS control_date
       FROM cashier_shift_logs csl
      WHERE csl.status = 'closed'
        AND csl.shift_start >= NOW() - INTERVAL '7 days'
        AND csl.shift_start::date < $1::date
        AND ($2::int IS NULL OR csl.branch_id = $2::int)
        AND NOT EXISTS (
              SELECT 1 FROM food_control_processing_runs r
               WHERE r.branch_id = csl.branch_id
                 AND r.control_date = csl.shift_start::date
                 AND r.status = 'success'
            )
      ORDER BY csl.branch_id, control_date`,
    [nairobiToday, branchId ?? null]
  );

  if (!pending.length) return [];

  if (triggerSource === 'fallback') {
    // The nightly sweep should normally find nothing — anything here was
    // missed by the event-driven path and indicates a bug worth chasing.
    logger.warn('food-control-automation: fallback caught unprocessed days missed by event path', {
      count: pending.length,
      days: pending.map((p: any) => `${p.branch_id}:${p.control_date}`),
    });
  }

  const results: ProcessDayResult[] = [];
  for (const p of pending) {
    // Sequential on purpose: keeps DB pool pressure low and branches isolated.
    results.push(await processFoodControlDay(p.branch_id, p.control_date, triggerSource));
  }
  return results;
}

/** Monitoring payload: last run per branch, failures, unresolved anomalies. */
export async function getFoodControlRunsOverview(): Promise<{
  branches: any[];
  generated_at: string;
}> {
  const [runs, anomalies] = await Promise.all([
    q(
      `SELECT DISTINCT ON (r.branch_id)
              r.branch_id, b.name AS branch_name, r.control_date::text,
              r.status, r.trigger_source, r.duration_ms, r.anomalies_found,
              r.shorts_value, r.error, r.updated_at
         FROM food_control_processing_runs r
         JOIN branches b ON b.id = r.branch_id
        ORDER BY r.branch_id, r.control_date DESC`,
      []
    ),
    q(
      `SELECT branch_id,
              COUNT(*) FILTER (WHERE status = 'new')::int AS unresolved_flags,
              COUNT(*) FILTER (WHERE status = 'new' AND confidence = 'high')::int AS unresolved_high
         FROM variance_anomaly_flags
        GROUP BY branch_id`,
      []
    ),
  ]);
  const failed = await q(
    `SELECT branch_id, control_date::text, error, updated_at
       FROM food_control_processing_runs
      WHERE status = 'failed'
        AND NOT EXISTS (
              SELECT 1 FROM food_control_processing_runs ok
               WHERE ok.branch_id = food_control_processing_runs.branch_id
                 AND ok.control_date = food_control_processing_runs.control_date
                 AND ok.status = 'success')
      ORDER BY control_date DESC LIMIT 50`,
    []
  );

  const anomalyByBranch = new Map<number, any>(anomalies.map((a: any) => [a.branch_id, a]));
  return {
    branches: runs.map((r: any) => ({
      ...r,
      unresolved_flags: anomalyByBranch.get(r.branch_id)?.unresolved_flags ?? 0,
      unresolved_high: anomalyByBranch.get(r.branch_id)?.unresolved_high ?? 0,
      needs_attention: failed.filter((f: any) => f.branch_id === r.branch_id),
    })),
    generated_at: new Date().toISOString(),
  };
}
