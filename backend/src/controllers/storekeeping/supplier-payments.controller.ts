import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

// @desc    Get all supplier payments
// @route   GET /api/storekeeping/payments
// @access  Private
export const getPayments = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { supplier_id, status, from_date, to_date } = req.query;

        let query = supabase
            .from('store_supplier_payments')
            .select(`
                *,
                supplier:store_suppliers(id, name, supplier_code)
            `)
            .order('payment_date', { ascending: false });

        if (supplier_id) query = query.eq('supplier_id', supplier_id);
        if (status) query = query.eq('status', status);
        if (from_date) query = query.gte('payment_date', from_date);
        if (to_date) query = query.lte('payment_date', to_date);

        const { data: payments, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            count: payments?.length || 0,
            data: payments || []
        });
    } catch (error) {
        logger.error('Error fetching payments:', error);
        next(new AppError('Failed to fetch payments', 500));
    }
};

// @desc    Get single supplier payment
// @route   GET /api/storekeeping/payments/:id
// @access  Private
export const getPayment = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const { data: payment, error } = await supabase
            .from('store_supplier_payments')
            .select(`
                *,
                supplier:store_suppliers(*),
                allocations:store_payment_invoice_allocations(
                    *,
                    invoice:store_supplier_invoices(id, invoice_number, total_amount, balance_due)
                )
            `)
            .eq('id', id)
            .single();

        if (error || !payment) {
            throw new AppError('Payment not found', 404);
        }

        res.status(200).json({
            success: true,
            data: payment
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new supplier payment
// @route   POST /api/storekeeping/payments
// @access  Private (Procurement/Finance)
export const createPayment = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            supplier_id,
            payment_date,
            payment_method,
            payment_amount,
            reference_number,
            notes,
            allocations // Array of { invoice_id, amount }
        } = req.body;

        const userId = req.user?.id;

        if (!supplier_id || !payment_amount || !payment_method) {
            throw new AppError('Supplier, amount, and method are required', 400);
        }

        // Generate payment number
        const { data: payment_number, error: numberError } = await supabase
            .rpc('generate_payment_number');

        if (numberError) throw numberError;

        // 1. Create payment header
        const { data: newPayment, error: payError } = await supabase
            .from('store_supplier_payments')
            .insert({
                payment_number,
                supplier_id,
                payment_date: payment_date || new Date().toISOString().split('T')[0],
                payment_method,
                payment_amount,
                reference_number,
                notes,
                created_by_id: userId,
                status: 'draft'
            })
            .select()
            .single();

        if (payError) throw payError;

        // 2. Create allocations if provided
        if (allocations && allocations.length > 0) {
            const payAllocations = allocations.map((alloc: any) => ({
                payment_id: newPayment.id,
                invoice_id: alloc.invoice_id,
                allocated_amount: alloc.amount,
                notes: alloc.notes
            }));

            const { error: allocError } = await supabase
                .from('store_payment_invoice_allocations')
                .insert(payAllocations);

            if (allocError) {
                // Not rolling back payment header as it's useful to keep draft even if allocation fails
                logger.error('Error creating payment allocations:', allocError);
            }
        }

        res.status(201).json({
            success: true,
            data: newPayment
        });
    } catch (error) {
        logger.error('Error creating payment:', error);
        next(error);
    }
};

// @desc    Process supplier payment
// @route   PUT /api/storekeeping/payments/:id/process
// @access  Private (Auditor/Finance)
export const processPayment = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        // Update status to processed
        // This will trigger create_payment_journal_entry and post_payment_to_ledger
        const { data: payment, error } = await supabase
            .from('store_supplier_payments')
            .update({
                status: 'processed',
                processed_by_id: userId,
                processed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            message: 'Payment processed and ledger updated',
            data: payment
        });
    } catch (error) {
        next(error);
    }
};
