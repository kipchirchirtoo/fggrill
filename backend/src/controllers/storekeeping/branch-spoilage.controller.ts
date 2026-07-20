import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';
import { KITCHEN_STOCKTAKE_ITEMS } from './kitchen-stocktake.controller';
import { recordBarStockMovement } from '../../services/unified-bar-stock.service';

// Branch Spoilage Log — storekeeper records spoiled/damaged/expired stock for
// any of the three branch stocktake areas (bar, kitchen, store). Entries sit
// 'pending' until a branch accountant approves or rejects them. Approval is
// what applies the stock effect:
//   bar    -> restaurant_bar_inventory.current_bottles/current_stock decremented
//             directly (bar-stocktake.controller.ts reads this table live as
//             its system quantity, so the next stocktake reflects it).
//   store  -> branch_stock.quantity decremented directly (store-stocktake
//             reads this table live, so the next stocktake reflects it).
//   kitchen -> no live balance to adjust; approved rows are summed at
//             read-time by kitchen-stocktake.controller.ts and subtracted
//             from the open+added quantity.
// Rejection never touches stock, since nothing was applied while pending.

const AREAS = ['bar', 'kitchen', 'store'] as const;
type Area = typeof AREAS[number];

const REASONS = ['EXPIRED', 'DAMAGED', 'BREAKAGE', 'CONTAMINATION', 'THEFT', 'QUALITY_ISSUE', 'OTHER'];

const num = (v: any): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/**
 * @desc    Item candidates for the spoilage form, per area.
 * @route   GET /api/storekeeping/spoilage/candidates?branch_id=&area=
 * @access  Branch Storekeeper, Central Storekeeper, Branch Manager, Branch Accountant, Auditor, Super Admin
 */
export const getSpoilageCandidates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, area } = req.query;
        const branchId = Number(branch_id);
        if (!Number.isInteger(branchId)) {
            res.status(400).json({ success: false, message: 'branch_id must be an integer' });
            return;
        }
        if (!AREAS.includes(area as Area)) {
            res.status(400).json({ success: false, message: `area must be one of ${AREAS.join(', ')}` });
            return;
        }

        if (area === 'kitchen') {
            res.status(200).json({
                success: true,
                data: KITCHEN_STOCKTAKE_ITEMS.map((name) => ({ id: name, name, unit: 'unit' })),
            });
            return;
        }

        if (area === 'bar') {
            // Use bar_drinks as the catalog source — matches bar-stocktake.controller.ts exactly.
            const { data: items, error } = await supabase
                .from('bar_drinks')
                .select('id, name, unit, inventory_item_id')
                .eq('branch_id', branchId)
                .eq('is_active', true)
                .order('name');
            if (error) throw error;

            // Get current stock from bar_stock
            const drinkIds = (items || []).map((i: any) => i.id);
            let stockByDrinkId: Record<string, number> = {};
            if (drinkIds.length > 0) {
                const { data: stockRows } = await supabase
                    .from('bar_stock')
                    .select('drink_id, current_stock')
                    .eq('branch_id', branchId)
                    .in('drink_id', drinkIds);
                stockByDrinkId = Object.fromEntries(
                    (stockRows || []).map((r: any) => [String(r.drink_id), Number(r.current_stock ?? 0)])
                );
            }

            const result = (items || []).map((i: any) => ({
                id: i.inventory_item_id || i.id,  // prefer inventory_items UUID for FK
                drink_id: i.id,
                name: i.name,
                unit: i.unit || 'bottle',
                quantity: stockByDrinkId[String(i.id)] ?? 0,
            }));
            res.status(200).json({ success: true, data: result });
            return;
        }

        // store
        const { data: items, error } = await supabase
            .from('inventory_items')
            .select('id, sku, item_name, unit, category, store_type')
            .not('store_type', 'in', '(bar_store)')
            .eq('is_active', true)
            .order('item_name');
        if (error) throw error;
        const result = (items || []).map((i: any) => ({
            id: i.id,
            name: i.item_name,
            sku: i.sku,
            unit: i.unit || 'unit',
            category: i.category,
            store_type: i.store_type,
        }));
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        logger.error('getSpoilageCandidates failed:', error);
        next(error);
    }
};

/**
 * @desc    List spoilage records for a branch.
 * @route   GET /api/storekeeping/spoilage?branch_id=&area=&status=
 * @access  Branch Storekeeper, Central Storekeeper, Branch Manager, Branch Accountant, Auditor, Super Admin
 */
export const listSpoilageRecords = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, area, status } = req.query;
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
            .from('branch_spoilage_log')
            .select('*')
            .eq('branch_id', branchId)
            .order('recorded_at', { ascending: false });
        if (area) query = query.eq('area', String(area));
        if (status) query = query.eq('status', String(status));

        const { data, error } = await query.limit(500);
        if (error) throw error;
        res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        logger.error('listSpoilageRecords failed:', error);
        next(error);
    }
};

/**
 * @desc    Storekeeper records a spoilage entry. Sits 'pending' — no stock
 *          effect until a branch accountant approves it.
 * @route   POST /api/storekeeping/spoilage
 *          body: { branch_id, area, bar_location?, shift?, kitchen_shift_id?, item_id, quantity,
 *                   unit?, reason, notes?, spoilage_date? }
 * @access  Branch Storekeeper, Central Storekeeper, Super Admin
 */
export const recordSpoilage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const {
            branch_id, area, bar_location, shift, kitchen_shift_id, item_id, quantity, unit, reason, notes, spoilage_date,
            responsible_staff_id, charge_to_staff,
        } = req.body || {};

        const branchId = Number(branch_id);
        if (!Number.isInteger(branchId)) {
            res.status(400).json({ success: false, message: 'branch_id must be an integer' });
            return;
        }
        if (!AREAS.includes(area)) {
            res.status(400).json({ success: false, message: `area must be one of ${AREAS.join(', ')}` });
            return;
        }
        if (!item_id) {
            res.status(400).json({ success: false, message: 'item_id is required' });
            return;
        }
        const qty = num(quantity);
        if (qty <= 0) {
            res.status(400).json({ success: false, message: 'quantity must be greater than 0' });
            return;
        }
        if (!REASONS.includes(reason)) {
            res.status(400).json({ success: false, message: `reason must be one of ${REASONS.join(', ')}` });
            return;
        }
        if (area === 'bar' && !['main_bar', 'executive_bar'].includes(bar_location)) {
            res.status(400).json({ success: false, message: "bar_location must be 'main_bar' or 'executive_bar'" });
            return;
        }

        let itemName = '';
        let itemSku: string | null = null;
        let unitCost = 0;
        let resolvedItemId: string | null = String(item_id);

        if (area === 'kitchen') {
            // Kitchen items aren't a real table — item_id is the fixed item name itself.
            if (!KITCHEN_STOCKTAKE_ITEMS.includes(String(item_id))) {
                res.status(400).json({ success: false, message: 'Unknown kitchen item' });
                return;
            }
            itemName = String(item_id);
            resolvedItemId = null;
        } else if (area === 'bar') {
            // Find by bar_drinks.id or bar_drinks.inventory_item_id
            const { data: item, error } = await supabase
                .from('bar_drinks')
                .select('id, name, cost_price')
                .or(`id.eq.${item_id},inventory_item_id.eq.${item_id}`)
                .eq('branch_id', branchId)
                .maybeSingle();
            if (error) throw error;
            if (!item) {
                res.status(404).json({ success: false, message: 'Bar item not found' });
                return;
            }
            itemName = item.name;
            unitCost = num(item.cost_price);
            resolvedItemId = item.id; // store the bar_drinks.id
        } else {
            const { data: item, error } = await supabase
                .from('inventory_items')
                .select('id, item_name, sku, default_unit_cost')
                .eq('id', item_id)
                .maybeSingle();
            if (error) throw error;
            if (!item) {
                res.status(404).json({ success: false, message: 'Item not found' });
                return;
            }
            itemName = item.item_name;
            itemSku = item.sku;
            unitCost = num(item.default_unit_cost);
        }

        const row = {
            branch_id: branchId,
            area,
            bar_location: area === 'bar' ? bar_location : null,
            shift: area === 'kitchen' ? (shift || null) : null,
            kitchen_shift_id: area === 'kitchen' ? (kitchen_shift_id || null) : null,
            item_id: resolvedItemId,
            item_sku: itemSku,
            item_name: itemName,
            unit: unit || 'unit',
            quantity: qty,
            unit_cost: unitCost,
            total_loss: qty * unitCost,
            reason,
            notes: notes || null,
            spoilage_date: spoilage_date || new Date().toISOString().split('T')[0],
            status: 'pending',
            recorded_by: req.user?.id || null,
            recorded_at: new Date().toISOString(),
            responsible_staff_id: responsible_staff_id || null,
            charge_to_staff: !!charge_to_staff,
        };

        const { data, error } = await supabase.from('branch_spoilage_log').insert(row).select().single();
        if (error) throw error;

        res.status(201).json({ success: true, data });
    } catch (error) {
        logger.error('recordSpoilage failed:', error);
        next(error);
    }
};

const loadSpoilage = async (id: string): Promise<any> => {
    const { data, error } = await supabase.from('branch_spoilage_log').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
};

/**
 * @desc    Accountant approves a spoilage record — applies the area-specific
 *          stock deduction.
 * @route   PATCH /api/storekeeping/spoilage/:id/approve
 * @access  Branch Accountant, Super Admin
 */
export const approveSpoilage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const existing = await loadSpoilage(req.params.id);
        if (!existing) {
            res.status(404).json({ success: false, message: 'Spoilage record not found' });
            return;
        }
        if (existing.status !== 'pending') {
            res.status(400).json({ success: false, message: `Cannot approve a record that is ${existing.status}` });
            return;
        }

        if (existing.area === 'bar') {
            // Fetch live current stock from bar_stock
            const { data: barStock, error: barErr } = await supabase
                .from('bar_stock')
                .select('current_stock')
                .eq('branch_id', existing.branch_id)
                .eq('drink_id', existing.item_id)
                .maybeSingle();
            if (barErr) throw barErr;
            const currentQty = num(barStock?.current_stock);
            if (currentQty < num(existing.quantity)) {
                res.status(400).json({
                    success: false,
                    message: `Insufficient bar stock to approve — available: ${currentQty}, requested: ${existing.quantity}`,
                });
                return;
            }

            // Resolve POS outlet for the bar location to post stock movement correctly
            const { data: outlet } = await supabase
                .from('pos_outlets')
                .select('id')
                .eq('branch_id', existing.branch_id)
                .eq('outlet_type', existing.bar_location || 'main_bar')
                .maybeSingle();

            await recordBarStockMovement({
                branchId: existing.branch_id,
                outletId: outlet?.id || null,
                drinkId: existing.item_id,
                quantityDelta: -num(existing.quantity),
                movementType: 'waste',
                notes: `Approved spoilage: ${existing.reason || 'unspecified'}. Request ID: ${existing.id}`,
                performedBy: req.user?.id || null
            });
            // Write unified movement audit row for bar spoilage so stocktake
            // screens can include it under Deductions.
            await supabase.from('branch_stock_movements').insert({
                branch_id: existing.branch_id,
                item_sku: existing.item_sku || null,
                item_id: existing.item_id || null,
                movement_type: 'ADJUSTMENT_OUT',
                quantity: num(existing.quantity),
                reference: `SPOILAGE-${existing.id}`,
                reference_type: 'spoilage',
                reference_id: existing.id,
                notes: `Approved bar spoilage: ${existing.reason || 'unspecified'}`,
                performed_by: req.user?.id || null,
                created_by: req.user?.id || null,
            }).then(({ error: mvErr }) => {
                if (mvErr) logger.warn('branch_stock_movements insert failed (bar spoilage):', mvErr.message);
            });
        } else if (existing.area === 'store') {
            const { data: stockRow, error: stockErr } = await supabase
                .from('branch_stock')
                .select('quantity')
                .eq('branch_id', existing.branch_id)
                .eq('item_sku', existing.item_sku)
                .maybeSingle();
            if (stockErr) throw stockErr;
            const currentQty = num(stockRow?.quantity);
            if (currentQty < num(existing.quantity)) {
                res.status(400).json({
                    success: false,
                    message: `Insufficient branch stock to approve — available: ${currentQty}, requested: ${existing.quantity}`,
                });
                return;
            }
            const { error: updateErr } = await supabase
                .from('branch_stock')
                .update({ quantity: currentQty - num(existing.quantity) })
                .eq('branch_id', existing.branch_id)
                .eq('item_sku', existing.item_sku);
            if (updateErr) throw updateErr;
            // Write unified movement audit row so stocktake Deductions column
            // shows this spoilage deduction (previously invisible).
            await supabase.from('branch_stock_movements').insert({
                branch_id: existing.branch_id,
                item_sku: existing.item_sku || null,
                item_id: existing.item_id || null,
                movement_type: 'ADJUSTMENT_OUT',
                quantity: num(existing.quantity),
                reference: `SPOILAGE-${existing.id}`,
                reference_type: 'spoilage',
                reference_id: existing.id,
                notes: `Approved store spoilage: ${existing.reason || 'unspecified'}`,
                performed_by: req.user?.id || null,
                created_by: req.user?.id || null,
                previous_stock: currentQty,
                new_stock: currentQty - num(existing.quantity),
            }).then(({ error: mvErr }) => {
                if (mvErr) logger.warn('branch_stock_movements insert failed (store spoilage):', mvErr.message);
            });
        }
        // kitchen: no immediate stock table to adjust — approved rows are
        // summed at read-time in kitchen-stocktake.controller.ts.

        let creditBillId: string | null = null;
        if (existing.charge_to_staff && existing.responsible_staff_id) {
            let amount = num(existing.total_loss);
            if (amount <= 0) {
                // Fetch retail menu price if kitchen area
                const { data: menuItem } = await supabase
                    .from('restaurant_menu_items')
                    .select('price')
                    .ilike('name', existing.item_name)
                    .maybeSingle();
                if (menuItem?.price) {
                    amount = num(existing.quantity) * num(menuItem.price);
                } else {
                    // Fallback to 100 KES per unit to satisfy amount > 0
                    amount = num(existing.quantity) * 100;
                    if (amount <= 0) amount = 100;
                }
            }

            const description = `Salary deduction for spoiled/damaged stock: ${existing.item_name} (Qty: ${existing.quantity} ${existing.unit}, Area: ${existing.area})`;
            const { data: bill, error: billErr } = await supabase
                .from('staff_credit_bills')
                .insert({
                    branch_id: existing.branch_id,
                    staff_id: existing.responsible_staff_id,
                    amount: amount,
                    balance: amount,
                    paid_amount: 0,
                    description,
                    bill_date: new Date().toISOString().split('T')[0],
                    status: 'pending',
                })
                .select()
                .single();
            if (billErr) throw billErr;
            creditBillId = bill.id;
        }

        const now = new Date().toISOString();
        const updatePayload: any = {
            status: 'approved',
            reviewed_by: req.user?.id || null,
            reviewed_at: now,
            updated_at: now,
        };
        if (creditBillId) {
            updatePayload.credit_bill_id = creditBillId;
        }

        const { data, error } = await supabase
            .from('branch_spoilage_log')
            .update(updatePayload)
            .eq('id', req.params.id)
            .select()
            .single();
        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (error) {
        logger.error('approveSpoilage failed:', error);
        next(error);
    }
};

/**
 * @desc    Accountant rejects a spoilage record — requires notes. No stock
 *          effect, since nothing was applied while pending.
 * @route   PATCH /api/storekeeping/spoilage/:id/reject
 * @access  Branch Accountant, Super Admin
 */
export const rejectSpoilage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const existing = await loadSpoilage(req.params.id);
        if (!existing) {
            res.status(404).json({ success: false, message: 'Spoilage record not found' });
            return;
        }
        if (!String(req.body?.notes || '').trim()) {
            res.status(400).json({ success: false, message: 'notes are required when rejecting a spoilage record' });
            return;
        }
        if (existing.status !== 'pending') {
            res.status(400).json({ success: false, message: `Cannot reject a record that is ${existing.status}` });
            return;
        }

        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('branch_spoilage_log')
            .update({
                status: 'rejected',
                reviewed_by: req.user?.id || null,
                reviewed_at: now,
                rejection_reason: req.body.notes,
                updated_at: now,
            })
            .eq('id', req.params.id)
            .select()
            .single();
        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (error) {
        logger.error('rejectSpoilage failed:', error);
        next(error);
    }
};
