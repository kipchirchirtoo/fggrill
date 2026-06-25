import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

const toNumber = (value: any): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const userBranchId = (req: Request): number | null => {
    const raw = (req.query.branch_id ?? req.user?.branch_id ?? (req.user as any)?.branchId) as any;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const inactiveInvoiceStatuses = new Set(['cancelled', 'canceled', 'rejected', 'void']);

// @desc    Get GRNs that are physically received but not yet billed
// @route   GET /api/procurement/ready-to-bill
// @access  Private (Branch Accountant / Procurement)
export const getReadyToBillGRNs = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const branchId = userBranchId(req);
        const supplierId = req.query.supplier_id ? String(req.query.supplier_id) : null;

        let grnQuery = supabase
            .from('store_grn')
            .select(`
                *,
                supplier:store_suppliers(id, name, supplier_code, branch_id, phone, email),
                purchase_order:store_purchase_orders(id, po_number, branch_id, status, total_amount, source_module)
            `)
            .order('created_at', { ascending: false });

        if (supplierId) grnQuery = grnQuery.eq('supplier_id', supplierId);

        const { data: grns, error: grnError } = await grnQuery;
        if (grnError) throw grnError;

        const activeGrns = (grns || []).filter((grn: any) => String(grn.status || '').toLowerCase() !== 'cancelled');
        const branchGrns = activeGrns.filter((grn: any) => {
            if (!branchId) return true;
            const poBranch = Number(grn.purchase_order?.branch_id);
            const supplierBranch = Number(grn.supplier?.branch_id);
            return poBranch === branchId || (!Number.isFinite(poBranch) && supplierBranch === branchId);
        });

        if (branchGrns.length === 0) {
            res.status(200).json({ success: true, count: 0, data: [] });
            return;
        }

        const grnIds = branchGrns.map((grn: any) => grn.id);
        const { data: invoices, error: invoiceError } = await supabase
            .from('store_supplier_invoices')
            .select('id, grn_id, po_id, invoice_number, status, total_amount, amount_paid, balance_due')
            .in('grn_id', grnIds);
        if (invoiceError) throw invoiceError;

        const invoicedGrnIds = new Set(
            (invoices || [])
                .filter((invoice: any) => !inactiveInvoiceStatuses.has(String(invoice.status || '').toLowerCase()))
                .map((invoice: any) => invoice.grn_id)
        );
        const readyGrns = branchGrns.filter((grn: any) =>
            !invoicedGrnIds.has(grn.id) &&
            String(grn.payment_status || '').toLowerCase() !== 'paid'
        );

        if (readyGrns.length === 0) {
            res.status(200).json({ success: true, count: 0, data: [] });
            return;
        }

        const readyIds = readyGrns.map((grn: any) => grn.id);
        const { data: items, error: itemError } = await supabase
            .from('store_grn_items')
            .select('*')
            .in('grn_id', readyIds);
        if (itemError) throw itemError;

        const skus = [...new Set((items || []).map((item: any) => item.item_id).filter(Boolean))];
        const { data: itemDetails, error: detailError } = skus.length > 0
            ? await supabase
                .from('simple_items')
                .select('sku, item_name, description, unit_of_measure')
                .in('sku', skus)
            : { data: [], error: null } as any;
        if (detailError) throw detailError;

        const itemMap = new Map((itemDetails || []).map((item: any) => [item.sku, item]));
        const rows = readyGrns.map((grn: any) => {
            const grnItems = (items || [])
                .filter((item: any) => item.grn_id === grn.id)
                .map((item: any) => {
                    const detail: any = itemMap.get(item.item_id) || {};
                    const quantity = toNumber(item.quantity_accepted ?? item.accepted_quantity ?? item.quantity_received);
                    const unitPrice = toNumber(item.unit_price);
                    return {
                        ...item,
                        item_name: detail.item_name || detail.description || item.item_id,
                        unit_of_measure: detail.unit_of_measure || item.unit_of_measure || 'units',
                        quantity,
                        line_total: quantity * unitPrice
                    };
                });

            const totalValue = toNumber(grn.total_value) || grnItems.reduce((sum: number, item: any) => sum + toNumber(item.line_total), 0);
            return {
                ...grn,
                po_id: grn.po_id,
                po_number: grn.purchase_order?.po_number || grn.po_number || '',
                supplier_id: grn.supplier_id,
                supplier_name: grn.supplier?.name || '',
                supplier_code: grn.supplier?.supplier_code || '',
                received_date: grn.grn_date || grn.created_at,
                items: grnItems,
                item_count: grnItems.length,
                total_value: totalValue,
                finance_status: 'Ready to Bill'
            };
        });

        res.status(200).json({
            success: true,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        logger.error('Error fetching ready-to-bill GRNs:', error);
        next(error);
    }
};

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
            invoice_document_url,
            other_supplier_name,
            manual_supplier_pin
        } = req.body;

        const userId = req.user?.id;

        if (!invoice_number) {
            throw new AppError('Invoice number is required', 400);
        }

        if (!supplier_id && !other_supplier_name) {
            throw new AppError('Supplier or manual supplier name is required', 400);
        }

        let final_supplier_pin = manual_supplier_pin || null;
        let final_vat_registered = false;
        let final_vat_number = null;

        // 1. Get supplier details for VAT validation if supplier_id is provided
        if (supplier_id && supplier_id !== 'other') {
            const { data: supplier, error: supplierError } = await supabase
                .from('store_suppliers')
                .select('tax_id, vat_registered, vat_number')
                .eq('id', supplier_id)
                .single();

            if (supplierError || !supplier) throw new AppError('Supplier not found', 404);

            final_supplier_pin = supplier.tax_id;
            final_vat_registered = supplier.vat_registered;
            final_vat_number = supplier.vat_number;
        }

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

        // Calculate totals from items
        const calculated_vat_amount = (items || []).reduce((sum: number, item: any) =>
            sum + ((item.quantity * item.unit_price) * ((item.vat_rate ?? 16.00) / 100)), 0);
        const calculated_subtotal = (items || []).reduce((sum: number, item: any) =>
            sum + (item.quantity * item.unit_price), 0);
        const calculated_total_amount = calculated_subtotal + calculated_vat_amount;

        // 3. Create invoice header
        const { data: newInvoice, error: invError } = await supabase
            .from('store_supplier_invoices')
            .insert({
                invoice_number,
                supplier_id: (supplier_id === 'other' || !supplier_id) ? null : supplier_id,
                other_supplier_name: (supplier_id === 'other' || !supplier_id) ? other_supplier_name : null,
                grn_id,
                po_id,
                invoice_date,
                due_date,
                supplier_pin: final_supplier_pin || 'N/A',
                supplier_vat_registered: final_vat_registered,
                supplier_vat_number: final_vat_number,
                subtotal: subtotal || calculated_subtotal,
                vat_rate_type: vat_rate_type || 'standard_16',
                vat_amount: calculated_vat_amount,
                total_amount: calculated_total_amount,
                balance_due: calculated_total_amount,
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
                supplier_invoice_id: newInvoice.id,
                item_id: item.item_id,
                goods_receipt_line_id: item.grn_item_id || item.goods_receipt_line_id || null,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit || 'units',
                unit_price: item.unit_price,
                line_total: (item.quantity * item.unit_price) * (1 + ((item.vat_rate ?? 0) / 100))
            }));

            const { error: itemsError } = await supabase
                .from('store_supplier_invoice_items')
                .insert(invItems);

            if (itemsError) {
                const { error } = await supabase.from('store_supplier_invoices').delete().eq('id', newInvoice.id);
                if (error) {
                  console.error('Database error:', error);
                  throw error;
                }
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
