import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { generateDailyFoodControlReport } from '../services/food-control-report.service';
import {
  exportReportPdf,
  exportReportXlsx,
} from '../services/food-control-report-export.service';

/**
 * Daily Food Control Report (Store Stocksheet + Controls).
 *
 * GET /api/branches/:branchId/food-control-report?date=YYYY-MM-DD
 * GET /api/branches/:branchId/food-control-report/export?date=YYYY-MM-DD&format=xlsx|pdf
 */

function parseParams(req: Request, res: Response): { branchId: number; date: string } | null {
  const branchId = Number(req.params.branchId);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    res.status(400).json({ success: false, message: 'Invalid branch id' });
    return null;
  }
  const user: any = (req as any).user;
  const branchScopedRoles = [
    'branch_manager', 'branch_accountant', 'branch_operations_manager',
    'branch_storekeeper',
  ];
  if (user && branchScopedRoles.includes(user.role) && user.branch_id != null
      && Number(user.branch_id) !== branchId) {
    res.status(403).json({ success: false, message: 'You can only view your own branch' });
    return null;
  }
  const nairobiToday = new Date(Date.now() + 3 * 3_600_000).toISOString().split('T')[0];
  const date = /^\d{4}-\d{2}-\d{2}$/.test(`${req.query.date}`) ? `${req.query.date}` : nairobiToday;
  return { branchId, date };
}

export const getFoodControlReport = async (req: Request, res: Response): Promise<void> => {
  const params = parseParams(req, res);
  if (!params) return;
  try {
    const report = await generateDailyFoodControlReport(params.branchId, params.date);
    res.status(200).json({ success: true, data: report });
  } catch (err) {
    logger.error('food-control-report failed', {
      ...params,
      error: (err as Error).message,
    });
    res.status(500).json({ success: false, message: 'Report generation failed. Please try again.' });
  }
};

export const exportFoodControlReport = async (req: Request, res: Response): Promise<void> => {
  const params = parseParams(req, res);
  if (!params) return;
  const format = `${req.query.format || 'xlsx'}`.toLowerCase();
  if (!['xlsx', 'pdf'].includes(format)) {
    res.status(400).json({ success: false, message: 'format must be xlsx or pdf' });
    return;
  }
  try {
    // Exports are the deterministic record — skip the AI summary call unless
    // it is already free (the report function degrades gracefully anyway).
    const report = await generateDailyFoodControlReport(params.branchId, params.date, {
      withAiSummary: format === 'pdf',
    });
    const filename = `food_control_${params.branchId}_${params.date}.${format}`;
    if (format === 'xlsx') {
      const buffer = await exportReportXlsx(report);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } else {
      const buffer = await exportReportPdf(report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    }
  } catch (err) {
    logger.error('food-control-report export failed', {
      ...params,
      format,
      error: (err as Error).message,
    });
    res.status(500).json({ success: false, message: 'Export failed. Please try again.' });
  }
};
