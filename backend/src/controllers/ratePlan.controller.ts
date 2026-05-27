import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const numericId = (id: string): number | null => (/^\d+$/.test(id) ? Number(id) : null);

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toIntegerOrNull = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

const toBool = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes', 'active'].includes(value.toLowerCase());
  return fallback;
};

const compact = (data: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));

const codeFromName = (name: string): string =>
  name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20) || `PLAN_${Date.now().toString().slice(-6)}`;

const normalizeRatePlan = (row: any): Record<string, unknown> => ({
  id: String(row.id),
  source: 'rate_plans',
  name: row.name,
  code: row.code || codeFromName(row.name || 'Rate Plan'),
  description: row.description || '',
  rateType: row.rate_type || row.rateType || 'standard',
  multiplier: toNumber(row.multiplier, 1),
  isPercentage: toBool(row.is_percentage ?? row.isPercentage, true),
  fixedAmount: toNumber(row.fixed_amount ?? row.fixedAmount, 0),
  minNights: toIntegerOrNull(row.min_nights ?? row.minNights) ?? 1,
  maxNights: toIntegerOrNull(row.max_nights ?? row.maxNights),
  advanceBookingDays: toIntegerOrNull(row.advance_booking_days ?? row.advanceBookingDays),
  validFrom: row.valid_from ?? row.validFrom ?? null,
  validTo: row.valid_to ?? row.validTo ?? null,
  daysOfWeek: row.days_of_week ?? row.daysOfWeek ?? [],
  blackoutDates: row.blackout_dates ?? row.blackoutDates ?? [],
  refundable: toBool(row.refundable, true),
  cancellationHours: toIntegerOrNull(row.cancellation_hours ?? row.cancellationHours) ?? 24,
  depositPercentage: toNumber(row.deposit_percentage ?? row.depositPercentage, 0),
  inclusions: row.inclusions ?? [],
  restrictions: row.restrictions || '',
  active: toBool(row.is_active ?? row.active, true),
  createdAt: row.created_at ?? row.createdAt ?? null,
  updatedAt: row.updated_at ?? row.updatedAt ?? null
});

const normalizeRoomTypeAsRatePlan = (row: any): Record<string, unknown> => ({
  id: String(row.id),
  source: 'room_types',
  roomTypeId: String(row.id),
  name: row.name,
  code: codeFromName(row.code || row.name || 'ROOM_TYPE'),
  description: row.description || '',
  rateType: 'standard',
  multiplier: 1,
  isPercentage: false,
  fixedAmount: toNumber(row.base_price ?? row.price ?? row.rate, 0),
  minNights: 1,
  maxNights: null,
  advanceBookingDays: null,
  validFrom: null,
  validTo: null,
  daysOfWeek: [],
  blackoutDates: [],
  refundable: true,
  cancellationHours: 24,
  depositPercentage: 0,
  inclusions: [],
  restrictions: row.max_occupancy ? `Max occupancy: ${row.max_occupancy}` : '',
  active: toBool(row.is_active ?? row.active, true),
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null
});

const ratePlanPayload = (body: any): Record<string, unknown> => {
  const name = String(body.name || '').trim();
  const code = String(body.code || codeFromName(name)).trim().toUpperCase();

  return compact({
    name,
    code,
    description: body.description || null,
    rate_type: body.rateType ?? body.rate_type ?? 'standard',
    multiplier: toNumber(body.multiplier, 1),
    is_percentage: toBool(body.isPercentage ?? body.is_percentage, true),
    fixed_amount: toNumber(body.fixedAmount ?? body.fixed_amount, 0),
    min_nights: toIntegerOrNull(body.minNights ?? body.min_nights) ?? 1,
    max_nights: toIntegerOrNull(body.maxNights ?? body.max_nights),
    advance_booking_days: toIntegerOrNull(body.advanceBookingDays ?? body.advance_booking_days),
    valid_from: body.validFrom ?? body.valid_from ?? null,
    valid_to: body.validTo ?? body.valid_to ?? null,
    days_of_week: body.daysOfWeek ?? body.days_of_week ?? [],
    blackout_dates: body.blackoutDates ?? body.blackout_dates ?? [],
    refundable: toBool(body.refundable, true),
    cancellation_hours: toIntegerOrNull(body.cancellationHours ?? body.cancellation_hours) ?? 24,
    deposit_percentage: toNumber(body.depositPercentage ?? body.deposit_percentage, 0),
    inclusions: body.inclusions ?? [],
    restrictions: body.restrictions || null,
    is_active: toBool(body.active ?? body.is_active, true)
  });
};

const minimalRatePlanPayload = (payload: Record<string, unknown>): Record<string, unknown> =>
  compact({
    name: payload.name,
    description: payload.description,
    multiplier: payload.multiplier,
    valid_from: payload.valid_from,
    valid_to: payload.valid_to,
    is_active: payload.is_active
  });

const fetchRoomTypePlans = async (): Promise<Record<string, unknown>[]> => {
  const { data, error } = await supabase
    .from('room_types')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []).map(normalizeRoomTypeAsRatePlan);
};

const fetchRatePlanRows = async (): Promise<any[]> => {
  const { data, error } = await supabase
    .from('rate_plans')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
};

const findRatePlanRow = async (id: string): Promise<any | null> => {
  const idNumber = numericId(id);
  const query = supabase.from('rate_plans').select('*');
  const { data, error } = idNumber !== null
    ? await query.eq('id', idNumber).limit(1)
    : await query.eq('code', id.toUpperCase()).limit(1);

  if (error) throw error;
  return data?.[0] || null;
};

const findRoomTypeRow = async (id: string): Promise<any | null> => {
  const { data, error } = await supabase
    .from('room_types')
    .select('*')
    .eq('id', id)
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
};

export const getRatePlans = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ratePlanRows = await fetchRatePlanRows();
    const plans = ratePlanRows.length > 0
      ? ratePlanRows.map(normalizeRatePlan)
      : await fetchRoomTypePlans();

    res.status(200).json({
      success: true,
      count: plans.length,
      data: plans
    });
  } catch (error) {
    logger.error('Failed to fetch rate plans:', error);
    next(new AppError('Failed to fetch rate plans', 500));
  }
};

export const getRatePlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const row = await findRatePlanRow(req.params.id);
    if (row) {
      res.status(200).json({ success: true, data: normalizeRatePlan(row) });
      return;
    }

    const roomType = await findRoomTypeRow(req.params.id);
    if (roomType) {
      res.status(200).json({ success: true, data: normalizeRoomTypeAsRatePlan(roomType) });
      return;
    }

    throw new AppError('Rate plan not found', 404);
  } catch (error) {
    next(error);
  }
};

export const createRatePlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payload = ratePlanPayload(req.body);
    if (!payload.name) {
      throw new AppError('Rate plan name is required', 400);
    }

    let insert = await supabase
      .from('rate_plans')
      .insert(payload)
      .select('*')
      .single();

    if (insert.error && /column .* does not exist/i.test(insert.error.message || '')) {
      insert = await supabase
        .from('rate_plans')
        .insert(minimalRatePlanPayload(payload))
        .select('*')
        .single();
    }

    if (insert.error) throw insert.error;

    res.status(201).json({
      success: true,
      data: normalizeRatePlan(insert.data)
    });
  } catch (error) {
    next(error);
  }
};

export const updateRatePlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payload = ratePlanPayload(req.body);
    const idNumber = numericId(req.params.id);

    if (idNumber !== null) {
      let update = await supabase
        .from('rate_plans')
        .update(payload)
        .eq('id', idNumber)
        .select('*');

      if (update.error && /column .* does not exist/i.test(update.error.message || '')) {
        update = await supabase
          .from('rate_plans')
          .update(minimalRatePlanPayload(payload))
          .eq('id', idNumber)
          .select('*');
      }

      if (update.error) throw update.error;
      if (update.data?.[0]) {
        res.status(200).json({ success: true, data: normalizeRatePlan(update.data[0]) });
        return;
      }
    }

    const roomTypePayload = compact({
      description: payload.description,
      base_price: payload.fixed_amount,
      updated_at: new Date().toISOString()
    });

    const roomUpdate = await supabase
      .from('room_types')
      .update(roomTypePayload)
      .eq('id', req.params.id)
      .select('*');

    if (roomUpdate.error) throw roomUpdate.error;
    if (!roomUpdate.data?.[0]) {
      throw new AppError('Rate plan not found', 404);
    }

    res.status(200).json({
      success: true,
      data: normalizeRoomTypeAsRatePlan(roomUpdate.data[0])
    });
  } catch (error) {
    next(error);
  }
};

export const deleteRatePlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const idNumber = numericId(req.params.id);

    if (idNumber !== null) {
      const { data, error } = await supabase
        .from('rate_plans')
        .delete()
        .eq('id', idNumber)
        .select('id');

      if (error) throw error;
      if (data && data.length > 0) {
        res.status(200).json({ success: true, data: {} });
        return;
      }
    }

    throw new AppError(
      'This rate is sourced from room types. Create a dedicated rate plan before deleting it.',
      400
    );
  } catch (error) {
    next(error);
  }
};
