import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { syncAdjustmentToPayroll } from '../services/payroll-adjustment-sync.service';

const CREATEABLE_STATUSES = new Set(['pending', 'approved']);

const normalizeStatus = (value?: string) => (value || '').toLowerCase();

// Get all pending and historical adjustments
export const getAdjustments = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, status, type, month, year } = req.query;

        let query = supabase
            .from('staff_payroll_adjustments')
            .select('*')
            .order('created_at', { ascending: false });

        if (staff_id) query = query.eq('staff_id', staff_id);
        if (status) query = query.eq('status', status);
        if (type) query = query.eq('type', type);
        if (month) query = query.eq('month', month);
        if (year) query = query.eq('year', year);

        const { data, error } = await query;
        if (error) throw error;

        res.status(200).json({ success: true, count: data.length, data });
    } catch (error) {
        next(error);
    }
};

// Create a new adjustment
export const createAdjustment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { staff_id, type, category, amount, description, month, year, status } = req.body;
        const created_by = req.user?.id;
        const normalizedStatus = normalizeStatus(status) || 'pending';

        if (!staff_id || !type || !category || amount === undefined || amount === null || !month || !year) {
            throw new AppError('Missing required fields for adjustment', 400);
        }

        if (Number(amount) <= 0) {
            throw new AppError('Adjustment amount must be greater than zero', 400);
        }

        if (!CREATEABLE_STATUSES.has(normalizedStatus)) {
            throw new AppError('Invalid adjustment status', 400);
        }

        const payload: Record<string, any> = {
            staff_id,
            type,
            category,
            amount: Number(amount),
            description,
            month: String(month),
            year: Number(year),
            created_by,
            status: normalizedStatus
        };

        if (normalizedStatus === 'approved') {
            payload.approved_by = created_by;
            payload.approved_at = new Date().toISOString();
        }

        const { data, error } = await supabase
            .from('staff_payroll_adjustments')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;

        // Always sync so payroll draft picks it up immediately
        try { await syncAdjustmentToPayroll(data.id, created_by, req); } catch (_) {}

        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const approveAdjustment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const actorId = req.user?.id;

        const { data: existing, error: fetchError } = await supabase
            .from('staff_payroll_adjustments')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !existing) {
            throw fetchError || new AppError('Adjustment not found', 404);
        }

        if (normalizeStatus(existing.status) === 'applied') {
            throw new AppError('Cannot approve an adjustment already locked into payroll', 400);
        }

        const { data, error } = await supabase
            .from('staff_payroll_adjustments')
            .update({
                status: 'approved',
                approved_by: actorId,
                approved_at: new Date().toISOString(),
                rejected_by: null,
                rejected_at: null,
                rejection_reason: null,
                payroll_id: null
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await syncAdjustmentToPayroll(data.id, actorId, req, existing);

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const rejectAdjustment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const actorId = req.user?.id;
        const { rejection_reason } = req.body;

        const { data: existing, error: fetchError } = await supabase
            .from('staff_payroll_adjustments')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !existing) {
            throw fetchError || new AppError('Adjustment not found', 404);
        }

        if (normalizeStatus(existing.status) === 'applied') {
            throw new AppError('Cannot change status for an adjustment already locked into payroll', 400);
        }

        const { data, error } = await supabase
            .from('staff_payroll_adjustments')
            .update({
                status: 'rejected',
                approved_by: null,
                approved_at: null,
                rejected_by: actorId,
                rejected_at: new Date().toISOString(),
                rejection_reason: rejection_reason || null,
                payroll_id: null
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await syncAdjustmentToPayroll(data.id, actorId, req, existing);

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// Void an adjustment
export const voidAdjustment = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const actorId = req.user?.id;

        const { data: existing, error: checkError } = await supabase
            .from('staff_payroll_adjustments')
            .select('*')
            .eq('id', id)
            .single();

        if (checkError) throw checkError;
        if (existing.status === 'applied') {
            throw new AppError('Cannot void an already applied adjustment associated with a payroll run', 400);
        }

        const { data, error } = await supabase
            .from('staff_payroll_adjustments')
            .update({ status: 'cancelled', payroll_id: null })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await syncAdjustmentToPayroll(data.id, actorId, req, existing);

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};
