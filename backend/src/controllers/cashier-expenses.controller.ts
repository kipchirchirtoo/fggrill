import { Request, Response, NextFunction } from 'express';
import * as expenses from '../services/cashier-expenses.service';

// Thin HTTP layer over the shared cashier-expenses service. All scoping,
// active-shift resolution and branch permissions live in the service so the
// generic /cashier/expenses routes and the legacy /kyogong/petty-cash aliases
// behave identically.

export const recordExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await expenses.recordExpense(req);
    res.json({ success: true, message: 'Expense recorded — cash drawer updated', data });
  } catch (err) {
    next(err);
  }
};

export const listExpenses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json({ success: true, data: await expenses.listExpenses(req) });
  } catch (err) {
    next(err);
  }
};

export const getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json({ success: true, data: await expenses.summarizeExpenses(req) });
  } catch (err) {
    next(err);
  }
};

export const getCategories = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json({ success: true, data: expenses.getCategories() });
  } catch (err) {
    next(err);
  }
};

export const getPendingPOs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json({ success: true, data: await expenses.listPendingCashPOs(req) });
  } catch (err) {
    next(err);
  }
};
