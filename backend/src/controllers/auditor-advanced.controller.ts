import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import notificationService from '../services/notification.service';

// ============================================================
// CONSUMPTION CONFIGURATION (MAPPING)
// ============================================================

/**
 * Get all consumption mappings (Menu Item -> Inventory SKU)
 */
export const getConsumptionConfigs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { data, error } = await supabase
            .from('audit_config_consumption')
            .select(`
                *,
                menu_item:restaurant_menu_items(id, name),
                inventory_item:simple_items!inner(sku, item_name)
            `);

        if (error) {
            logger.warn('audit_config_consumption table error:', error.message);
            res.status(200).json({ success: true, data: [], message: 'Audit configuration table not found.' });
            return;
        }

        res.status(200).json({ success: true, data });
    } catch (error) {
        logger.error('Unexpected error in getConsumptionConfigs:', error);
        res.status(200).json({ success: true, data: [] });
    }
};

/**
 * Create or Update a consumption mapping
 */
export const updateConsumptionConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { menu_item_id, inventory_item_sku, quantity, branch_id } = req.body;

        const { data, error } = await supabase
            .from('audit_config_consumption')
            .upsert({
                menu_item_id,
                inventory_item_sku,
                quantity,
                branch_id,
                updated_at: new Date().toISOString()
            }, { onConflict: 'menu_item_id,inventory_item_sku,branch_id' })
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// ============================================================
// THEORETICAL CONSUMPTION LOGIC
// ============================================================

/**
 * Calculate theoretical vs actual consumption for a period
 */
export const getConsumptionVariances = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, from_date, to_date } = req.query;

        if (!branch_id || !from_date || !to_date) {
            res.status(400).json({ success: false, message: 'branch_id, from_date, and to_date are required' });
            return;
        }

        // 1. Get all menu item sales for the period at this branch
        const { data: sales, error: salesError } = await supabase
            .from('restaurant_order_items')
            .select(`
                menu_item_id,
                quantity,
                restaurant_orders!inner(branch_id, created_at, status)
            `)
            .eq('restaurant_orders.branch_id', branch_id)
            .eq('restaurant_orders.status', 'completed')
            .gte('restaurant_orders.created_at', from_date)
            .lte('restaurant_orders.created_at', to_date);

        if (salesError) throw salesError;

        // 2. Get consumption mapping
        let mappings = [];
        try {
            const { data, error: mappingError } = await supabase
                .from('audit_config_consumption')
                .select('*');

            if (mappingError) {
                logger.warn('audit_config_consumption table missing or inaccessible:', mappingError.message);
            } else {
                mappings = data || [];
            }
        } catch (err) {
            logger.warn('Failed to fetch audit_config_consumption:', err);
        }

        if (mappings.length === 0) {
            res.status(200).json({
                success: true,
                data: [],
                message: 'No consumption mappings found. Audit tracking might not be configured.'
            });
            return;
        }

        // 3. Aggregate mapping
        const theoretical: Record<string, number> = {};
        sales?.forEach(sale => {
            const itemMappings = mappings?.filter(m => m.menu_item_id === sale.menu_item_id);
            itemMappings?.forEach(m => {
                const totalConsumed = m.quantity * sale.quantity;
                theoretical[m.inventory_item_sku] = (theoretical[m.inventory_item_sku] || 0) + totalConsumed;
            });
        });

        // 4. Get actual stock movements for the same period (STOCK_OUT only)
        const { data: movements, error: movementError } = await supabase
            .from('branch_stock_movements')
            .select('*')
            .eq('branch_id', branch_id)
            .eq('movement_type', 'STOCK_OUT')
            .gte('created_at', from_date)
            .lte('created_at', to_date);

        if (movementError) throw movementError;

        const actual: Record<string, number> = {};
        movements?.forEach(m => {
            actual[m.item_sku] = (actual[m.item_sku] || 0) + m.quantity;
        });

        // 5. Build response
        const result = Object.keys(theoretical).map(sku => ({
            item_sku: sku,
            theoretical: theoretical[sku],
            actual: actual[sku] || 0,
            variance: (actual[sku] || 0) - theoretical[sku]
        }));

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

/**
 * Detect payroll variances and anomalies
 */
export const getPayrollVariances = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, period_month } = req.query; // format: 'YYYY-MM'

        if (!period_month) {
            res.status(400).json({ success: false, message: 'period_month is required (YYYY-MM)' });
            return;
        }

        // 1. Get current month's payroll
        let currentQuery = supabase
            .from('payroll_records')
            .select('*, employee:staff_profiles!inner(id, user:users(first_name, last_name), department)')
            .ilike('pay_period_start', `${period_month}%`);

        if (branch_id) {
            // Assuming staff_profiles has branch_id or we filter by user's branch
            // This might need adjustment based on exact schema
        }

        const { data: currentPayroll, error: currentError } = await currentQuery;
        if (currentError) throw currentError;

        // 2. Get previous month's payroll for comparison
        const [year, month] = (period_month as string).split('-').map(Number);
        const prevDate = new Date(year, month - 2, 1); // JS months are 0-indexed, so month-2 gives previous month
        const prevMonthStr = prevDate.toISOString().slice(0, 7);

        const { data: prevPayroll, error: prevError } = await supabase
            .from('payroll_records')
            .select('staff_id, net_salary, base_salary')
            .ilike('pay_period_start', `${prevMonthStr}%`);

        if (prevError) throw prevError;

        const prevMap = new Map();
        prevPayroll?.forEach(p => prevMap.set(p.staff_id, p));

        // 3. Analyze Variances
        const variances: any[] = [];

        currentPayroll?.forEach((curr: any) => {
            const prev = prevMap.get(curr.staff_id);
            const employeeName = `${curr.employee?.user?.first_name} ${curr.employee?.user?.last_name}`;
            const department = curr.employee?.department;

            // Check 1: Net Pay Variance > 10%
            if (prev) {
                const diff = curr.net_salary - prev.net_salary;
                const percentChange = (diff / prev.net_salary) * 100;

                if (Math.abs(percentChange) > 10) {
                    variances.push({
                        type: 'NET_PAY_SPIKE',
                        employee_name: employeeName,
                        department,
                        details: `Net pay changed by ${percentChange.toFixed(1)}% (${diff > 0 ? '+' : ''}${diff})`,
                        severity: 'HIGH',
                        current_value: curr.net_salary,
                        prev_value: prev.net_salary
                    });
                }
            } else {
                variances.push({
                    type: 'NEW_EMPLOYEE',
                    employee_name: employeeName,
                    department,
                    details: `New employee added to payroll`,
                    severity: 'MEDIUM',
                    current_value: curr.net_salary,
                    prev_value: 0
                });
            }

            // Check 2: High Overtime (> 30% of basic salary)
            const overtimePay = (curr.overtime_hours || 0) * (curr.overtime_rate || 0);
            const otPercent = (overtimePay / curr.base_salary) * 100;
            if (otPercent > 30) {
                variances.push({
                    type: 'HIGH_OVERTIME',
                    employee_name: employeeName,
                    department,
                    details: `Overtime is ${otPercent.toFixed(1)}% of basic salary`,
                    severity: 'HIGH',
                    current_value: overtimePay,
                    prev_value: 0
                });
            }
        });

        res.status(200).json({ success: true, count: variances.length, data: variances });

    } catch (error) {
        next(error);
    }
};

// ============================================================
// AUDITOR APPROVALS
// ============================================================

/**
 * Handle a pending approval request (Approve/Reject)
 */
export const handleApprovalRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { requestId, status, notes } = req.body;
        const auditorId = req.user?.id;

        if (!['approved', 'rejected'].includes(status)) {
            res.status(400).json({ success: false, message: 'Invalid status' });
            return;
        }

        // 1. Get the request
        const { data: request, error: fetchError } = await supabase
            .from('approval_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (fetchError || !request) {
            res.status(404).json({ success: false, message: 'Approval request not found' });
            return;
        }

        // 2. Update request
        const { error: updateReqError } = await supabase
            .from('approval_requests')
            .update({
                status,
                approved_by: status === 'approved' ? auditorId : null,
                approved_at: status === 'approved' ? new Date().toISOString() : null,
                rejected_at: status === 'rejected' ? new Date().toISOString() : null,
                notes: notes || request.notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (updateReqError) throw updateReqError;

        // 3. Process side effects
        const metadata = request.metadata || {};
        const entityStatus = status === 'approved' ? 'approved' : 'unpaid'; // Revert to unpaid if rejected

        if (request.request_type === 'invoice') {
            const { error } = await supabase.from('accounting_ar_invoices')
            if (error) {
              console.error('Database error:', error);
              throw error;
            }
                .update({ status: entityStatus, updated_at: new Date().toISOString() })
                .eq('id', metadata.invoice_id);
        } else if (request.request_type === 'bill') {
            const { error } = await supabase.from('accounting_ap_bills')
            if (error) {
              console.error('Database error:', error);
              throw error;
            }
                .update({ status: entityStatus, updated_at: new Date().toISOString() })
                .eq('id', metadata.bill_id);
        } else if (request.request_type === 'stock_take') {
            if (status === 'approved') {
                // Perform stock adjustments
                const stockCountId = metadata.stock_count_id;
                // We'd ideally call BranchInventoryService here or trigger a background job
                // For now, update stock_counts status
                const { error } = await supabase.from('stock_counts')
                if (error) {
                  console.error('Database error:', error);
                  throw error;
                }
                    .update({ status: 'approved', updated_at: new Date().toISOString() })
                    .eq('id', stockCountId);

                logger.info(`Stock take ${stockCountId} approved and adjustments pending/applied`);
            } else {
                const { error } = await supabase.from('stock_counts')
                if (error) {
                  console.error('Database error:', error);
                  throw error;
                }
                    .update({ status: 'rejected', updated_at: new Date().toISOString() })
                    .eq('id', metadata.stock_count_id);
            }
        }

        // 4. Log to audit trail
        const { error } = await supabase.from('audit_trail').insert({
            user_id: auditorId,
            action: `AUDIT_${status.toUpperCase()}`,
            entity_type: request.request_type,
            entity_id: requestId,
            new_values: { status, notes },
            performed_at: new Date().toISOString()
        });

        if (error) {

          console.error('Database error:', error);

          throw error;

        }

        // 5. Notify original requester
        if (request.requested_by) {
            const resultTitle = status === 'approved' ? 'Request Approved' : 'Request Rejected';
            const resultMsg = status === 'approved'
                ? `Your ${request.request_type} request has been approved by the auditor.`
                : `Your ${request.request_type} request was rejected by the auditor. Reason: ${notes || 'No reason provided.'}`;

            notificationService.notifyUser(
                request.requested_by,
                resultTitle,
                resultMsg,
                {
                    type: status === 'approved' ? 'success' : 'error',
                    category: 'audit_result',
                    priority: status === 'approved' ? 'medium' : 'high',
                    metadata: { request_id: requestId, status, request_type: request.request_type }
                }
            ).catch(e => logger.error(`Failed to notify requester ${request.requested_by} of audit result`, e));
        }

        res.status(200).json({ success: true, message: `Request ${status} successfully` });
        logger.info(`Audit request ${requestId} (${request.request_type}) ${status} by ${auditorId}`);
    } catch (error) {
        next(error);
    }
};

/**
 * Submit an approval for a transaction/process (Legacy/Unified Wrapper)
 */
export const submitApproval = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { entity_type, entity_id, status, comments } = req.body;
        const auditor_id = req.user?.id;

        // Redirect to handleApprovalRequest logic implicitly or use it as a wrapper
        // For now, we'll keep it for backward compatibility but use approval_requests table
        const { data, error } = await supabase
            .from('approval_requests')
            .insert({
                request_type: entity_type.toLowerCase() === 'stock_request' ? 'other' : entity_type.toLowerCase(),
                status: status.toLowerCase(),
                requested_by: auditor_id, // In this case, the auditor is performing the action
                notes: comments,
                metadata: { entity_id }
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * Get approval history
 */
export const getApprovalHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { entity_type, entity_id } = req.query;

        // Enforce branch isolation for branch-scoped roles
        const { isGlobalRole } = await import('../utils/branchIsolation');
        const userBranchId = req.user?.branch_id;
        const isCentral = isGlobalRole(req.user?.role);

        // Build query (error handling done when executed below)
        let query = supabase.from('audit_approvals').select('*, auditor:users(first_name, last_name)');

        if (entity_type) query = query.eq('entity_type', entity_type);
        if (entity_id) query = query.eq('entity_id', entity_id);

        // Branch-scoped users only see their branch's approval history
        if (!isCentral && userBranchId) {
            query = query.eq('branch_id', userBranchId);
        }

        const { data, error } = await query.order('performed_at', { ascending: false });

        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all pending approvals for a branch (aggregated)
 */
export const getPendingApprovals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Enforce branch isolation: use the authenticated user's branch_id as the source of truth.
        // Super admins / general managers (is_central) may pass branch_id as a query param.
        const userBranchId = req.user?.branch_id;
        const isCentral = req.user?.is_central;

        let effectiveBranchId: number | null = null;

        if (isCentral) {
            // Central/global roles may query any branch
            const qb = req.query.branch_id ? parseInt(req.query.branch_id as string) : null;
            effectiveBranchId = qb;
        } else {
            // Branch-scoped roles (auditor, branch_accountant, etc.) are locked to their own branch
            if (!userBranchId) {
                res.status(400).json({ success: false, message: 'User has no branch assigned' });
                return;
            }
            effectiveBranchId = userBranchId;
        }

        // 1. Fetch pending from approval_requests — filter by branch_id in metadata when available
        // approval_requests has no direct branch_id column; filter via DB-level joins where possible
        const { data: requests, error: requestsError } = await supabase
            .from('approval_requests')
            .select('*')
            .eq('status', 'pending');

        // 2. Fetch pending credit bills — filter at DB level
        const billsQuery = supabase
            .from('staff_credit_bills')
            .select('*, staff:staff_profiles(branch_id)')
            .eq('status', 'pending');

        const { data: bills, error: billsError } = effectiveBranchId
            ? await billsQuery.eq('staff_profiles.branch_id', effectiveBranchId)
            : await billsQuery;

        // 3. Fetch pending staff advances — filter at DB level via branch_id column
        const advancesQuery = supabase
            .from('staff_advances')
            .select('*, staff:staff_profiles(branch_id)')
            .eq('status', 'pending');

        const { data: advances, error: advancesError } = effectiveBranchId
            ? await advancesQuery.eq('branch_id', effectiveBranchId)
            : await advancesQuery;

        // 4. Fetch pending staff loans — filter at DB level via branch_id column
        const loansQuery = supabase
            .from('staff_loans')
            .select('*, staff:staff_profiles(branch_id)')
            .eq('status', 'pending_approval');

        const { data: loans, error: loansError } = effectiveBranchId
            ? await loansQuery.eq('branch_id', effectiveBranchId)
            : await loansQuery;

        // 5. Fetch pending stock counts — always filtered by branch
        const stockCountsQuery = supabase
            .from('stock_counts')
            .select('*')
            .eq('status', 'pending');

        const { data: stockCounts, error: stockCountsError } = effectiveBranchId
            ? await stockCountsQuery.eq('branch_id', effectiveBranchId)
            : await stockCountsQuery;

        if (requestsError) throw requestsError;
        if (billsError) throw billsError;
        if (advancesError) throw advancesError;
        if (loansError) throw loansError;
        if (stockCountsError) throw stockCountsError;

        // For approval_requests (no branch_id column): filter by branch_id stored in metadata
        const filteredRequests = effectiveBranchId
            ? (requests || []).filter((r: any) => {
                const meta = r.metadata || {};
                return meta.branch_id == null || Number(meta.branch_id) === effectiveBranchId;
              })
            : (requests || []);

        // In-memory safety net for bills (DB join filter may not work on all Supabase versions)
        const filteredBills = effectiveBranchId
            ? (bills || []).filter((b: any) => b.staff?.branch_id === effectiveBranchId)
            : (bills || []);

        // Combine into a flat list of pending items
        const pendingItems = [
            ...filteredRequests.map((r: any) => ({ ...r, category: 'General Request' })),
            ...filteredBills.map((b: any) => ({ ...b, category: 'Credit Bill' })),
            ...(advances || []).map((a: any) => ({ ...a, category: 'Advance' })),
            ...(loans || []).map((l: any) => ({ ...l, category: 'Loan' })),
            ...(stockCounts || []).map((s: any) => ({ ...s, category: 'Stock Take' }))
        ];

        res.status(200).json({
            success: true,
            count: pendingItems.length,
            data: pendingItems,
            summary: {
                requests: filteredRequests.length,
                bills: filteredBills.length,
                advances: advances?.length || 0,
                loans: loans?.length || 0,
                stock_counts: stockCounts?.length || 0
            }
        });

    } catch (error) {
        next(error);
    }
};

