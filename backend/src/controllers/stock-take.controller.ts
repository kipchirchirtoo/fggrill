import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import notificationService from '../services/notification.service';
import { applyBranchFilter } from '../utils/branchIsolation';
import { generateStockTakeWorksheetPDF, generateBranchStockTakeWorksheetPDF } from '../services/native-pdf-reports.service';

/**
 * Delay utility for exponential backoff
 */
const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

// Get all stock takes for a branch
export const getStockTakes = async (req: Request, res: Response) => {
    try {
        const { status } = req.query;

        let query = supabase.from('stock_takes').select('*');

        query = applyBranchFilter(query, req);

        if (req.query.branch_id) {
            query = query.eq('branch_id', req.query.branch_id);
        }

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        // Enrich with branch names separately to avoid schema cache join issues
        const branchIds = [...new Set((data || []).map((s: any) => s.branch_id).filter(Boolean))];
        let branchMap: Record<string, string> = {};
        if (branchIds.length) {
            const { data: branches } = await supabase
                .from('branches')
                .select('id, name')
                .in('id', branchIds);
            branchMap = Object.fromEntries((branches || []).map((b: any) => [String(b.id), b.name]));
        }

        const enriched = (data || []).map((s: any) => ({
            ...s,
            branch: s.branch_id ? { name: branchMap[String(s.branch_id)] || '' } : null,
        }));

        res.json({ success: true, data: enriched });
    } catch (error: any) {
        console.error('Error fetching stock takes:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get a single stock take with items
export const getStockTake = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Fetch stock take without join first
        const { data: stockTake, error: takeError } = await supabase
            .from('stock_takes')
            .select('*')
            .eq('id', id)
            .single();

        if (takeError) {
            if (takeError.code === 'PGRST116') {
                return res.status(404).json({ success: false, message: 'Stock take not found' });
            }
            throw takeError;
        }

        // Fetch branch name separately if branch_id exists
        if (stockTake.branch_id) {
            const { data: branch } = await supabase
                .from('branches')
                .select('name')
                .eq('id', stockTake.branch_id)
                .single();
            
            if (branch) {
                stockTake.branch = branch;
            }
        }

        const { data: items, error: itemsError } = await supabase
            .from('stock_take_items')
            .select('*')
            .eq('stock_take_id', id)
            .order('item_sku');

        if (itemsError) throw itemsError;

        // Fetch item details separately
        if (items && items.length > 0) {
            const skus = items.map(i => i.item_sku);
            const { data: inventoryItems } = await supabase
                .from('inventory_items')
                .select('item_code, name, unit, category, reorder_level')
                .in('item_code', skus);

            const itemsMap = (inventoryItems || []).reduce((acc, item) => {
                acc[item.item_code] = item;
                return acc;
            }, {} as Record<string, any>);

            // Enrich items with inventory data
            items.forEach(item => {
                const invItem = itemsMap[item.item_sku];
                if (invItem) {
                    item.item = {
                        name: invItem.name,
                        unit: invItem.unit,
                        category: invItem.category,
                        reorder_level: invItem.reorder_level
                    };
                }
            });
        }

        res.json({
            success: true,
            data: { ...stockTake, items }
        });
    } catch (error: any) {
        console.error('Error fetching stock take:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Create a new stock take
export const createStockTake = async (req: Request, res: Response) => {
    try {
        const { branch_id, take_type, category_filter, notes, items } = req.body;
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        if (!branch_id) {
            return res.status(400).json({ success: false, message: 'Branch ID is required' });
        }

        // Get next stock take number
        const { data: takeNumber, error: seqError } = await supabase
            .rpc('get_stock_take_number');

        if (seqError) throw seqError;

        // Create stock take header
        const { data: stockTake, error: takeError } = await supabase
            .from('stock_takes')
            .insert({
                take_number: takeNumber,
                branch_id,
                take_type: take_type || 'FULL',
                category_filter,
                status: 'IN_PROGRESS',
                started_by: userId,
                notes,
                started_at: new Date().toISOString()
            })
            .select()
            .single();

        if (takeError) throw takeError;

        // Create stock take items if provided, or auto-populate if not
        let itemsToInsert = [];
        if (items && items.length > 0) {
            itemsToInsert = items.map((item: any) => ({
                stock_take_id: stockTake.id,
                item_sku: item.item_sku,
                system_quantity: item.system_quantity,
                counted_quantity: item.counted_quantity,
                unit_cost: item.unit_cost,
                variance_reason: item.variance_reason,
                notes: item.notes,
                status: item.counted_quantity !== null ? 'COUNTED' : 'PENDING',
                is_manually_added: item.is_manually_added || false
            }));
        } else {
            // Auto-populate from branch_stock (including zero-quantity items)
            let query = supabase
                .from('branch_stock')
                .select('item_sku, quantity')
                .eq('branch_id', branch_id);

            const { data: branchStockItems, error: fetchError } = await query;
            if (fetchError) throw fetchError;

            // Fetch item details from simple_items to get unit_cost
            const skus = branchStockItems?.map(i => i.item_sku) || [];
            let itemCostMap: Record<string, number> = {};
            
            if (skus.length > 0) {
                const { data: itemsData } = await supabase
                    .from('simple_items')
                    .select('sku, cost_price')
                    .in('sku', skus);
                
                itemCostMap = (itemsData || []).reduce((acc, item) => {
                    acc[item.sku] = item.cost_price || 0;
                    return acc;
                }, {} as Record<string, number>);
            }

            if (branchStockItems && branchStockItems.length > 0) {
                itemsToInsert = branchStockItems.map((item: any) => ({
                    stock_take_id: stockTake.id,
                    item_sku: item.item_sku,
                    system_quantity: item.quantity || 0,
                    unit_cost: itemCostMap[item.item_sku] || 0,
                    status: 'PENDING',
                    is_manually_added: false
                }));
            }
        }

        if (itemsToInsert.length > 0) {
            const { error: itemsError } = await supabase
                .from('stock_take_items')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;
        }

        res.json({
            success: true,
            data: stockTake,
            message: 'Stock take created successfully'
        });
    } catch (error: any) {
        console.error('Error creating stock take:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update stock take
export const updateStockTake = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, notes, items } = req.body;
        const userId = (req as any).user?.id;

        const updateData: any = {};

        if (status) {
            updateData.status = status;
            if (status === 'COMPLETED') {
                updateData.completed_by = userId;
                updateData.completed_at = new Date().toISOString();
            }
        }

        if (notes !== undefined) {
            updateData.notes = notes;
        }

        // Update stock take header
        const { data: stockTake, error: takeError } = await supabase
            .from('stock_takes')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (takeError) throw takeError;

        // Update items if provided
        if (items && items.length > 0) {
            for (const item of items) {
                const updateData: any = {
                    counted_quantity: item.counted_quantity,
                    variance_reason: item.variance_reason,
                    notes: item.notes,
                    status: item.counted_quantity !== null ? 'COUNTED' : 'PENDING',
                    counted_at: item.counted_quantity !== null ? new Date().toISOString() : null
                };
                
                // If adding a new item manually
                if (item.is_new) {
                    // Get unit_cost from simple_items
                    const { data: itemData } = await supabase
                        .from('simple_items')
                        .select('cost_price')
                        .eq('sku', item.item_sku)
                        .single();
                    
                    updateData.unit_cost = itemData?.cost_price || 0;
                    updateData.is_manually_added = true;
                    
                    const { error: insertError } = await supabase
                        .from('stock_take_items')
                        .insert({
                            ...updateData,
                            stock_take_id: id,
                            item_sku: item.item_sku,
                            system_quantity: 0
                        });
                    
                    if (insertError) throw insertError;
                } else {
                    const { error: itemError } = await supabase
                        .from('stock_take_items')
                        .update(updateData)
                        .eq('id', item.id);

                    if (itemError) throw itemError;
                }
            }
        }

        // Recalculate summary
        const { data: summary } = await supabase
            .from('stock_take_items')
            .select('variance, variance_value')
            .eq('stock_take_id', id);

        if (summary) {
            const totalItemsCounted = summary.filter(s => s.variance !== null).length;
            const itemsWithVariance = summary.filter(s => s.variance !== 0).length;
            const totalVarianceValue = summary.reduce((sum, s) => sum + (s.variance_value || 0), 0);

            await supabase
                .from('stock_takes')
                .update({
                    total_items_counted: totalItemsCounted,
                    items_with_variance: itemsWithVariance,
                    total_variance_value: totalVarianceValue
                })
                .eq('id', id);
        }

        res.json({
            success: true,
            data: stockTake,
            message: 'Stock take updated successfully'
        });
    } catch (error: any) {
        console.error('Error updating stock take:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete stock take
export const deleteStockTake = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('stock_takes')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Stock take deleted successfully'
        });
    } catch (error: any) {
        console.error('Error deleting stock take:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Build notification payload for stock-take submission
 * Requirements: 2.2
 * 
 * @param stockTakeId - UUID of the stock-take
 * @param branchId - ID of the branch
 * @param totalVarianceValue - Total variance value (positive or negative)
 * @returns StockTakeNotification payload or null if data cannot be fetched
 */
interface StockTakeNotification {
    role: 'auditor';
    title: string;
    message: string;
    type: 'info';
    category: 'stock_take';
    priority: 'medium';
    actionUrl: string;
    branchId?: number;
    metadata: {
        stock_take_id: string;
        branch_id: number;
        branch_name: string;
        submission_date: string;
        variance_status: 'balanced' | 'variance';
        total_variance_value: number;
    };
}

export const buildStockTakeNotificationPayload = async (
    stockTakeId: string,
    branchId: number,
    totalVarianceValue: number
): Promise<StockTakeNotification | null> => {
    try {
        // Fetch branch name
        const { data: branch, error: branchError } = await supabase
            .from('branches')
            .select('name')
            .eq('id', branchId)
            .single();

        if (branchError || !branch) {
            console.error('Error fetching branch for notification:', branchError);
            return null;
        }

        // Calculate variance status
        const varianceStatus: 'balanced' | 'variance' = totalVarianceValue === 0 ? 'balanced' : 'variance';

        // Build notification payload
        const notification: StockTakeNotification = {
            role: 'auditor',
            title: 'Stock Take Submitted for Review',
            message: `A stock take from ${branch.name} has been submitted for your review. ${
                varianceStatus === 'balanced' 
                    ? 'The stock take is balanced with no variances.' 
                    : `Total variance: ${totalVarianceValue >= 0 ? '+' : ''}${totalVarianceValue.toFixed(2)}`
            }`,
            type: 'info',
            category: 'stock_take',
            priority: 'medium',
            branchId: branchId,
            actionUrl: `/dashboard/branch-store/stock-takes/${stockTakeId}`,
            metadata: {
                stock_take_id: stockTakeId,
                branch_id: branchId,
                branch_name: branch.name,
                submission_date: new Date().toISOString(),
                variance_status: varianceStatus,
                total_variance_value: totalVarianceValue
            }
        };

        return notification;
    } catch (error) {
        console.error('Error building notification payload:', error);
        return null;
    }
};

/**
 * Send notification with retry logic and exponential backoff
 * Requirements: 2.1, 2.3, 2.4
 * 
 * @param notification - The notification payload to send
 * @param stockTakeId - UUID of the stock-take for logging
 * @param maxRetries - Maximum number of retries (default: 1)
 * @returns Object with success status and notification ID if successful
 */
export const sendNotificationWithRetry = async (
    notification: StockTakeNotification,
    stockTakeId: string,
    maxRetries: number = 1
): Promise<{ success: boolean; notificationId?: number; error?: any }> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempting to send notification (attempt ${attempt + 1}/${maxRetries + 1})...`);
            
            const result = await notificationService.notifyRole(
                notification.role,
                notification.title,
                notification.message,
                {
                    type: notification.type,
                    category: notification.category,
                    priority: notification.priority,
                    branchId: notification.branchId,
                    actionUrl: notification.actionUrl,
                    metadata: notification.metadata
                }
            );

            if (result && result.id) {
                console.log(`Notification sent successfully on attempt ${attempt + 1}`);
                return { success: true, notificationId: result.id };
            } else {
                throw new Error('Notification service returned null or no ID');
            }
        } catch (error) {
            console.error(`Notification attempt ${attempt + 1} failed:`, error);
            
            if (attempt === maxRetries) {
                // Final attempt failed
                console.error('Failed to send notification after all retries', {
                    stock_take_id: stockTakeId,
                    error
                });
                return { success: false, error };
            }
            
            // Exponential backoff: 1 second for first retry, 2 seconds for second, etc.
            const delayMs = 1000 * (attempt + 1);
            console.log(`Waiting ${delayMs}ms before retry...`);
            await delay(delayMs);
        }
    }
    
    return { success: false, error: new Error('Max retries exceeded') };
};

// Submit stock take to auditor
export const submitStockTake = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'User not authenticated' 
            });
        }

        // Validate stock-take ID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!id || !uuidRegex.test(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid stock-take ID format'
            });
        }

        // Extract IP address and user agent for audit logging
        const ipAddress = req.ip || req.socket.remoteAddress || null;
        const userAgent = req.get('user-agent') || null;

        // Call RPC function with row locking for atomic submission
        // This uses SELECT FOR UPDATE to prevent race conditions
        const { data: result, error: rpcError } = await supabase
            .rpc('submit_stock_take_with_lock', {
                p_stock_take_id: id,
                p_user_id: userId,
                p_ip_address: ipAddress,
                p_user_agent: userAgent
            });

        if (rpcError) {
            console.error('RPC error in submitStockTake:', rpcError);
            return res.status(500).json({
                success: false,
                message: 'Database error occurred',
                error: rpcError.message
            });
        }

        // Parse the result from the RPC function
        const parsedResult = typeof result === 'string' ? JSON.parse(result) : result;

        // Handle different error cases from the RPC function
        if (!parsedResult.success) {
            switch (parsedResult.error) {
                case 'NOT_FOUND': {
                    // Fallback: check if this ID exists in stock_counts (legacy system)
                    const { data: stockCount, error: countError } = await supabase
                        .from('stock_counts')
                        .select('*')
                        .eq('id', id)
                        .single();

                    if (countError || !stockCount) {
                        return res.status(404).json({
                            success: false,
                            message: 'Stock take not found'
                        });
                    }

                    // Already submitted/verified
                    if (stockCount.status === 'submitted' || stockCount.status === 'verified') {
                        return res.status(409).json({
                            success: false,
                            message: 'Stock take has already been submitted',
                            code: 'ALREADY_SUBMITTED',
                            current_status: stockCount.status
                        });
                    }

                    // Submit via stock_counts table
                    const { data: updatedCount, error: updateError } = await supabase
                        .from('stock_counts')
                        .update({
                            status: 'submitted',
                            counted_by: userId,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', id)
                        .select()
                        .single();

                    if (updateError) throw updateError;

                    // Create approval request for auditor
                    const { error } = await supabase.from('approval_requests').insert({
                        request_type: 'stock_take',
                        status: 'pending',
                        branch_id: stockCount.branch_id,
                        requested_by: userId,
                        description: `Stock count submission review: ${stockCount.count_number || id}`,
                        metadata: { stock_count_id: id }
                    });

                    if (error) {

                      console.error('Database error:', error);

                      throw error;

                    }

                    // Notify auditor — scoped to the branch of the stock count
                    notificationService.notifyRole(
                        'auditor',
                        'Stock Take Submission',
                        `A new stock take (${stockCount.count_number || id}) has been submitted for audit.`,
                        {
                            type: 'warning',
                            category: 'audit',
                            priority: 'medium',
                            branchId: stockCount.branch_id,
                            actionUrl: `/dashboard/branch-store/stock-takes/${id}`,
                            metadata: { stock_count_id: id, type: 'stock_take' }
                        }
                    ).catch((e: any) => console.error('Failed to notify auditor:', e));

                    return res.json({
                        success: true,
                        message: 'Stock take submitted for auditor review',
                        data: updatedCount
                    });
                }
                
                case 'ALREADY_SUBMITTED':
                    return res.status(409).json({
                        success: false,
                        message: parsedResult.message,
                        code: 'ALREADY_SUBMITTED',
                        current_status: parsedResult.current_status,
                        submitted_at: parsedResult.submitted_at
                    });
                
                case 'DATABASE_ERROR':
                default:
                    return res.status(500).json({
                        success: false,
                        message: parsedResult.message,
                        details: parsedResult.details
                    });
            }
        }

        // Success - now send notification to auditors
        const stockTakeData = parsedResult.data;
        
        // Build notification payload
        const notificationPayload = await buildStockTakeNotificationPayload(
            id,
            stockTakeData.branch_id,
            stockTakeData.total_variance_value || 0
        );

        let notificationSuccess = false;
        let notificationId: number | undefined;
        let notificationError: any = null;

        if (notificationPayload) {
            // Send notification with retry logic
            const notificationResult = await sendNotificationWithRetry(
                notificationPayload,
                id,
                1 // 1 retry = 2 total attempts
            );

            notificationSuccess = notificationResult.success;
            notificationId = notificationResult.notificationId;
            notificationError = notificationResult.error;

            // Update notification_sent and notification_sent_at fields
            const notificationUpdate: any = {
                notification_sent: notificationSuccess
            };

            if (notificationSuccess) {
                notificationUpdate.notification_sent_at = new Date().toISOString();
            }

            await supabase
                .from('stock_takes')
                .update(notificationUpdate)
                .eq('id', id);

            // Log notification attempt in audit log
            const auditLogEntry: any = {
                stock_take_id: id,
                action: notificationSuccess ? 'notification_sent' : 'notification_failed',
                event_type: 'notification',
                notification_status: notificationSuccess ? 'sent' : 'failed',
                user_id: userId,
                ip_address: ipAddress,
                user_agent: userAgent
            };

            if (notificationSuccess && notificationId) {
                auditLogEntry.notification_id = notificationId;
            }

            if (!notificationSuccess && notificationError) {
                auditLogEntry.event_data = {
                    error_message: notificationError.message || 'Unknown error',
                    error_details: notificationError.toString()
                };
            }

            await supabase
                .from('stock_take_audit_log')
                .insert(auditLogEntry);
        } else {
            console.error('Failed to build notification payload');
            notificationError = new Error('Failed to build notification payload');
        }

        // Return success response with optional warning about notification failure
        const response: any = {
            success: true,
            message: parsedResult.message,
            data: stockTakeData
        };

        if (!notificationSuccess) {
            response.warnings = [
                {
                    code: 'NOTIFICATION_FAILED',
                    message: 'Failed to notify auditor',
                    retry_scheduled: false
                }
            ];
        }

        res.json(response);
    } catch (error: any) {
        console.error('Error submitting stock take:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};


// Generate a stock take worksheet PDF
export const generateWorksheet = async (req: Request, res: Response) => {
    try {
        const { id } = req.params; // If id is provided, use items from this stock take
        const { branch_id, category } = req.query;
        const user = (req as any).user;

        let items = [];
        let branchName = 'Main Branch';
        let title = 'Physical Stock Take';

        if (id && id !== 'undefined') {
            // Get items from specific stock take
            const { data: stockTake, error: takeError } = await supabase
                .from('stock_takes')
                .select('*, branch:branches(name)')
                .eq('id', id)
                .single();

            if (takeError) throw takeError;
            if (stockTake.branch) branchName = stockTake.branch.name;
            title = `Stock Take Worksheet - ${stockTake.take_number}`;

            const { data: takeItems, error: itemsError } = await supabase
                .from('stock_take_items')
                .select('*, item:inventory_items(name, unit)')
                .eq('stock_take_id', id);

            if (itemsError) throw itemsError;
            items = takeItems || [];
        } else {
            // Get all active items for the branch
            const bId = branch_id || user?.branch_id || 1;
            
            const { data: branch } = await supabase
                .from('branches')
                .select('name')
                .eq('id', bId)
                .single();
            if (branch) branchName = branch.name;

            let query = supabase
                .from('inventory_items')
                .select('*')
                .eq('is_active', true);

            if (category && category !== 'ALL') {
                query = query.eq('category', category as string);
            }

            const { data: activeItems, error: fetchError } = await query;
            if (fetchError) throw fetchError;
            items = activeItems || [];
            title = `Inventory Count Worksheet${category ? ` - ${category}` : ''}`;
        }

        const { generateStockTakeWorksheetPDF } = await import('../services/native-pdf-reports.service');
        
        await generateStockTakeWorksheetPDF(res, {
            title,
            branchName,
            items,
            generatedBy: `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'System'
        });

    } catch (error: any) {
        console.error('Error generating stock take worksheet:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Generate branch stock take worksheet PDF with category grouping
export const generateBranchStockTakeWorksheet = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        // Get stock take details
        const { data: stockTake, error: takeError } = await supabase
            .from('stock_takes')
            .select('*, branch:branches(name)')
            .eq('id', id)
            .single();

        if (takeError) throw takeError;
        if (!stockTake) {
            return res.status(404).json({ success: false, message: 'Stock take not found' });
        }

        const branchName = stockTake.branch?.name || 'Unknown Branch';
        const takeNumber = stockTake.take_number || 'N/A';

        // Get stock take items, then attach catalog details explicitly. The live
        // schema does not expose a PostgREST FK from stock_take_items to simple_items.
        const { data: takeItems, error: itemsError } = await supabase
            .from('stock_take_items')
            .select('*')
            .eq('stock_take_id', id);

        if (itemsError) throw itemsError;

        const itemSkus = [...new Set((takeItems || [])
            .map((item: any) => item.item_sku ? String(item.item_sku).trim() : '')
            .filter(Boolean))];

        const { data: catalogItems, error: catalogError } = itemSkus.length > 0
            ? await supabase
                .from('simple_items')
                .select('sku, item_name, description, store_type')
                .in('sku', itemSkus)
            : { data: [], error: null };

        if (catalogError) throw catalogError;

        const catalogBySku = new Map<string, any>((catalogItems || [])
            .map((item: any) => [String(item.sku).trim(), item]));

        const items = (takeItems || []).map((item: any) => {
            const sku = item.item_sku ? String(item.item_sku).trim() : '';
            const catalogItem = catalogBySku.get(sku);

            return {
                ...item,
                item: {
                    item_name: catalogItem?.item_name || catalogItem?.description || sku || 'Unknown item',
                    category: catalogItem?.store_type || 'uncategorized',
                    unit_of_measure: 'Unit'
                }
            };
        });

        await generateBranchStockTakeWorksheetPDF(res, {
            title: 'Branch Stock Take Worksheet',
            branchName,
            takeNumber,
            items,
            generatedBy: `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'System'
        });

    } catch (error: any) {
        console.error('Error generating branch stock take worksheet:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
