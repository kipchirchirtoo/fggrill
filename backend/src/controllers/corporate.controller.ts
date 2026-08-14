import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { applyBranchFilter } from '../utils/branchIsolation';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// Auto-process corporate bills whose credit term days have matured.
// Single-flight + throttle: this is a heavy WRITE batch (it inserts invoices)
// that must never block a corporate GET request. It used to be awaited on every
// page load, which hung the request under DB-pool pressure ("connection closed
// before full header"). Callers now fire it and forget; it self-limits here.
let _corpAutoRunning = false;
let _corpAutoLastRun = 0;
const CORP_AUTO_MIN_INTERVAL_MS = 2 * 60 * 1000; // at most once every 2 minutes

export const autoProcessMaturedCorporateInvoices = async (): Promise<void> => {
    const nowGuard = Date.now();
    if (_corpAutoRunning || nowGuard - _corpAutoLastRun < CORP_AUTO_MIN_INTERVAL_MS) return;
    _corpAutoRunning = true;
    _corpAutoLastRun = nowGuard;
    try {
        const { data: bills } = await supabase
            .from('corporate_credit_bills')
            .select('id, branch_id, corporate_customer_id, amount, created_at')
            .eq('status', 'UNINVOICED');

        if (!bills || bills.length === 0) return;

        const { data: customers } = await supabase
            .from('corporate_customers')
            .select('id, credit_period_days');

        if (!customers || customers.length === 0) return;

        const customerMap = new Map(customers.map(c => [c.id, c.credit_period_days || 30]));
        const nowMs = Date.now();

        const matureByCustomer: Record<string, { branchId: number; billIds: string[]; totalAmount: number; periodDays: number }> = {};

        for (const b of bills) {
            const periodDays = customerMap.get(b.corporate_customer_id) ?? 30;
            const createdAtMs = new Date(b.created_at).getTime();
            const ageDays = (nowMs - createdAtMs) / (1000 * 60 * 60 * 24);

            if (ageDays >= periodDays) {
                if (!matureByCustomer[b.corporate_customer_id]) {
                    matureByCustomer[b.corporate_customer_id] = {
                        branchId: b.branch_id,
                        billIds: [],
                        totalAmount: 0,
                        periodDays
                    };
                }
                matureByCustomer[b.corporate_customer_id].billIds.push(b.id);
                matureByCustomer[b.corporate_customer_id].totalAmount += Number(b.amount || 0);
            }
        }

        for (const [customerId, data] of Object.entries(matureByCustomer)) {
            if (data.billIds.length === 0) continue;

            const invNum = `INV-AUTO-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 10000)}`;
            const dueDate = new Date(nowMs + data.periodDays * 24 * 60 * 60 * 1000).toISOString();

            const { data: invoice, error: invErr } = await supabase
                .from('corporate_invoices')
                .insert({
                    branch_id: data.branchId,
                    corporate_customer_id: customerId,
                    invoice_number: invNum,
                    amount_due: data.totalAmount,
                    amount_paid: 0,
                    status: 'UNPAID',
                    due_date: dueDate
                })
                .select()
                .single();

            if (!invErr && invoice) {
                await supabase
                    .from('corporate_credit_bills')
                    .update({
                        status: 'INVOICED',
                        corporate_invoice_id: invoice.id
                    })
                    .in('id', data.billIds);
                logger.info(`Auto-generated corporate invoice ${invNum} for customer ${customerId} (${data.billIds.length} bills, KES ${data.totalAmount})`);
            }
        }
    } catch (err) {
        logger.error('Error auto-processing matured corporate invoices:', err);
    } finally {
        _corpAutoRunning = false;
    }
};

// 1. Get Corporate Customers
export const getCorporateCustomers = async (req: Request, res: Response) => {
    try {
        void autoProcessMaturedCorporateInvoices();
        let query = supabase.from('corporate_customers').select('*').order('name');
        query = applyBranchFilter(query, req);
        
        const { data, error } = await query;
        if (error) {
            logger.warn('Error fetching corporate customers:', error.message);
            res.json({ success: true, data: [] });
            return;
        }

        res.json({ success: true, data: data || [] });
    } catch (error: any) {
        logger.error('Failed to get corporate customers:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// 2. Create Corporate Customer
export const createCorporateCustomer = async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branch_id;
        const { name, contact_person, phone, email, credit_limit, credit_period_days, is_active } = req.body;

        const { data, error } = await supabase
            .from('corporate_customers')
            .insert({
                branch_id: branchId,
                name,
                contact_person,
                phone,
                email,
                credit_limit: credit_limit || 0,
                credit_period_days: credit_period_days || 30,
                is_active: is_active ?? true
            })
            .select()
            .single();

        if (error) throw new AppError(error.message, 400);
        res.status(201).json({ success: true, data });
    } catch (error: any) {
        logger.error('Failed to create corporate customer:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// 3. Update Corporate Customer
export const updateCorporateCustomer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        let query = supabase.from('corporate_customers').update(updates).eq('id', id);
        query = applyBranchFilter(query, req);

        const { data, error } = await query.select().single();
        if (error) throw new AppError(error.message, 400);

        res.json({ success: true, data });
    } catch (error: any) {
        logger.error('Failed to update corporate customer:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// 3b. Delete Corporate Customer
export const deleteCorporateCustomer = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check if there are associated bills
        const { data: bills } = await supabase
            .from('corporate_credit_bills')
            .select('id')
            .eq('corporate_customer_id', id)
            .limit(1);

        if (bills && bills.length > 0) {
            // Has transaction history - deactivate instead of hard delete
            let updateQuery = supabase
                .from('corporate_customers')
                .update({ is_active: false })
                .eq('id', id);
            updateQuery = applyBranchFilter(updateQuery, req);
            const { error: updateErr } = await updateQuery;
            if (updateErr) throw new AppError(updateErr.message, 400);

            res.json({
                success: true,
                message: 'Corporate account has transaction history and has been deactivated.',
                softDeleted: true
            });
            return;
        }

        let deleteQuery = supabase.from('corporate_customers').delete().eq('id', id);
        deleteQuery = applyBranchFilter(deleteQuery, req);

        const { error } = await deleteQuery;
        if (error) throw new AppError(error.message, 400);

        res.json({ success: true, message: 'Corporate customer deleted successfully' });
    } catch (error: any) {
        logger.error('Failed to delete corporate customer:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// 4. Charge Corporate Credit (Cashier action)
export const chargeCorporateCredit = async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branch_id;
        const cashierId = (req as any).user.id;
        const { pos_bill_id, corporate_customer_id, amount, shift_id } = req.body;

        // Verify Customer and Credit Limit
        const { data: customer, error: customerErr } = await supabase
            .from('corporate_customers')
            .select('*')
            .eq('id', corporate_customer_id)
            .single();
        
        if (customerErr || !customer) throw new AppError('Corporate customer not found', 404);
        if (!customer.is_active) throw new AppError('Corporate account is inactive', 400);

        // Check current uninvoiced/unpaid balance (Simple sum of uninvoiced bills + unpaid invoices)
        const { data: uninvBills } = await supabase
            .from('corporate_credit_bills')
            .select('amount')
            .eq('corporate_customer_id', corporate_customer_id)
            .in('status', ['UNINVOICED', 'INVOICED']);
        
        const currentBalance = (uninvBills || []).reduce((sum, bill) => sum + Number(bill.amount), 0);
        
        if ((currentBalance + Number(amount)) > Number(customer.credit_limit)) {
            throw new AppError(`Credit limit exceeded. Limit: KES ${customer.credit_limit}, Current Balance: KES ${currentBalance}`, 400);
        }

        // 1. Record Corporate Credit Bill
        const { data: creditBill, error: creditErr } = await supabase
            .from('corporate_credit_bills')
            .insert({
                branch_id: branchId,
                corporate_customer_id,
                pos_bill_id,
                amount,
                cashier_id: cashierId,
                shift_id,
                status: 'UNINVOICED'
            })
            .select()
            .single();

        if (creditErr) throw new AppError(creditErr.message, 400);

        // 2. Update Master Bill to credit_bill and PAYMENT_METHOD to CORPORATE_CREDIT
        if (pos_bill_id) {
            const { error: updateMasterErr } = await supabase
                .from('pos_master_bills')
                .update({
                    payment_status: 'credit_bill',
                    status: 'credit_bill',
                    payment_method: 'CORPORATE_CREDIT'
                })
                .eq('id', pos_bill_id);
            if (updateMasterErr) {
                logger.warn('Failed updating pos_master_bills, trying pos_shift_orders:', updateMasterErr.message);
                await supabase
                    .from('pos_shift_orders')
                    .update({
                        payment_status: 'credit_bill',
                        status: 'credit_bill',
                        payment_method: 'CORPORATE_CREDIT'
                    })
                    .eq('id', pos_bill_id);
            }
        }

        res.json({ success: true, data: creditBill, message: 'Charged to Corporate Credit' });
    } catch (error: any) {
        logger.error('Failed to charge corporate credit:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// Helper to enrich corporate credit bills with full POS items breakdown (no duplicates)
async function enrichCorporateBillsWithItems(bills: any[]): Promise<any[]> {
    if (!bills || bills.length === 0) return bills;

    const posBillIds = bills.map(b => b.pos_bill_id).filter(Boolean);
    if (posBillIds.length === 0) {
        return bills.map(bill => ({
            ...bill,
            bill_number: bill.pos_master_bills?.bill_number || `BILL-${bill.id.slice(0, 8)}`,
            items: [{
                name: `Corporate Bill Settlement`,
                quantity: 1,
                unit_price: Number(bill.amount || 0),
                total_price: Number(bill.amount || 0)
            }]
        }));
    }

    try {
        // 1. Fetch matching pos_shift_orders
        let shiftOrders: any[] = [];
        try {
            const { data } = await supabase
                .from('pos_shift_orders')
                .select('id, master_bill_id, order_number, short_code, table_number, room_number, waiter_name, items, total_amount, created_at')
                .in('id', posBillIds);
            shiftOrders = data || [];
        } catch (_) {}

        // Also check by master_bill_id
        if (shiftOrders.length < posBillIds.length) {
            try {
                const { data } = await supabase
                    .from('pos_shift_orders')
                    .select('id, master_bill_id, order_number, short_code, table_number, room_number, waiter_name, items, total_amount, created_at')
                    .in('master_bill_id', posBillIds);
                if (data && data.length > 0) {
                    shiftOrders = [...shiftOrders, ...data];
                }
            } catch (_) {}
        }

        // 2. Fetch matching pos_master_bills
        let masterBills: any[] = [];
        try {
            const { data } = await supabase
                .from('pos_master_bills')
                .select('id, bill_number, items, total_amount, created_at')
                .in('id', posBillIds);
            masterBills = data || [];
        } catch (_) {}

        // 3. Fetch pos_order_items table
        const allOrderIds = Array.from(new Set([
            ...posBillIds,
            ...shiftOrders.map(o => o.id)
        ]));

        let dbOrderItems: any[] = [];
        if (allOrderIds.length > 0) {
            try {
                const { data } = await supabase
                    .from('pos_order_items')
                    .select('order_id, item_name, quantity, unit_price, total_price, subtotal')
                    .in('order_id', allOrderIds);
                dbOrderItems = data || [];
            } catch (_) {}
        }

        const shiftOrderMap = new Map<string, any>();
        shiftOrders.forEach(o => {
            shiftOrderMap.set(o.id, o);
            if (o.master_bill_id) shiftOrderMap.set(o.master_bill_id, o);
        });

        const masterBillMap = new Map<string, any>();
        masterBills.forEach(m => {
            masterBillMap.set(m.id, m);
        });

        const dbItemsMap = new Map<string, any[]>();
        dbOrderItems.forEach(item => {
            if (!dbItemsMap.has(item.order_id)) dbItemsMap.set(item.order_id, []);
            dbItemsMap.get(item.order_id)!.push(item);
        });

        return bills.map(bill => {
            const pId = bill.pos_bill_id;
            const sOrder = pId ? shiftOrderMap.get(pId) : null;
            const mBill = pId ? masterBillMap.get(pId) : null;

            const billNumber = mBill?.bill_number ||
                sOrder?.order_number ||
                sOrder?.short_code ||
                bill.pos_master_bills?.bill_number ||
                `BILL-${bill.id.slice(0, 8)}`;

            const waiterName = sOrder?.waiter_name || bill.auth_users?.full_name || null;
            const tableNumber = sOrder?.table_number || null;
            const roomNumber = sOrder?.room_number || null;

            const rawItems: any[] = [];

            if (pId && dbItemsMap.has(pId)) {
                rawItems.push(...dbItemsMap.get(pId)!);
            }
            if (sOrder && dbItemsMap.has(sOrder.id)) {
                rawItems.push(...dbItemsMap.get(sOrder.id)!);
            }
            if (rawItems.length === 0 && sOrder?.items && Array.isArray(sOrder.items)) {
                rawItems.push(...sOrder.items);
            }
            if (rawItems.length === 0 && mBill?.items && Array.isArray(mBill.items)) {
                rawItems.push(...mBill.items);
            }

            const itemMap = new Map<string, { name: string; quantity: number; unit_price: number; total_price: number }>();

            for (const raw of rawItems) {
                const name = raw.item_name || raw.name || raw.title || raw.description || 'Item';
                if (raw.is_void || raw.voided || raw.status === 'voided') continue;
                const qty = Number(raw.quantity || raw.qty || 1);
                const unitPrice = Number(raw.unit_price || raw.price || (qty > 0 ? (Number(raw.total_price || raw.total || raw.subtotal || bill.amount) / qty) : 0));
                const total = Number(raw.total_price || raw.total || raw.subtotal || (qty * unitPrice));

                const key = `${name.toLowerCase().trim()}_${unitPrice}`;
                if (itemMap.has(key)) {
                    const existing = itemMap.get(key)!;
                    existing.quantity += qty;
                    existing.total_price += total;
                } else {
                    itemMap.set(key, {
                        name,
                        quantity: qty,
                        unit_price: unitPrice,
                        total_price: total
                    });
                }
            }

            let cleanItems = Array.from(itemMap.values());

            if (cleanItems.length === 0) {
                cleanItems = [{
                    name: `POS Settlement (${billNumber})`,
                    quantity: 1,
                    unit_price: Number(bill.amount || 0),
                    total_price: Number(bill.amount || 0)
                }];
            }

            return {
                ...bill,
                bill_number: billNumber,
                waiter_name: waiterName,
                table_number: tableNumber,
                room_number: roomNumber,
                items: cleanItems
            };
        });
    } catch (err) {
        logger.warn('Failed enriching corporate bills with items:', err);
        return bills.map(bill => ({
            ...bill,
            bill_number: bill.pos_master_bills?.bill_number || `BILL-${bill.id.slice(0, 8)}`,
            items: [{
                name: `Corporate Bill Settlement`,
                quantity: 1,
                unit_price: Number(bill.amount || 0),
                total_price: Number(bill.amount || 0)
            }]
        }));
    }
}

// 5a. Get All Corporate Bills (Folio View)
export const getAllCorporateBills = async (req: Request, res: Response) => {
    try {
        await autoProcessMaturedCorporateInvoices();
        const { customer_id } = req.query;

        let query = supabase
            .from('corporate_credit_bills')
            .select(`
                *,
                corporate_customers(id, name, phone, email, credit_limit, credit_period_days),
                pos_master_bills:pos_bill_id(bill_number)
            `)
            .order('created_at', { ascending: false });

        if (customer_id && typeof customer_id === 'string') {
            query = query.eq('corporate_customer_id', customer_id);
        }

        query = applyBranchFilter(query, req);
        let { data, error } = await query;

        if (error) {
            logger.warn('Embedded query failed for all corporate_credit_bills, trying plain select:', error.message);
            let fallbackQuery = supabase
                .from('corporate_credit_bills')
                .select('*, corporate_customers(id, name, phone, email)')
                .order('created_at', { ascending: false });
            if (customer_id && typeof customer_id === 'string') {
                fallbackQuery = fallbackQuery.eq('corporate_customer_id', customer_id);
            }
            fallbackQuery = applyBranchFilter(fallbackQuery, req);
            const fallbackRes = await fallbackQuery;
            data = fallbackRes.data || [];
        }

        const enriched = await enrichCorporateBillsWithItems(data || []);
        res.json({ success: true, data: enriched });
    } catch (error: any) {
        logger.error('Failed to get corporate bills:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// 5b. Get Pending Corporate Bills
export const getPendingCorporateBills = async (req: Request, res: Response) => {
    try {
        // Fire-and-forget: never block this read on the heavy invoice batch.
        void autoProcessMaturedCorporateInvoices();
        // Single clean query — the previous pos_master_bills embed referenced a
        // non-existent column (bill_number vs master_bill_number) and an
        // unregistered relationship, so it always failed into the fallback.
        let query = supabase
            .from('corporate_credit_bills')
            .select(`
                *,
                corporate_customers(id, name, phone, email),
                pos_master_bills:pos_bill_id(bill_number)
            `)

            .eq('status', 'UNINVOICED')
            .order('created_at', { ascending: false });
            
        query = applyBranchFilter(query, req);
        let { data, error } = await query;
        if (error) {
            logger.warn('Embedded query failed for corporate_credit_bills, trying plain select:', error.message);
            let fallbackQuery = supabase
                .from('corporate_credit_bills')
                .select('*, corporate_customers(id, name, phone, email)')
                .eq('status', 'UNINVOICED')
                .order('created_at', { ascending: false });
            fallbackQuery = applyBranchFilter(fallbackQuery, req);
            const fallbackRes = await fallbackQuery;
            if (fallbackRes.error) {
                logger.warn('Fallback query also failed for corporate_credit_bills:', fallbackRes.error.message);
                res.json({ success: true, data: [] });
                return;
            }
            data = fallbackRes.data || [];
        }

        const enriched = await enrichCorporateBillsWithItems(data || []);
        res.json({ success: true, data: enriched });
    } catch (error: any) {
        logger.error('Failed to get pending corporate bills:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// 6. Generate Invoice
export const generateCorporateInvoice = async (req: Request, res: Response) => {
    try {
        const branchId = (req as any).user.branch_id;
        const accountantId = (req as any).user.id;
        const { corporate_customer_id, bill_ids } = req.body;

        if (!bill_ids || bill_ids.length === 0) {
            throw new AppError('No bills provided for invoice', 400);
        }

        // Get bills
        const { data: bills, error: billsErr } = await supabase
            .from('corporate_credit_bills')
            .select('amount, id, status')
            .in('id', bill_ids)
            .eq('corporate_customer_id', corporate_customer_id)
            .eq('status', 'UNINVOICED');
            
        if (billsErr || !bills || bills.length === 0) {
            throw new AppError('Could not fetch valid uninvoiced bills', 400);
        }

        const amountDue = bills.reduce((sum, b) => sum + Number(b.amount), 0);
        
        // Get customer terms
        const { data: customer } = await supabase.from('corporate_customers').select('credit_period_days').eq('id', corporate_customer_id).single();
        const days = customer?.credit_period_days || 30;
        
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + days);

        // Generate Invoice Number (Format INV-YYYYMMDD-XXXX)
        const invNum = `INV-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 10000)}`;

        const { data: invoice, error: invErr } = await supabase
            .from('corporate_invoices')
            .insert({
                branch_id: branchId,
                corporate_customer_id,
                invoice_number: invNum,
                amount_due: amountDue,
                amount_paid: 0,
                status: 'UNPAID',
                due_date: dueDate.toISOString(),
                created_by: accountantId
            })
            .select()
            .single();

        if (invErr) throw new AppError(invErr.message, 400);

        // Update bills
        const { error: updateBillsErr } = await supabase
            .from('corporate_credit_bills')
            .update({
                status: 'INVOICED',
                corporate_invoice_id: invoice.id
            })
            .in('id', bill_ids);
            
        if (updateBillsErr) throw new AppError(updateBillsErr.message, 400);

        res.status(201).json({ success: true, data: invoice });
    } catch (error: any) {
        logger.error('Failed to generate corporate invoice:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// 7. Get Invoices (with associated bills and POS items formatted for Guest Invoice PDF)
export const getCorporateInvoices = async (req: Request, res: Response) => {
    try {
        void autoProcessMaturedCorporateInvoices();
        let query = supabase
            .from('corporate_invoices')
            .select(`
                *,
                corporate_customers(id, name, phone, email),
                branches(name, address, phone)
            `)
            .order('created_at', { ascending: false });
            
        query = applyBranchFilter(query, req);
        let { data, error } = await query;
        if (error) {
            logger.warn('Embedded query failed for corporate_invoices, trying plain select:', error.message);
            let fallbackQuery = supabase
                .from('corporate_invoices')
                .select('*, corporate_customers(id, name, phone, email)')
                .order('created_at', { ascending: false });
            fallbackQuery = applyBranchFilter(fallbackQuery, req);
            const fallbackRes = await fallbackQuery;
            data = fallbackRes.data || [];
        }

        const invoices = data || [];
        if (invoices.length > 0) {
            const invoiceIds = invoices.map(i => i.id);
            const { data: invBills } = await supabase
                .from('corporate_credit_bills')
                .select('*')
                .in('corporate_invoice_id', invoiceIds);

            const enrichedBills = await enrichCorporateBillsWithItems(invBills || []);
            const billsByInvoice = new Map<string, any[]>();
            for (const b of enrichedBills) {
                if (!billsByInvoice.has(b.corporate_invoice_id)) billsByInvoice.set(b.corporate_invoice_id, []);
                billsByInvoice.get(b.corporate_invoice_id)!.push(b);
            }

            for (const inv of invoices) {
                inv.bills = billsByInvoice.get(inv.id) || [];
                // Format items array for guest invoice PDF template
                inv.items = inv.bills.flatMap((b: any) =>
                    (b.items || []).map((it: any) => ({
                        bill_number: b.bill_number,
                        description: `${b.bill_number} · ${it.name}`,
                        item_name: it.name,
                        qty: it.quantity,
                        unitPrice: it.unit_price,
                        totalAmount: it.total_price
                    }))
                );

                if (inv.items.length === 0) {
                    inv.items = [{
                        bill_number: inv.invoice_number,
                        description: `Corporate Credit Settlement (${inv.invoice_number})`,
                        qty: 1,
                        unitPrice: Number(inv.amount_due || 0),
                        totalAmount: Number(inv.amount_due || 0)
                    }];
                }
            }
        }

        res.json({ success: true, data: invoices });
    } catch (error: any) {
        logger.error('Failed to get corporate invoices:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// 7b. Get Corporate Customer Folio (Complete history of bills & invoices)
export const getCorporateCustomerFolio = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Customer details
        const { data: customer, error: custErr } = await supabase
            .from('corporate_customers')
            .select('*')
            .eq('id', id)
            .single();

        if (custErr || !customer) throw new AppError('Corporate customer not found', 404);

        // Fetch all bills for this customer
        let billsQuery = supabase
            .from('corporate_credit_bills')
            .select(`
                *,
                pos_master_bills:pos_bill_id(bill_number)
            `)
            .eq('corporate_customer_id', id)
            .order('created_at', { ascending: false });

        billsQuery = applyBranchFilter(billsQuery, req);
        const { data: rawBills } = await billsQuery;
        const enrichedBills = await enrichCorporateBillsWithItems(rawBills || []);

        // Fetch all invoices for this customer
        let invQuery = supabase
            .from('corporate_invoices')
            .select('*')
            .eq('corporate_customer_id', id)
            .order('created_at', { ascending: false });

        invQuery = applyBranchFilter(invQuery, req);
        const { data: invoices } = await invQuery;

        // Totals
        const totalBilled = enrichedBills.reduce((sum, b) => sum + Number(b.amount || 0), 0);
        const uninvoicedAmount = enrichedBills.filter(b => b.status === 'UNINVOICED').reduce((sum, b) => sum + Number(b.amount || 0), 0);
        const totalInvoiced = (invoices || []).reduce((sum, i) => sum + Number(i.amount_due || 0), 0);
        const totalPaid = (invoices || []).reduce((sum, i) => sum + Number(i.amount_paid || 0), 0);
        const currentBalance = totalBilled - totalPaid;

        res.json({
            success: true,
            data: {
                customer,
                summary: {
                    total_billed: totalBilled,
                    uninvoiced_amount: uninvoicedAmount,
                    total_invoiced: totalInvoiced,
                    total_paid: totalPaid,
                    current_balance: currentBalance,
                    credit_limit: Number(customer.credit_limit || 0),
                    available_credit: Math.max(0, Number(customer.credit_limit || 0) - currentBalance)
                },
                bills: enrichedBills,
                invoices: invoices || []
            }
        });
    } catch (error: any) {
        logger.error('Failed to get corporate customer folio:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

// 8. Pay/Clear Invoice
export const payCorporateInvoice = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { amount } = req.body;
        
        let query = supabase.from('corporate_invoices').select('*').eq('id', id);
        query = applyBranchFilter(query, req);
        const { data: invoice, error: invErr } = await query.single();
        
        if (invErr || !invoice) throw new AppError('Invoice not found', 404);

        const newPaid = Number(invoice.amount_paid) + Number(amount);
        const status = newPaid >= Number(invoice.amount_due) ? 'PAID' : 'PARTIAL';

        const { data: updatedInvoice, error: updateErr } = await supabase
            .from('corporate_invoices')
            .update({
                amount_paid: newPaid,
                status: status
            })
            .eq('id', id)
            .select()
            .single();
            
        if (updateErr) throw new AppError(updateErr.message, 400);

        // If PAID, mark the underlying bills as PAID too
        if (status === 'PAID') {
            await supabase
                .from('corporate_credit_bills')
                .update({ status: 'PAID' })
                .eq('corporate_invoice_id', id);
        }

        res.json({ success: true, data: updatedInvoice });
    } catch (error: any) {
        logger.error('Failed to pay corporate invoice:', error);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};
