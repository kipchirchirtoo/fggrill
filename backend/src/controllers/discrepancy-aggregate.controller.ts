import { Request, Response, NextFunction } from 'express';
import { buildDiscrepancyAggregate } from '../services/discrepancy-aggregate.service';

const toInt = (value: any, fallback: number): number => {
  if (value === undefined || value === null) return fallback;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const getDiscrepancyAggregate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const lookbackDays = toInt(req.query.lookback_days, parseInt(process.env.DISCREPANCY_LOOKBACK_DAYS || '90', 10));
    const pendingHours = toInt(req.query.pending_hours, parseInt(process.env.LOGBOOK_FLAG_MIN_PENDING_HOURS || '24', 10));
    const topLimit = toInt(req.query.limit, 30);
    const include = typeof req.query.include === 'string' ? req.query.include.split(',').map((s) => s.trim().toLowerCase()) : [];

    let branchId: number | undefined;
    if (req.query.branch_id) {
      const parsed = parseInt(String(req.query.branch_id), 10);
      if (!Number.isNaN(parsed)) branchId = parsed;
    }

    const payload = await buildDiscrepancyAggregate(req, {
      branchId,
      lookbackDays,
      pendingHours,
      topLimit,
    });

    if (include.length > 0) {
      if (!include.includes('food_control')) delete (payload.data as any).food_control;
      if (!include.includes('inventory')) delete (payload.data as any).inventory_governance;
      if (!include.includes('financial')) delete (payload.data as any).financial_variance;
      if (!include.includes('payroll')) delete (payload.data as any).payroll_anomalies;
    }

    res.status(200).json({ success: true, ...payload });
  } catch (error) {
    next(error);
  }
};
