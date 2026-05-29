import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';

export const recordSale = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, quantity, tokens_sold, amount_per_token, amount, payment_method, notes } = req.body;
        const user_id = (req as any).user?.id;

        const finalQuantity = quantity || tokens_sold;
        const finalAmountPerToken = amount_per_token || (amount && finalQuantity ? amount / finalQuantity : 50);
        const finalPaymentMethod = payment_method || 'cash';

        if (!finalQuantity) {
            res.status(400).json({ success: false, message: 'Quantity is required' });
            return;
        }

        const { data, error } = await supabase
            .from('restaurant_pool_token_sales')
            .insert({
                branch_id,
                quantity: finalQuantity,
                amount_per_token: finalAmountPerToken,
                payment_method: finalPaymentMethod,
                cashier_id: user_id,
                audit_notes: notes,
                status: 'pending_audit'
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getSales = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, status } = req.query;

        let query = supabase
            .from('restaurant_pool_token_sales')
            .select('*')
            .order('created_at', { ascending: false });

        if (branch_id) query = query.eq('branch_id', branch_id);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;

        if (error) throw error;

        const cashierIds = [...new Set((data || []).map((sale: any) => sale.cashier_id).filter(Boolean))];
        const { data: cashiers, error: cashierError } = cashierIds.length
            ? await supabase.from('users').select('id, first_name, last_name').in('id', cashierIds)
            : { data: [], error: null };

        if (cashierError) throw cashierError;

        const cashierMap = new Map((cashiers || []).map((cashier: any) => [cashier.id, cashier]));
        const enriched = (data || []).map((sale: any) => ({
            ...sale,
            cashier: sale.cashier_id ? cashierMap.get(sale.cashier_id) || null : null
        }));

        res.status(200).json({ success: true, data: enriched });
    } catch (error) {
        next(error);
    }
};
