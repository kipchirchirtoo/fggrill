import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

type SupplierRow = {
    id: string;
    name?: string | null;
    supplier_code?: string | null;
    payment_terms_days?: number | string | null;
};

type AgingAccumulator = {
    supplier_id: string;
    supplier?: SupplierRow;
    supplier_name: string;
    supplier_code: string;
    current: number;
    days_1_30: number;
    days_31_60: number;
    days_61_90: number;
    days_90_plus: number;
    total_balance: number;
    total_invoices: number;
    total_payments: number;
    open_purchase_orders: number;
    last_invoice_date: string | null;
    last_payment_date: string | null;
    source: string;
};

const toNumber = (value: any): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDate = (value: any): Date | null => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const addDays = (date: Date, days: number): Date => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const daysBetween = (start: Date, end: Date): number => {
    const startDay = new Date(start);
    const endDay = new Date(end);
    startDay.setHours(0, 0, 0, 0);
    endDay.setHours(0, 0, 0, 0);
    return Math.floor((endDay.getTime() - startDay.getTime()) / 86400000);
};

const parsePaymentTermsDays = (terms: any, supplier?: SupplierRow): number => {
    if (typeof terms === 'number') return terms;
    const text = `${terms || ''}`.toLowerCase();
    if (text.includes('cash') || text.includes('cod')) return 0;
    const match = text.match(/(\d+)/);
    if (match) return Number(match[1]);
    return toNumber(supplier?.payment_terms_days) || 30;
};

const createAgingAccumulator = (supplierId: string, supplier?: SupplierRow): AgingAccumulator => ({
    supplier_id: supplierId,
    supplier,
    supplier_name: supplier?.name || '',
    supplier_code: supplier?.supplier_code || '',
    current: 0,
    days_1_30: 0,
    days_31_60: 0,
    days_61_90: 0,
    days_90_plus: 0,
    total_balance: 0,
    total_invoices: 0,
    total_payments: 0,
    open_purchase_orders: 0,
    last_invoice_date: null,
    last_payment_date: null,
    source: 'ledger',
});

const applyAgingBucket = (
    row: AgingAccumulator,
    amount: number,
    dueDate: Date | null,
    today = new Date()
): void => {
    if (amount <= 0) return;
    const overdueDays = dueDate ? daysBetween(dueDate, today) : 0;
    if (overdueDays <= 0) row.current += amount;
    else if (overdueDays <= 30) row.days_1_30 += amount;
    else if (overdueDays <= 60) row.days_31_60 += amount;
    else if (overdueDays <= 90) row.days_61_90 += amount;
    else row.days_90_plus += amount;
    row.total_balance += amount;
};

const finalizeAgingRow = (row: AgingAccumulator): AgingAccumulator & Record<string, any> => ({
    ...row,
    current_balance: row.total_balance,
    current_amount: row.current,
    days_30_amount: row.days_1_30,
    days_60_amount: row.days_31_60,
    days_90_amount: row.days_61_90,
    days_90_plus_amount: row.days_90_plus,
    outstanding_amount: row.total_balance,
    balance: row.total_balance,
});

const normalizeBalanceRow = (row: any): Record<string, any> => {
    const current = toNumber(row.current_amount);
    const days30 = toNumber(row.days_30_amount);
    const days60 = toNumber(row.days_60_amount);
    const days90Plus = toNumber(row.days_90_plus_amount);
    const total = toNumber(row.current_balance || current + days30 + days60 + days90Plus);

    return {
        ...row,
        current,
        days_1_30: days30,
        days_31_60: days60,
        days_61_90: 0,
        days_90_plus: days90Plus,
        total_balance: total,
        outstanding_amount: total,
        balance: total,
        source: row.source || 'supplier_balances',
    };
};

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

const fetchSuppliersById = async (supplierIds: string[]): Promise<Map<string, SupplierRow>> => {
    const ids = [...new Set(supplierIds.filter(Boolean))];
    if (ids.length === 0) return new Map();

    const { data, error } = await supabase
        .from('store_suppliers')
        .select('id, name, supplier_code, payment_terms_days')
        .in('id', ids);

    if (error) throw error;
    return new Map((data || []).map((supplier: any) => [supplier.id, supplier as SupplierRow]));
};

const buildAgingFromInvoices = async (
    req: Request,
    scopedSupplierIds: string[] | null,
    supplierId?: string
): Promise<Array<AgingAccumulator & Record<string, any>>> => {
    if (scopedSupplierIds && scopedSupplierIds.length === 0) return [];

    let query = supabase
        .from('store_supplier_invoices')
        .select('id, supplier_id, invoice_number, invoice_date, due_date, total_amount, amount_paid, balance_due, status')
        .order('due_date', { ascending: true });

    if (supplierId) query = query.eq('supplier_id', supplierId);
    if (scopedSupplierIds) query = query.in('supplier_id', scopedSupplierIds);

    const { data: invoices, error } = await query;
    if (error) throw error;

    const openInvoices = (invoices || []).filter((invoice: any) => {
        const status = `${invoice.status || ''}`.toLowerCase();
        if (['paid', 'void', 'voided', 'cancelled', 'rejected'].includes(status)) return false;
        return toNumber(invoice.balance_due ?? invoice.total_amount) > 0;
    });

    const supplierMap = await fetchSuppliersById(openInvoices.map((invoice: any) => invoice.supplier_id));
    const rows = new Map<string, AgingAccumulator>();

    for (const invoice of openInvoices) {
        const supplier = supplierMap.get(invoice.supplier_id);
        const row = rows.get(invoice.supplier_id) || createAgingAccumulator(invoice.supplier_id, supplier);
        row.source = 'supplier_invoices';
        const balance = toNumber(invoice.balance_due ?? invoice.total_amount);
        applyAgingBucket(row, balance, normalizeDate(invoice.due_date || invoice.invoice_date));
        row.total_invoices += toNumber(invoice.total_amount || balance);
        const paid = toNumber(invoice.amount_paid);
        row.total_payments += paid;
        const invoiceDate = invoice.invoice_date || null;
        if (invoiceDate && (!row.last_invoice_date || invoiceDate > row.last_invoice_date)) {
            row.last_invoice_date = invoiceDate;
        }
        rows.set(invoice.supplier_id, row);
    }

    return Array.from(rows.values()).map(finalizeAgingRow);
};

const buildAgingFromPurchaseOrders = async (
    req: Request,
    scopedSupplierIds: string[] | null,
    supplierId?: string
): Promise<Array<AgingAccumulator & Record<string, any>>> => {
    if (scopedSupplierIds && scopedSupplierIds.length === 0) return [];

    let query = supabase
        .from('store_purchase_orders')
        .select('id, po_number, supplier_id, po_date, expected_delivery_date, total_amount, status, payment_terms, created_at, branch_id, source_module')
        .order('created_at', { ascending: false });

    if (supplierId) query = query.eq('supplier_id', supplierId);
    if (scopedSupplierIds) query = query.in('supplier_id', scopedSupplierIds);

    const { data: purchaseOrders, error } = await query;
    if (error) throw error;

    const openOrders = (purchaseOrders || []).filter((po: any) => {
        const status = `${po.status || ''}`.toLowerCase();
        if (['cancelled', 'rejected', 'void', 'voided'].includes(status)) return false;
        return toNumber(po.total_amount) > 0 && po.supplier_id;
    });

    const supplierMap = await fetchSuppliersById(openOrders.map((po: any) => po.supplier_id));
    const rows = new Map<string, AgingAccumulator>();

    for (const po of openOrders) {
        const supplier = supplierMap.get(po.supplier_id);
        const row = rows.get(po.supplier_id) || createAgingAccumulator(po.supplier_id, supplier);
        row.source = 'purchase_orders';
        const amount = toNumber(po.total_amount);
        const baseDate = normalizeDate(po.expected_delivery_date || po.po_date || po.created_at);
        const dueDate = baseDate ? addDays(baseDate, parsePaymentTermsDays(po.payment_terms, supplier)) : null;
        applyAgingBucket(row, amount, dueDate);
        row.total_invoices += amount;
        row.open_purchase_orders += 1;
        const activityDate = po.po_date || po.created_at || null;
        if (activityDate && (!row.last_invoice_date || activityDate > row.last_invoice_date)) {
            row.last_invoice_date = activityDate;
        }
        rows.set(po.supplier_id, row);
    }

    return Array.from(rows.values()).map(finalizeAgingRow);
};

// @desc    Get supplier aging analysis
// @route   GET /api/procurement/reports/aging
// @access  Private (Auditor/Finance)
export const getAgingAnalysis = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const supplierId = req.query.supplier_id as string | undefined;
        const scopedSupplierIds = await getScopedSupplierIds(req, supplierId);

        let query = supabase
            .from('store_supplier_balances')
            .select(`
                *,
                supplier:store_suppliers(id, name, supplier_code)
            `)
            .order('current_balance', { ascending: false });

        if (supplierId) query = query.eq('supplier_id', supplierId);
        if (scopedSupplierIds) {
            if (scopedSupplierIds.length === 0) {
                res.status(200).json({ success: true, count: 0, data: [] });
                return;
            }
            query = query.in('supplier_id', scopedSupplierIds);
        }

        const { data: aging, error } = await query;

        if (error) throw error;

        if (aging && aging.length > 0) {
            const normalizedAging = aging.map(normalizeBalanceRow);
            res.status(200).json({
                success: true,
                count: normalizedAging.length,
                data: normalizedAging
            });
            return;
        }

        const invoiceAging = await buildAgingFromInvoices(req, scopedSupplierIds, supplierId);
        if (invoiceAging.length > 0) {
            res.status(200).json({
                success: true,
                count: invoiceAging.length,
                data: invoiceAging
            });
            return;
        }

        const purchaseOrderAging = await buildAgingFromPurchaseOrders(req, scopedSupplierIds, supplierId);
        res.status(200).json({
            success: true,
            count: purchaseOrderAging.length,
            data: purchaseOrderAging
        });
    } catch (error) {
        logger.error('Error fetching aging analysis:', error);
        next(new AppError('Failed to fetch aging analysis', 500));
    }
};

// @desc    Get VAT report (Input VAT)
// @route   GET /api/procurement/reports/vat
// @access  Private (Auditor/Finance)
export const getVATReport = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { from_date, to_date, supplier_id } = req.query;

        if (!from_date || !to_date) {
            throw new AppError('From date and to date are required', 400);
        }

        let query = supabase
            .from('store_supplier_invoices')
            .select(`
                invoice_number,
                invoice_date,
                supplier:store_suppliers(id, name, tax_id, vat_number),
                subtotal,
                vat_amount,
                withholding_vat_amount,
                total_amount,
                status
            `)
            .eq('status', 'approved')
            .gte('invoice_date', from_date)
            .lte('invoice_date', to_date);

        if (supplier_id) query = query.eq('supplier_id', supplier_id);

        const { data: report, error } = await query;

        if (error) throw error;

        // Calculate totals
        const summary = report?.reduce((acc: any, inv: any) => ({
            total_subtotal: acc.total_subtotal + Number(inv.subtotal),
            total_vat: acc.total_vat + Number(inv.vat_amount),
            total_withholding: acc.total_withholding + Number(inv.withholding_vat_amount),
            total_combined: acc.total_combined + Number(inv.total_amount)
        }), { total_subtotal: 0, total_vat: 0, total_withholding: 0, total_combined: 0 });

        res.status(200).json({
            success: true,
            summary,
            count: report?.length || 0,
            data: report || []
        });
    } catch (error) {
        logger.error('Error fetching VAT report:', error);
        next(new AppError('Failed to fetch VAT report', 500));
    }
};

// @desc    Get GRNI (Goods Received Not Invoiced) report
// @route   GET /api/procurement/reports/grni
// @access  Private (Auditor)
export const getGRNIReport = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { status } = req.query;

        let query = supabase
            .from('store_grni_control_account')
            .select(`
                *,
                supplier:store_suppliers(id, name, supplier_code),
                grn:store_grn(id, grn_number, grn_date)
            `)
            .order('created_at', { ascending: false });

        if (status) query = query.eq('status', status);
        else query = query.eq('status', 'open');

        const { data: grni, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            count: grni?.length || 0,
            data: grni || []
        });
    } catch (error) {
        logger.error('Error fetching GRNI report:', error);
        next(new AppError('Failed to fetch GRNI report', 500));
    }
};

// @desc    Get Audit Trail for Procurement
// @route   GET /api/procurement/reports/audit-trail
// @access  Private (Auditor)
export const getAuditTrail = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { entity_type, entity_id, from_date, to_date, supplier_id } = req.query;

        let query = supabase
            .from('store_procurement_audit_logs')
            .select('*')
            .order('action_timestamp', { ascending: false });

        if (entity_type) query = query.eq('entity_type', entity_type);
        if (entity_id) query = query.eq('entity_id', entity_id);
        if (supplier_id) query = query.eq('supplier_id', supplier_id);
        if (from_date) query = query.gte('action_timestamp', from_date);
        if (to_date) query = query.lte('action_timestamp', to_date);

        const { data: logs, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            count: logs?.length || 0,
            data: logs || []
        });
    } catch (error) {
        logger.error('Error fetching audit trail:', error);
        next(new AppError('Failed to fetch audit trail', 500));
    }
};

// @desc    Get detailed supplier ledger
// @route   GET /api/procurement/ledger/:supplierId
// @access  Private
export const getSupplierLedger = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { supplierId } = req.params;

        // Build ledger from actual transaction tables since store_supplier_ledger doesn't exist
        const ledgerEntries: any[] = [];

        // 1. Get GRNs (Goods Received Notes)
        // Note: store_grn table has po_id column but may need to join to get it
        const { data: grns, error: grnError } = await supabase
            .from('store_grn')
            .select('id, grn_number, grn_date, created_at, total_value, total_quantity, status, invoice_number, po_id')
            .eq('supplier_id', supplierId)
            .order('grn_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(100);

        if (grnError) {
            // If po_id column doesn't exist in this schema version, fetch without it
            if (grnError.code === '42703' && grnError.message?.includes('po_id')) {
                logger.warn('store_grn.po_id column not found, fetching GRNs without PO reference');
                const { data: grnsWithoutPo, error: retryError } = await supabase
                    .from('store_grn')
                    .select('id, grn_number, grn_date, created_at, total_value, total_quantity, status, invoice_number')
                    .eq('supplier_id', supplierId)
                    .order('grn_date', { ascending: false })
                    .order('created_at', { ascending: false })
                    .limit(100);

                if (retryError) throw retryError;

                (grnsWithoutPo || []).forEach((grn: any) => {
                    ledgerEntries.push({
                        id: `grn:${grn.id}`,
                        source_type: 'grn',
                        grn_id: grn.id,
                        transaction_date: grn.grn_date || grn.created_at,
                        transaction_type: 'goods_received',
                        reference_number: grn.grn_number,
                        description: `GRN received${grn.invoice_number ? ` / Invoice ${grn.invoice_number}` : ''}`,
                        debit_amount: Number(grn.total_value || 0),
                        credit_amount: 0,
                        running_balance: null,
                        status: grn.status,
                        quantity: grn.total_quantity
                    });
                });
            } else {
                throw grnError;
            }
        } else {
            // Get PO numbers for GRNs
            const poIds = (grns || []).map(g => g.po_id).filter(Boolean);
            const { data: pos } = poIds.length > 0 ? await supabase
                .from('store_purchase_orders')
                .select('id, po_number')
                .in('id', poIds) : { data: [] };
            
            const poMap = new Map((pos || []).map(po => [po.id, po]));

            (grns || []).forEach((grn: any) => {
                const po = poMap.get(grn.po_id);
                ledgerEntries.push({
                    id: `grn:${grn.id}`,
                    source_type: 'grn',
                    grn_id: grn.id,
                    transaction_date: grn.grn_date || grn.created_at,
                    transaction_type: 'goods_received',
                    reference_number: grn.grn_number,
                    description: `GRN received${po?.po_number ? ` for PO ${po.po_number}` : ''}${grn.invoice_number ? ` / Invoice ${grn.invoice_number}` : ''}`,
                    debit_amount: Number(grn.total_value || 0),
                    credit_amount: 0,
                    running_balance: null,
                    status: grn.status,
                    quantity: grn.total_quantity
                });
            });
        }

        // 2. Get Supplier Invoices
        const { data: invoices, error: invoiceError } = await supabase
            .from('store_supplier_invoices')
            .select('id, invoice_number, invoice_date, total_amount, amount_paid, status, created_at')
            .eq('supplier_id', supplierId)
            .order('invoice_date', { ascending: false })
            .limit(100);

        if (invoiceError) throw invoiceError;

        (invoices || []).forEach((invoice: any) => {
            ledgerEntries.push({
                id: `invoice:${invoice.id}`,
                source_type: 'invoice',
                invoice_id: invoice.id,
                transaction_date: invoice.invoice_date || invoice.created_at,
                transaction_type: 'invoice',
                reference_number: invoice.invoice_number,
                description: `Supplier Invoice ${invoice.invoice_number}`,
                debit_amount: Number(invoice.total_amount || 0),
                credit_amount: 0,
                running_balance: null,
                status: invoice.status,
                amount_paid: Number(invoice.amount_paid || 0)
            });
        });

        // 3. Get Purchase Orders (for context)
        const { data: purchaseOrders, error: poError } = await supabase
            .from('store_purchase_orders')
            .select('id, po_number, po_date, total_amount, status, created_at')
            .eq('supplier_id', supplierId)
            .order('po_date', { ascending: false })
            .limit(50);

        if (poError) throw poError;

        (purchaseOrders || []).forEach((po: any) => {
            ledgerEntries.push({
                id: `po:${po.id}`,
                source_type: 'purchase_order',
                po_id: po.id,
                transaction_date: po.po_date || po.created_at,
                transaction_type: 'purchase_order',
                reference_number: po.po_number,
                description: `Purchase Order ${po.po_number}`,
                debit_amount: 0,
                credit_amount: 0,
                running_balance: null,
                status: po.status,
                po_amount: Number(po.total_amount || 0)
            });
        });

        // Sort all entries by date descending
        const sortedLedger = ledgerEntries.sort((a: any, b: any) => {
            const dateA = Date.parse(a.transaction_date || a.created_at || '') || 0;
            const dateB = Date.parse(b.transaction_date || b.created_at || '') || 0;
            if (dateA !== dateB) return dateB - dateA;
            return String(b.id || '').localeCompare(String(a.id || ''));
        });

        res.status(200).json({
            success: true,
            data: sortedLedger
        });
    } catch (error) {
        logger.error('Error fetching supplier ledger:', error);
        next(new AppError('Failed to fetch supplier ledger', 500));
    }
};

// @desc    Get supplier performance metrics
// @route   GET /api/procurement/performance/:supplierId
// @access  Private
export const getSupplierPerformance = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { supplierId } = req.params;
        const scopedSupplierIds = await getScopedSupplierIds(req, supplierId);

        const { data: performance, error } = await supabase
            .from('store_supplier_balances')
            .select('*')
            .eq('supplier_id', supplierId)
            .maybeSingle();

        if (error) throw error;

        if (performance) {
            res.status(200).json({
                success: true,
                data: normalizeBalanceRow(performance)
            });
            return;
        }

        const invoiceAging = await buildAgingFromInvoices(req, scopedSupplierIds, supplierId);
        const poAging = invoiceAging.length > 0
            ? invoiceAging
            : await buildAgingFromPurchaseOrders(req, scopedSupplierIds, supplierId);

        res.status(200).json({
            success: true,
            data: poAging[0] || {
                supplier_id: supplierId,
                current_balance: 0,
                total_invoices: 0,
                total_payments: 0,
                current_amount: 0,
                days_30_amount: 0,
                days_60_amount: 0,
                days_90_plus_amount: 0
            }
        });
    } catch (error) {
        logger.error('Error fetching supplier performance:', error);
        next(new AppError('Failed to fetch supplier performance', 500));
    }
};
