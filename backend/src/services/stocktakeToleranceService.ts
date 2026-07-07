import { supabase } from '../config/supabase';

export interface VarianceEvaluation {
  variance: number;
  variancePercentage: number;
  severity: 'NORMAL' | 'LARGE' | 'EXTREME';
}

export async function evaluateVariance(
  branchId: number,
  expectedQty: number,
  actualQty: number
): Promise<VarianceEvaluation> {
  const variance = actualQty - expectedQty;
  const absVariance = Math.abs(variance);
  let variancePercentage = 0;
  
  if (expectedQty > 0) {
    variancePercentage = (absVariance / expectedQty) * 100;
  } else if (absVariance > 0) {
    variancePercentage = 100; // 100% variance if expected was 0
  }

  // Fetch thresholds from branch_settings
  let largePct = 3.0; // default 3%
  let extremePct = 10.0; // default 10%

  const { data: settings } = await supabase
    .from('branch_settings')
    .select('stocktake_variance_large_pct, stocktake_variance_extreme_pct')
    .eq('branch_id', branchId)
    .maybeSingle();

  if (settings) {
    if (settings.stocktake_variance_large_pct !== undefined && settings.stocktake_variance_large_pct !== null) {
      largePct = Number(settings.stocktake_variance_large_pct);
    }
    if (settings.stocktake_variance_extreme_pct !== undefined && settings.stocktake_variance_extreme_pct !== null) {
      extremePct = Number(settings.stocktake_variance_extreme_pct);
    }
  }

  // Enforce validation rule: large < extreme
  if (largePct >= extremePct) {
    largePct = extremePct * 0.3; // fallback to safe fraction if misconfigured
  }

  let severity: 'NORMAL' | 'LARGE' | 'EXTREME' = 'NORMAL';

  if (expectedQty >= 1.0) {
    if (variancePercentage >= extremePct) {
      severity = 'EXTREME';
    } else if (variancePercentage >= largePct) {
      severity = 'LARGE';
    }
  } else {
    // Near-zero expected quantity fallback
    if (absVariance >= 1.0) {
      severity = 'EXTREME';
    } else if (absVariance >= 0.1) {
      severity = 'LARGE';
    }
  }

  return {
    variance,
    variancePercentage,
    severity
  };
}
