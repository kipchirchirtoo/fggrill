import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  return fallback;
};

const compact = (data: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));

const codeFromName = (name: string): string =>
  name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20)
  || `MP_${Date.now().toString().slice(-6)}`;

const branchIdOrNull = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '' || value === 'null') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// row (snake_case) -> API shape (camelCase)
const normalizeMealPlan = (row: any): Record<string, unknown> => ({
  id: String(row.id),
  branchId: row.branch_id ?? null,
  code: row.code,
  name: row.name,
  description: row.description || '',
  includesBreakfast: !!row.includes_breakfast,
  includesLunch: !!row.includes_lunch,
  includesDinner: !!row.includes_dinner,
  includesSnacks: !!row.includes_snacks,
  includesDrinks: !!row.includes_drinks,
  adultDailyPrice: toNumber(row.adult_daily_price, 0),
  childDailyPrice: toNumber(row.child_daily_price, 0),
  infantDailyPrice: toNumber(row.infant_daily_price, 0),
  includedInRoomRate: row.included_in_room_rate !== false,
  isDefault: !!row.is_default,
  isActive: row.is_active !== false,
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
});

// API body (accepts camelCase or snake_case) -> row (snake_case)
const mealPlanPayload = (body: any): Record<string, unknown> => {
  const name = String(body.name ?? '').trim();
  const code = String(body.code || codeFromName(name)).trim().toUpperCase();
  return compact({
    branch_id: branchIdOrNull(body.branchId ?? body.branch_id),
    code,
    name,
    description: body.description ?? null,
    includes_breakfast: toBool(body.includesBreakfast ?? body.includes_breakfast, false),
    includes_lunch: toBool(body.includesLunch ?? body.includes_lunch, false),
    includes_dinner: toBool(body.includesDinner ?? body.includes_dinner, false),
    includes_snacks: toBool(body.includesSnacks ?? body.includes_snacks, false),
    includes_drinks: toBool(body.includesDrinks ?? body.includes_drinks, false),
    adult_daily_price: Math.max(0, toNumber(body.adultDailyPrice ?? body.adult_daily_price, 0)),
    child_daily_price: Math.max(0, toNumber(body.childDailyPrice ?? body.child_daily_price, 0)),
    infant_daily_price: Math.max(0, toNumber(body.infantDailyPrice ?? body.infant_daily_price, 0)),
    included_in_room_rate: toBool(body.includedInRoomRate ?? body.included_in_room_rate, true),
    is_default: toBool(body.isDefault ?? body.is_default, false),
    is_active: toBool(body.isActive ?? body.is_active, true),
  });
};

const isDuplicateCode = (error: any): boolean =>
  error?.code === '23505' || /duplicate key|unique/i.test(error?.message || '');

// @route GET /api/meal-plans?branch_id=&include_inactive=
export const getMealPlans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branchId = branchIdOrNull(req.query.branch_id ?? req.query.branchId);
    const includeInactive = ['true', '1'].includes(String(req.query.include_inactive || '').toLowerCase());

    let query = supabase.from('meal_plans').select('*').order('name', { ascending: true });
    // Branch scope: global (NULL) plans + this branch's own plans.
    if (branchId !== null) query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
    if (!includeInactive) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({
      success: true,
      count: (data || []).length,
      data: (data || []).map(normalizeMealPlan),
    });
  } catch (error) {
    logger.error('Failed to fetch meal plans:', error);
    next(new AppError('Failed to fetch meal plans', 500));
  }
};

// @route GET /api/meal-plans/:id
export const getMealPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabase.from('meal_plans').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!data) throw new AppError('Meal plan not found', 404);
    res.status(200).json({ success: true, data: normalizeMealPlan(data) });
  } catch (error) {
    next(error);
  }
};

// @route POST /api/meal-plans
export const createMealPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = mealPlanPayload(req.body);
    if (!payload.name) throw new AppError('Meal plan name is required', 400);
    if (!payload.code) throw new AppError('Meal plan code is required', 400);

    const { data, error } = await supabase
      .from('meal_plans')
      .insert(compact({ ...payload, created_by: req.user?.id ?? null, updated_by: req.user?.id ?? null }))
      .select('*')
      .single();

    if (error) {
      if (isDuplicateCode(error)) {
        throw new AppError(`A meal plan with code "${payload.code}" already exists in this scope`, 409);
      }
      throw error;
    }
    res.status(201).json({ success: true, data: normalizeMealPlan(data) });
  } catch (error) {
    next(error);
  }
};

// @route PUT /api/meal-plans/:id
export const updateMealPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = mealPlanPayload(req.body);
    if (!payload.name) throw new AppError('Meal plan name is required', 400);

    const { data, error } = await supabase
      .from('meal_plans')
      .update(compact({ ...payload, updated_by: req.user?.id ?? null, updated_at: new Date().toISOString() }))
      .eq('id', req.params.id)
      .select('*');

    if (error) {
      if (isDuplicateCode(error)) {
        throw new AppError(`A meal plan with code "${payload.code}" already exists in this scope`, 409);
      }
      throw error;
    }
    if (!data || data.length === 0) throw new AppError('Meal plan not found', 404);
    res.status(200).json({ success: true, data: normalizeMealPlan(data[0]) });
  } catch (error) {
    next(error);
  }
};

// @route DELETE /api/meal-plans/:id
export const deleteMealPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabase.from('meal_plans').delete().eq('id', req.params.id).select('id');
    if (error) throw error;
    if (!data || data.length === 0) throw new AppError('Meal plan not found', 404);
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
