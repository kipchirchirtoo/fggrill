import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

// @desc    Get all supplier invoices
// @route   GET /api/storekeeping/invoices
// @access  Private
export const getInvoices = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { supplier_id, status, from_date, to_date } = req.query;

        let query = supabase
            .from('store_supplier_invoices')
            .select(`
                *,
                supplier:store_suppliers(id, name, tax_id, supplier_code),
                po:store_purchase_orders(id, po_number),
                grn:store_grn(id, grn_number)
            `)
            .order('invoice_date', { ascending: false });

        if (supplier_id) query = query.eq('supplier_id', supplier_id);
        if (status) query = query.eq('status', status);
        if (from_date) query = query.gte('invoice_date', from_date);
        if (to_date) query = query.lte('invoice_date', to_date);

        const { data: invoices, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            count: invoices?.length || 0,
            data: invoices || []
        });
    } catch (error) {
        logger.error('Error fetching invoices:', error);
        next(new AppError('Failed to fetch invoices', 500));
    }
};

// @desc    Get single supplier invoice
// @route   GET /api/storekeeping/invoices/:id
// @access  Private
export const getInvoice = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const { data: invoice, error } = await supabase
            .from('store_supplier_invoices')
            .select(`
                *,
                supplier:store_suppliers(*),
                po:store_purchase_orders(*),
                grn:store_grn(*),
                items:store_supplier_invoice_items(
                    *,
                    item:store_items(id, name, item_code, unit)
                ),
                grni_entry:store_grni_control_account(*)
            `)
            .eq('id', id)
            .single();

        if (error || !invoice) {
            throw new AppError('Invoice not found', 404);
        }

        res.status(200).json({
            success: true,
            data: invoice
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new supplier invoice
// @route   POST /api/storekeeping/invoices
// @access  Private (Procurement)
export const createInvoice = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            invoice_number,
            supplier_id,
            grn_id,
            po_id,
            invoice_date,
            due_date,
            subtotal,
            vat_rate_type,
            notes,
            items,
            invoice_document_url
        } = req.body;

        const userId = req.user?.id;

        if (!supplier_id || !invoice_number || (!grn_id && !po_id)) {
            throw new AppError('Supplier, invoice number, and either GRN or PO are required', 400);
        }

        // 1. Get supplier details for VAT validation
        const { data: supplier, error: supplierError } = await supabase
            .from('store_suppliers')
            .select('tax_id, vat_registered, vat_number')
            .eq('id', supplier_id)
            .single();

        if (supplierError || !supplier) throw new AppError('Supplier not found', 404);

        // 2. If GRN provided, find GRNI entry
        let grni_cleared_id = null;
        if (grn_id) {
            const { data: grni, error: grniError } = await supabase
                .from('store_grni_control_account')
                .select('id')
                .eq('grn_id', grn_id)
                .eq('status', 'open')
                .single();

            if (grni) {
                grni_cleared_id = grni.id;
            }
        }

        // 3. Create invoice header
        const { data: newInvoice, error: invError } = await supabase
            .from('store_supplier_invoices')
            .insert({
                invoice_number,
                supplier_id,
                grn_id,
                po_id,
                invoice_date,
                due_date,
                supplier_pin: supplier.tax_id,
                supplier_vat_registered: supplier.vat_registered,
                supplier_vat_number: supplier.vat_number,
                subtotal,
                vat_rate_type: vat_rate_type || 'standard_16',
                grni_cleared_id,
                notes,
                invoice_document_url,
                created_by_id: userId,
                status: 'draft'
            })
            .select()
            .single();

        if (invError) throw invError;

        // 4. Create invoice items
        if (items && items.length > 0) {
            const invItems = items.map((item: any) => ({
                invoice_id: newInvoice.id,
                item_id: item.item_id,
                grn_item_id: item.grn_item_id,
                po_item_id: item.po_item_id,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: item.quantity * item.unit_price,
                vat_rate: item.vat_rate || 16.00,
                vat_amount: (item.quantity * item.unit_price) * (item.vat_rate || 16.00) / 100,
                total_amount: (item.quantity * item.unit_price) * (1 + (item.vat_rate || 16.00) / 100)
            }));

            const { error: itemsError } = await supabase
                .from('store_supplier_invoice_items')
                .insert(invItems);

            if (itemsError) {
                await supabase.from('store_supplier_invoices').delete().eq('id', newInvoice.id);
                throw itemsError;
            }
        }

        res.status(201).json({
            success: true,
            data: newInvoice
        });
    } catch (error) {
        logger.error('Error creating invoice:', error);
        next(error);
    }
};

// @desc    Submit invoice for approval
// @route   PUT /api/storekeeping/invoices/:id/submit
// @access  Private
export const submitInvoice = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        const { data: invoice, error } = await supabase
            .from('store_supplier_invoices')
            .update({
                status: 'submitted',
                submitted_by_id: userId,
                submitted_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            message: 'Invoice submitted for approval',
            data: invoice
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Approve supplier invoice
// @route   PUT /api/storekeeping/invoices/:id/approve
// @access  Private (Auditor)
export const approveInvoice = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        // Use a database function for auditability and atomicity
        // This function will also clear GRNI and update supplier ledger
        const { data, error } = await supabase
            .rpc('approve_supplier_invoice_and_update_ledger', {
                p_invoice_id: id,
                p_approved_by: userId
            });

        if (error) {
            logger.error('Error approving invoice:', error);
            throw new AppError(error.message, 400);
        }

        res.status(200).json({
            success: true,
            message: 'Invoice approved and ledger updated',
            data
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Reject supplier invoice
// @route   PUT /api/storekeeping/invoices/:id/reject
// @access  Private (Auditor)
export const rejectInvoice = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user?.id;

        if (!reason) throw new AppError('Rejection reason is required', 400);

        const { data, error } = await supabase
            .from('store_supplier_invoices')
            .update({
                status: 'rejected',
                rejected_by_id: userId,
                rejected_at: new Date().toISOString(),
                rejection_reason: reason,
                is_locked: false // Unlock for correction
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            message: 'Invoice rejected',
            data
        });
    } catch (error) {
        next(error);
    }
};
