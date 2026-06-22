import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';

// Kitchen wastage alerts/report (migration
// 20260622_kitchen_storekeeper_integration.sql, sections 3 + 6) — real-time
// alerts raised by kitchen-shift.controller.ts's recordProduction()/
// closeKitchenShift(), surfaced here for acknowledgement and reporting.

const num = (v: any): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const DEFAULT_WASTAGE_THRESHOLDS = {
    recipe_variance_warning_pct: 5,
    recipe_variance_critical_pct: 15,
    spoilage_warning_pct: 5,
    spoilage_critical_pct: 10,
    shortage_warning_kes: 500,
    shortage_critical_kes: 2000,
    production_shortfall_warning_pct: 5,
    production_shortfall_critical_pct: 15,
    bar_variance_warning_kes: 500,
    bar_variance_critical_kes: 2000
};

/**
 * @desc    List kitchen wastage alerts. Unacknowledged count is returned
 *          both as the X-Unacknowledged-Count header and badge_count in body.
 * @route   GET /api/kitchen/wastage/alerts?branch_id=&shift_id=&severity=&acknowledged=
 * @access  Kitchen staff, storekeepers, branch accountant, auditor, super admin
 */
export const listWastageAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, shift_id, severity, acknowledged } = req.query;
        if (!branch_id) {
            res.status(400).json({ success: false, message: 'branch_id is required' });
            return;
        }
        const branchId = Number(branch_id);
        if (!Number.isInteger(branchId)) {
            res.status(400).json({ success: false, message: 'branch_id must be an integer' });
            return;
        }

        let query = supabase
            .from('kitchen_wastage_alerts')
            .select('*')
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false });
        if (shift_id) query = query.eq('shift_id', String(shift_id));
        if (severity) query = query.eq('severity', String(severity));
        if (acknowledged === 'true') query = query.not('acknowledged_at', 'is', null);
        if (acknowledged === 'false') query = query.is('acknowledged_at', null);

        const { data, error } = await query.limit(500);
        if (error) throw error;

        const badgeCount = (data || []).filter((a: any) => !a.acknowledged_at).length;
        res.set('X-Unacknowledged-Count', String(badgeCount));
        res.status(200).json({ success: true, data: data || [], badge_count: badgeCount });
    } catch (error) {
        logger.error('listWastageAlerts failed:', error);
        next(error);
    }
};

/**
 * @desc    Acknowledge a wastage alert.
 * @route   PATCH /api/kitchen/wastage/alerts/:id/acknowledge
 * @access  Kitchen staff, storekeepers, branch accountant, super admin
 */
export const acknowledgeWastageAlert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { data, error } = await supabase
            .from('kitchen_wastage_alerts')
            .update({ acknowledged_by: req.user?.id || null, acknowledged_at: new Date().toISOString() })
            .eq('id', req.params.id)
            .select()
            .single();
        if (error) throw error;
        if (!data) {
            res.status(404).json({ success: false, message: 'Alert not found' });
            return;
        }
        res.status(200).json({ success: true, data });
    } catch (error) {
        logger.error('acknowledgeWastageAlert failed:', error);
        next(error);
    }
};

/**
 * @desc    Aggregate wastage report across recipe variance, spoilage,
 *          unexplained shortage and production shortfall.
 * @route   GET /api/kitchen/wastage/report?branch_id=&from_date=&to_date=
 * @access  Kitchen managers, branch accountant, auditor, super admin
 */
export const getWastageReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, from_date, to_date } = req.query;
        if (!branch_id) {
            res.status(400).json({ success: false, message: 'branch_id is required' });
            return;
        }
        const branchId = Number(branch_id);
        if (!Number.isInteger(branchId)) {
            res.status(400).json({ success: false, message: 'branch_id must be an integer' });
            return;
        }
        const startDate = (from_date as string) || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
        const endDate = (to_date as string) || new Date().toISOString().split('T')[0];

        const [{ data: alerts, error: alertsErr }, { data: production, error: prodErr }, { data: shiftItems, error: itemsErr }] = await Promise.all([
            supabase
                .from('kitchen_wastage_alerts')
                .select('*')
                .eq('branch_id', branchId)
                .gte('created_at', `${startDate}T00:00:00`)
                .lte('created_at', `${endDate}T23:59:59`),
            supabase
                .from('kitchen_shift_production')
                .select('produced_by, raw_item_sku, raw_item_name, variance_cost, created_at')
                .eq('branch_id', branchId)
                .gte('created_at', `${startDate}T00:00:00`)
                .lte('created_at', `${endDate}T23:59:59`),
            supabase
                .from('kitchen_shift_items')
                .select('item_sku, item_name, spoilage_quantity, cost_price, created_at, sold_quantity')
                .eq('branch_id', branchId)
                .gte('created_at', `${startDate}T00:00:00`)
                .lte('created_at', `${endDate}T23:59:59`),
        ]);
        if (alertsErr) throw alertsErr;
        if (prodErr) throw prodErr;
        if (itemsErr) throw itemsErr;

        const byCategory: Record<string, number> = {
            recipe_variance: 0,
            spoilage: 0,
            unexplained_shortage: 0,
            production_shortfall: 0,
        };
        const byItem = new Map<string, { item_sku: string; item_name: string; total_variance_cost: number; occurrence_count: number }>();

        (alerts || []).forEach((a: any) => {
            const cat = a.alert_type === 'spoilage_spike' ? 'spoilage' : a.alert_type;
            if (byCategory[cat] !== undefined) byCategory[cat] += num(a.variance_cost);
            const key = a.item_sku || 'unknown';
            const entry = byItem.get(key) || { item_sku: key, item_name: a.item_name || key, total_variance_cost: 0, occurrence_count: 0 };
            entry.total_variance_cost += num(a.variance_cost);
            entry.occurrence_count += 1;
            byItem.set(key, entry);
        });

        (production || []).filter((p: any) => num(p.variance_cost) > 0).forEach((p: any) => {
            byCategory.production_shortfall += num(p.variance_cost);
        });

        let spoilageFromItems = 0;
        (shiftItems || []).forEach((it: any) => { spoilageFromItems += num(it.spoilage_quantity) * num(it.cost_price); });

        const totalWastageCost = byCategory.recipe_variance + byCategory.spoilage + byCategory.unexplained_shortage + byCategory.production_shortfall;

        const byChefMap = new Map<string, { chef_id: string; chef_name: string; total_variance_cost: number }>();
        const chefIds = [...new Set((production || []).map((p: any) => p.produced_by).filter(Boolean))];
        let usersById = new Map<string, any>();
        if (chefIds.length) {
            const { data: users } = await supabase.from('users').select('id, first_name, last_name').in('id', chefIds);
            usersById = new Map((users || []).map((u: any) => [u.id, u]));
        }
        (production || []).filter((p: any) => num(p.variance_cost) > 0).forEach((p: any) => {
            const user = usersById.get(p.produced_by);
            const name = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : (p.produced_by || 'Unknown');
            const entry = byChefMap.get(p.produced_by) || { chef_id: p.produced_by, chef_name: name, total_variance_cost: 0 };
            entry.total_variance_cost += num(p.variance_cost);
            byChefMap.set(p.produced_by, entry);
        });

        const dailyTrendMap = new Map<string, { date: string; wastage_cost: number; expected_raw_usage: number; actual_raw_usage: number; pos_sales_consumption: number }>();
        (alerts || []).forEach((a: any) => {
            const date = String(a.created_at).split('T')[0];
            const entry = dailyTrendMap.get(date) || { date, wastage_cost: 0, expected_raw_usage: 0, actual_raw_usage: 0, pos_sales_consumption: 0 };
            entry.wastage_cost += num(a.variance_cost);
            entry.expected_raw_usage += num(a.expected_value);
            entry.actual_raw_usage += num(a.actual_value);
            dailyTrendMap.set(date, entry);
        });

        res.status(200).json({
            success: true,
            data: {
                total_wastage_cost: Math.round((totalWastageCost) * 100) / 100,
                by_category: {
                    recipe_variance: Math.round(byCategory.recipe_variance * 100) / 100,
                    spoilage: Math.round((byCategory.spoilage || spoilageFromItems) * 100) / 100,
                    unexplained_shortage: Math.round(byCategory.unexplained_shortage * 100) / 100,
                    production_shortfall: Math.round(byCategory.production_shortfall * 100) / 100,
                },
                top_10_wastage_items: Array.from(byItem.values()).sort((a, b) => b.total_variance_cost - a.total_variance_cost).slice(0, 10),
                by_chef: Array.from(byChefMap.values()).sort((a, b) => b.total_variance_cost - a.total_variance_cost),
                daily_trend: Array.from(dailyTrendMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
            }
        });
    } catch (error) {
        logger.error('getWastageReport failed:', error);
        next(error);
    }
};

/**
 * @desc    Get wastage threshold config for a branch (defaults if unset).
 * @route   GET /api/kitchen/wastage/thresholds/:branchId
 * @access  Kitchen managers, branch accountant, super admin
 */
export const getWastageThresholdsConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const branchId = Number(req.params.branchId);
        if (!Number.isInteger(branchId)) {
            res.status(400).json({ success: false, message: 'branchId must be an integer' });
            return;
        }
        const { data, error } = await supabase
            .from('kitchen_wastage_thresholds')
            .select('*')
            .eq('branch_id', branchId)
            .maybeSingle();
        if (error) throw error;
        res.status(200).json({ success: true, data: data || { branch_id: branchId, ...DEFAULT_WASTAGE_THRESHOLDS } });
    } catch (error) {
        logger.error('getWastageThresholdsConfig failed:', error);
        next(error);
    }
};

/**
 * @desc    Update wastage threshold config for a branch.
 * @route   PUT /api/kitchen/wastage/thresholds/:branchId
 * @access  Super Admin, Branch Accountant
 */
export const updateWastageThresholdsConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const branchId = Number(req.params.branchId);
        if (!Number.isInteger(branchId)) {
            res.status(400).json({ success: false, message: 'branchId must be an integer' });
            return;
        }
        const allowedFields = [
            'recipe_variance_warning_pct', 'recipe_variance_critical_pct',
            'spoilage_warning_pct', 'spoilage_critical_pct',
            'shortage_warning_kes', 'shortage_critical_kes',
            'production_shortfall_warning_pct', 'production_shortfall_critical_pct',
            'bar_variance_warning_kes', 'bar_variance_critical_kes'
        ];
        const update: Record<string, any> = { branch_id: branchId, updated_by: req.user?.id || null, updated_at: new Date().toISOString() };
        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) update[field] = num((req.body as any)[field]);
        }

        const { data, error } = await supabase
            .from('kitchen_wastage_thresholds')
            .upsert(update, { onConflict: 'branch_id' })
            .select()
            .single();
        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (error) {
        logger.error('updateWastageThresholdsConfig failed:', error);
        next(error);
    }
};
