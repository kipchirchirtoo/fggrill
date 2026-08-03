import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Discounts & Offers controller.
 *
 * Offers are branch-manager-defined promotions that discount POS menu items
 * (restaurant / bar) or room rates. Active offers are surfaced at the POS till
 * as an "OFFER" tag and flow into the customer bill. See migration
 * 20260803_create_offers.sql for the schema.
 */

type OfferRow = {
    id: string;
    branch_id: number;
    name: string;
    description: string | null;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    target_type: 'menu_item' | 'menu_category' | 'outlet' | 'room_type' | 'all_rooms' | 'guest';
    item_kind: 'restaurant' | 'bar' | null;
    target_id: string | null;
    target_label: string | null;
    is_active: boolean;
    starts_on: string | null;
    ends_on: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
};

const TARGET_TYPES = ['menu_item', 'menu_category', 'outlet', 'room_type', 'all_rooms', 'guest'];
const DISCOUNT_TYPES = ['percentage', 'fixed'];

const toBranchId = (value: unknown): number | null => {
    const n = Number.parseInt(String(value ?? '').trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
};

const nullableText = (value: unknown): string | null => {
    const t = String(value ?? '').trim();
    return t.length ? t : null;
};

/** True when an offer is active today (respecting the optional date window). */
const isLiveToday = (offer: OfferRow, today: string): boolean => {
    if (!offer.is_active) return false;
    if (offer.starts_on && offer.starts_on > today) return false;
    if (offer.ends_on && offer.ends_on < today) return false;
    return true;
};

/**
 * Shared helper — active offers for a branch today. Reused by POS/room
 * annotation and the /offers/active endpoint.
 */
export const fetchActiveOffers = async (branchId: number): Promise<OfferRow[]> => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('offers')
        .select('*')
        .eq('branch_id', branchId)
        .eq('is_active', true);
    if (error) throw error;
    return ((data as OfferRow[]) || []).filter((o) => isLiveToday(o, today));
};

/**
 * @desc    List offers for a branch (management view)
 * @route   GET /api/offers?branch_id=&target_type=&active=
 * @access  Private (Branch Manager, General Manager, Super Admin)
 */
export const listOffers = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const branchId = toBranchId(req.query.branch_id ?? (req as any).user?.branchId);
        if (!branchId) {
            res.status(400).json({ success: false, message: 'branch_id is required' });
            return;
        }
        const { target_type, active } = req.query;

        let query = supabase
            .from('offers')
            .select('*')
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false });

        if (target_type && TARGET_TYPES.includes(String(target_type))) {
            query = query.eq('target_type', String(target_type));
        }
        if (active === 'true' || active === 'false') {
            query = query.eq('is_active', active === 'true');
        }

        const { data, error } = await query;
        if (error) throw error;

        res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
        logger.error('Error listing offers:', error);
        next(error);
    }
};

/**
 * @desc    Active offers for a branch today (consumed by POS + room rate views)
 * @route   GET /api/offers/active?branch_id=
 * @access  Private
 */
export const getActiveOffers = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const branchId = toBranchId(req.query.branch_id ?? (req as any).user?.branchId);
        if (!branchId) {
            res.status(400).json({ success: false, message: 'branch_id is required' });
            return;
        }
        const offers = await fetchActiveOffers(branchId);
        res.status(200).json({ success: true, data: offers });
    } catch (error) {
        logger.error('Error fetching active offers:', error);
        next(error);
    }
};

/**
 * @desc    Create an offer
 * @route   POST /api/offers
 * @access  Private (Branch Manager, General Manager, Super Admin)
 */
export const createOffer = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const body = req.body || {};
        const branchId = toBranchId(body.branch_id ?? (req as any).user?.branchId);
        if (!branchId) {
            res.status(400).json({ success: false, message: 'branch_id is required' });
            return;
        }

        const name = nullableText(body.name);
        const discountType = String(body.discount_type ?? '').trim();
        const discountValue = Number(body.discount_value);
        const targetType = String(body.target_type ?? '').trim();

        if (!name) {
            res.status(400).json({ success: false, message: 'name is required' });
            return;
        }
        if (!DISCOUNT_TYPES.includes(discountType)) {
            res.status(400).json({ success: false, message: 'discount_type must be percentage or fixed' });
            return;
        }
        if (!Number.isFinite(discountValue) || discountValue < 0) {
            res.status(400).json({ success: false, message: 'discount_value must be a non-negative number' });
            return;
        }
        if (discountType === 'percentage' && discountValue > 100) {
            res.status(400).json({ success: false, message: 'percentage discount cannot exceed 100' });
            return;
        }
        if (!TARGET_TYPES.includes(targetType)) {
            res.status(400).json({ success: false, message: 'invalid target_type' });
            return;
        }

        const itemKind = nullableText(body.item_kind);
        const needsKind = targetType === 'menu_item' || targetType === 'menu_category' || targetType === 'outlet';
        if (needsKind && itemKind !== 'restaurant' && itemKind !== 'bar') {
            res.status(400).json({ success: false, message: 'item_kind (restaurant|bar) is required for menu offers' });
            return;
        }
        const needsTargetId = targetType === 'menu_item' || targetType === 'menu_category' || targetType === 'room_type' || targetType === 'guest';
        const targetId = nullableText(body.target_id);
        if (needsTargetId && !targetId) {
            res.status(400).json({ success: false, message: 'target_id is required for this target_type' });
            return;
        }

        const insert = {
            branch_id: branchId,
            name,
            description: nullableText(body.description),
            discount_type: discountType,
            discount_value: discountValue,
            target_type: targetType,
            item_kind: needsKind ? itemKind : null,
            target_id: needsTargetId ? targetId : null,
            target_label: nullableText(body.target_label),
            is_active: body.is_active === undefined ? true : Boolean(body.is_active),
            starts_on: nullableText(body.starts_on),
            ends_on: nullableText(body.ends_on),
            created_by: (req as any).user?.id ?? null,
        };

        const { data, error } = await supabase.from('offers').insert(insert).select().single();
        if (error) throw error;

        res.status(201).json({ success: true, data });
    } catch (error) {
        logger.error('Error creating offer:', error);
        next(error);
    }
};

/**
 * @desc    Update an offer
 * @route   PUT /api/offers/:id
 * @access  Private (Branch Manager, General Manager, Super Admin)
 */
export const updateOffer = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const body = req.body || {};
        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (body.name !== undefined) update.name = nullableText(body.name);
        if (body.description !== undefined) update.description = nullableText(body.description);
        if (body.discount_type !== undefined) {
            if (!DISCOUNT_TYPES.includes(String(body.discount_type))) {
                res.status(400).json({ success: false, message: 'discount_type must be percentage or fixed' });
                return;
            }
            update.discount_type = String(body.discount_type);
        }
        if (body.discount_value !== undefined) {
            const v = Number(body.discount_value);
            if (!Number.isFinite(v) || v < 0) {
                res.status(400).json({ success: false, message: 'discount_value must be a non-negative number' });
                return;
            }
            update.discount_value = v;
        }
        if (body.target_type !== undefined) {
            if (!TARGET_TYPES.includes(String(body.target_type))) {
                res.status(400).json({ success: false, message: 'invalid target_type' });
                return;
            }
            update.target_type = String(body.target_type);
        }
        if (body.item_kind !== undefined) update.item_kind = nullableText(body.item_kind);
        if (body.target_id !== undefined) update.target_id = nullableText(body.target_id);
        if (body.target_label !== undefined) update.target_label = nullableText(body.target_label);
        if (body.is_active !== undefined) update.is_active = Boolean(body.is_active);
        if (body.starts_on !== undefined) update.starts_on = nullableText(body.starts_on);
        if (body.ends_on !== undefined) update.ends_on = nullableText(body.ends_on);

        const { data, error } = await supabase
            .from('offers')
            .update(update)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        if (!data) {
            res.status(404).json({ success: false, message: 'Offer not found' });
            return;
        }

        res.status(200).json({ success: true, data });
    } catch (error) {
        logger.error('Error updating offer:', error);
        next(error);
    }
};

/**
 * @desc    Toggle an offer's active flag
 * @route   PATCH /api/offers/:id/toggle
 * @access  Private (Branch Manager, General Manager, Super Admin)
 */
export const toggleOffer = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { data: existing, error: fetchError } = await supabase
            .from('offers')
            .select('is_active')
            .eq('id', id)
            .single();
        if (fetchError) throw fetchError;
        if (!existing) {
            res.status(404).json({ success: false, message: 'Offer not found' });
            return;
        }

        const { data, error } = await supabase
            .from('offers')
            .update({ is_active: !existing.is_active, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (error) {
        logger.error('Error toggling offer:', error);
        next(error);
    }
};

/**
 * @desc    Delete an offer
 * @route   DELETE /api/offers/:id
 * @access  Private (Branch Manager, General Manager, Super Admin)
 */
export const deleteOffer = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('offers').delete().eq('id', id);
        if (error) throw error;
        res.status(200).json({ success: true, message: 'Offer deleted' });
    } catch (error) {
        logger.error('Error deleting offer:', error);
        next(error);
    }
};
