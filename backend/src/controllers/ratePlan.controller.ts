import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// rate_plans is now a sellable ROOM PACKAGE = room type + meal plan + nightly
// rate + extra-pax pricing + validity, scoped to a branch (or global when
// branch_id is null). Reception books a Rate Plan rather than piecing room +
// meal together each time.

const toNumber = (v: unknown, f = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : f;
};
const toIntOrNull = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
const toBool = (v: unknown, f = false): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['true', '1', 'yes', 'active', 'on'].includes(v.toLowerCase());
  return f;
};
const compact = (d: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined));
const branchIdOrNull = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '' || v === 'null') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const codeFromName = (name: string): string =>
  name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24)
  || `RP_${Date.now().toString().slice(-6)}`;

const normalizeRatePlan = (
  row: any,
  roomTypeName?: string | null,
  mealPlanName?: string | null,
): Record<string, unknown> => ({
  id: String(row.id),
  branchId: row.branch_id ?? null,
  code: row.code,
  name: row.name,
  description: row.description || '',
  roomTypeId: row.room_type_id ? String(row.room_type_id) : null,
  roomTypeName: roomTypeName ?? null,
  mealPlanId: row.meal_plan_id ? String(row.meal_plan_id) : null,
  mealPlanName: mealPlanName ?? null,
  mealPlan: row.meal_plan ?? null, // legacy text code
  ratePerNight: toNumber(row.rate_per_night, 0),
  extraAdultCharge: toNumber(row.extra_adult_charge, 0),
  extraChildCharge: toNumber(row.extra_child_charge, 0),
  extraBedCharge: toNumber(row.extra_bed_charge, 0),
  maxOccupancy: row.max_occupancy ?? null,
  minStay: toIntOrNull(row.min_stay) ?? 1,
  maxStay: toIntOrNull(row.max_stay),
  validFrom: row.valid_from ?? null,
  validTo: row.valid_to ?? null,
  isDefaultForReception: !!row.is_default_for_reception,
  isActive: row.is_active !== false,
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
});

// Resolve the meal plan's code (used to keep the legacy meal_plan text in sync
// so existing consumers — e.g. breakfast pax — keep working).
const mealPlanCode = async (mealPlanId: string | null): Promise<string | null> => {
  if (!mealPlanId) return null;
  const { data } = await supabase.from('meal_plans').select('code').eq('id', mealPlanId).maybeSingle();
  return data?.code ? String(data.code).toLowerCase() : null;
};

const ratePlanPayload = async (body: any): Promise<Record<string, unknown>> => {
  const name = String(body.name ?? '').trim();
  const code = String(body.code || codeFromName(name)).trim().toUpperCase();
  const mealPlanId = body.mealPlanId ?? body.meal_plan_id ?? null;
  // Keep the legacy meal_plan text aligned with the linked plan when we can.
  const legacyMeal = mealPlanId
    ? (await mealPlanCode(String(mealPlanId))) ?? body.mealPlan ?? body.meal_plan
    : (body.mealPlan ?? body.meal_plan);
  return compact({
    branch_id: branchIdOrNull(body.branchId ?? body.branch_id),
    room_type_id: body.roomTypeId ?? body.room_type_id ?? null,
    meal_plan_id: mealPlanId,
    code,
    name,
    description: body.description ?? null,
    rate_per_night: Math.max(0, toNumber(body.ratePerNight ?? body.rate_per_night, 0)),
    meal_plan: legacyMeal ?? undefined,
    extra_adult_charge: Math.max(0, toNumber(body.extraAdultCharge ?? body.extra_adult_charge, 0)),
    extra_child_charge: Math.max(0, toNumber(body.extraChildCharge ?? body.extra_child_charge, 0)),
    extra_bed_charge: Math.max(0, toNumber(body.extraBedCharge ?? body.extra_bed_charge, 0)),
    max_occupancy: toIntOrNull(body.maxOccupancy ?? body.max_occupancy),
    min_stay: toIntOrNull(body.minStay ?? body.min_stay) ?? 1,
    max_stay: toIntOrNull(body.maxStay ?? body.max_stay),
    valid_from: body.validFrom ?? body.valid_from ?? null,
    valid_to: body.validTo ?? body.valid_to ?? null,
    is_default_for_reception: toBool(body.isDefaultForReception ?? body.is_default_for_reception, false),
    is_active: toBool(body.isActive ?? body.active ?? body.is_active, true),
  });
};

const isDuplicate = (e: any): boolean => e?.code === '23505' || /duplicate key|unique/i.test(e?.message || '');

// Build name lookup maps so list rows carry room-type + meal-plan display names.
const buildLookups = async (rows: any[]): Promise<{ rt: Map<string, string>; mp: Map<string, string> }> => {
  const rtIds = [...new Set(rows.map(r => r.room_type_id).filter(Boolean))];
  const mpIds = [...new Set(rows.map(r => r.meal_plan_id).filter(Boolean))];
  const rt = new Map<string, string>();
  const mp = new Map<string, string>();
  if (rtIds.length) {
    const { data } = await supabase.from('room_types').select('id, name').in('id', rtIds);
    for (const r of data || []) rt.set(String(r.id), r.name);
  }
  if (mpIds.length) {
    const { data } = await supabase.from('meal_plans').select('id, name').in('id', mpIds);
    for (const m of data || []) mp.set(String(m.id), m.name);
  }
  return { rt, mp };
};

// @route GET /api/rate-plans?branch_id=&room_type_id=&include_inactive=
export const getRatePlans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branchId = branchIdOrNull(req.query.branch_id ?? req.query.branchId);
    const roomTypeId = req.query.room_type_id ?? req.query.roomTypeId;
    const includeInactive = ['true', '1'].includes(String(req.query.include_inactive || '').toLowerCase());

    let query = supabase.from('rate_plans').select('*').order('name', { ascending: true });
    if (branchId !== null) query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
    if (roomTypeId) query = query.eq('room_type_id', roomTypeId);
    if (!includeInactive) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    const { rt, mp } = await buildLookups(rows);
    const plans = rows.map(r => normalizeRatePlan(r, rt.get(String(r.room_type_id)) ?? null, mp.get(String(r.meal_plan_id)) ?? null));

    res.status(200).json({ success: true, count: plans.length, data: plans });
  } catch (error) {
    logger.error('Failed to fetch rate plans:', error);
    next(new AppError('Failed to fetch rate plans', 500));
  }
};

// @route GET /api/rate-plans/:id
export const getRatePlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabase.from('rate_plans').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!data) throw new AppError('Rate plan not found', 404);
    const { rt, mp } = await buildLookups([data]);
    res.status(200).json({ success: true, data: normalizeRatePlan(data, rt.get(String(data.room_type_id)) ?? null, mp.get(String(data.meal_plan_id)) ?? null) });
  } catch (error) {
    next(error);
  }
};

// @route POST /api/rate-plans
export const createRatePlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = await ratePlanPayload(req.body);
    if (!payload.name) throw new AppError('Rate plan name is required', 400);
    if (!payload.room_type_id) throw new AppError('Room standard (room type) is required', 400);

    const { data, error } = await supabase.from('rate_plans').insert(payload).select('*').single();
    if (error) {
      if (isDuplicate(error)) throw new AppError(`A rate plan with code "${payload.code}" already exists`, 409);
      throw error;
    }
    const { rt, mp } = await buildLookups([data]);
    res.status(201).json({ success: true, data: normalizeRatePlan(data, rt.get(String(data.room_type_id)) ?? null, mp.get(String(data.meal_plan_id)) ?? null) });
  } catch (error) {
    next(error);
  }
};

// @route PUT /api/rate-plans/:id
export const updateRatePlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = await ratePlanPayload(req.body);
    if (!payload.name) throw new AppError('Rate plan name is required', 400);

    const { data, error } = await supabase
      .from('rate_plans')
      .update(compact({ ...payload, updated_at: new Date().toISOString() }))
      .eq('id', req.params.id)
      .select('*');
    if (error) {
      if (isDuplicate(error)) throw new AppError(`A rate plan with code "${payload.code}" already exists`, 409);
      throw error;
    }
    if (!data || data.length === 0) throw new AppError('Rate plan not found', 404);
    const { rt, mp } = await buildLookups([data[0]]);
    res.status(200).json({ success: true, data: normalizeRatePlan(data[0], rt.get(String(data[0].room_type_id)) ?? null, mp.get(String(data[0].meal_plan_id)) ?? null) });
  } catch (error) {
    next(error);
  }
};

// @route DELETE /api/rate-plans/:id
export const deleteRatePlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabase.from('rate_plans').delete().eq('id', req.params.id).select('id');
    if (error) throw error;
    if (!data || data.length === 0) throw new AppError('Rate plan not found', 404);
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
