import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

const getRequestedBranchId = (req: Request): number | string | null => {
    const user = (req as any).user || {};
    return (req.query.branch_id as string | undefined) ||
        user.branch_id ||
        user.branchId ||
        null;
};

const getScopedSupplierIds = async (
    req: Request,
    supplierId?: string
): Promise<string[] | null> => {
    const branchId = getRequestedBranchId(req);
    if (!branchId) return supplierId ? [supplierId] : null;

    let query = supabase
        .from('store_suppliers')
        .select('id')
        .eq('branch_id', branchId);

    if (supplierId) query = query.eq('id', supplierId);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((supplier: any) => supplier.id);
};

const fetchSuppliersById = async (supplierIds: string[]): Promise<Map<string, any>> => {
    const ids = [...new Set(supplierIds.filter(Boolean))];
    if (ids.length === 0) return new Map();

    const { data, error } = await supabase
        .from('store_suppliers')
        .select('id, name, supplier_code')
        .in('id', ids);

    if (error) throw error;
    return new Map((data || []).map((supplier: any) => [supplier.id, supplier]));
};

const toNumber = (value: any): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const getLedgerPaymentFallback = async (
    req: Request,
    scopedSupplierIds: string[] | null,
    supplierId?: string,
    status?: string,
    fromDate?: string,
    toDate?: string
): Promise<any[]> => {
    if (scopedSupplierIds && scopedSupplierIds.length === 0) return [];
    if (status && !['processed', 'posted', 'paid', 'approved'].includes(status.toLowerCase())) return [];

    let query = supabase
        .from('store_supplier_ledger')
        .select('*')
        .gt('credit_amount', 0)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

    if (supplierId) query = query.eq('supplier_id', supplierId);
    if (scopedSupplierIds) query = query.in('supplier_id', scopedSupplierIds);
    if (fromDate) query = query.gte('transaction_date', fromDate);
    if (toDate) query = query.lte('transaction_date', toDate);

    const { data: ledgerRows, error } = await query;
    if (error) throw error;

    const rows = (ledgerRows || []).filter((entry: any) => toNumber(entry.credit_amount) > 0);
    const supplierMap = await fetchSuppliersById(rows.map((entry: any) => entry.supplier_id));

    return rows.map((entry: any) => ({
        id: entry.payment_id || entry.id,
        ledger_entry_id: entry.id,
        payment_number: entry.reference_number || entry.payment_number || entry.id,
        supplier_id: entry.supplier_id,
        supplier: supplierMap.get(entry.supplier_id) || null,
        payment_date: entry.transaction_date || entry.created_at,
        payment_method: 'ledger',
        payment_amount: toNumber(entry.credit_amount),
        reference_number: entry.reference_number || '',
        notes: entry.description || entry.notes || '',
        status: entry.is_posted === false ? 'draft' : 'processed',
        created_at: entry.created_at,
        source: 'store_supplier_ledger',
    }));
};

// @desc    Get all supplier payments
// @route   GET /api/storekeeping/payments
// @access  Private
export const getPayments = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const supplierId = req.query.supplier_id as string | undefined;
        const status = req.query.status as string | undefined;
        const fromDate = req.query.from_date as string | undefined;
        const toDate = req.query.to_date as string | undefined;
        const scopedSupplierIds = await getScopedSupplierIds(req, supplierId);

        if (scopedSupplierIds && scopedSupplierIds.length === 0) {
            res.status(200).json({ success: true, count: 0, data: [] });
            return;
        }

        let query = supabase
            .from('store_supplier_payments')
            .select(`
                *,
                supplier:store_suppliers(id, name, supplier_code)
            `)
            .order('payment_date', { ascending: false });

        if (supplierId) query = query.eq('supplier_id', supplierId);
        if (scopedSupplierIds) query = query.in('supplier_id', scopedSupplierIds);
        if (status) query = query.eq('status', status);
        if (fromDate) query = query.gte('payment_date', fromDate);
        if (toDate) query = query.lte('payment_date', toDate);

        const { data: payments, error } = await query;

        if (error) throw error;

        const data = payments && payments.length > 0
            ? payments
            : await getLedgerPaymentFallback(
                req,
                scopedSupplierIds,
                supplierId,
                status,
                fromDate,
                toDate
            );

        res.status(200).json({
            success: true,
            count: data.length,
            data
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
