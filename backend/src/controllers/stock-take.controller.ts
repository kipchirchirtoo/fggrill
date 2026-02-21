import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// Get all stock takes for a branch
export const getStockTakes = async (req: Request, res: Response) => {
    try {
        const { branch_id, status } = req.query;

        let query = supabase
            .from('stock_takes')
            .select(`
                *,
                branch:branches(name)
            `)
            .order('created_at', { ascending: false });

        if (branch_id) {
            query = query.eq('branch_id', branch_id);
        }

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, data });
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

        // Fetch item names separately
        if (items && items.length > 0) {
            const skus = items.map(i => i.item_sku);
            const { data: inventoryItems } = await supabase
                .from('inventory_items')
                .select('item_code, name, unit')
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
                        unit: invItem.unit
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
                status: item.counted_quantity !== null ? 'COUNTED' : 'PENDING'
            }));
        } else {
            // Auto-populate from inventory_items
            let query = supabase
                .from('inventory_items')
                .select('item_code, current_stock, unit_cost')
                .eq('is_active', true);

            if (category_filter && category_filter !== 'ALL') {
                query = query.eq('category', category_filter);
            }

            const { data: activeItems, error: fetchError } = await query;
            if (fetchError) throw fetchError;

            if (activeItems && activeItems.length > 0) {
                itemsToInsert = activeItems.map((item: any) => ({
                    stock_take_id: stockTake.id,
                    item_sku: item.item_code,
                    system_quantity: item.current_stock || 0,
                    unit_cost: item.unit_cost || 0,
                    status: 'PENDING'
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
                const { error: itemError } = await supabase
                    .from('stock_take_items')
                    .update({
                        counted_quantity: item.counted_quantity,
                        variance_reason: item.variance_reason,
                        notes: item.notes,
                        status: item.counted_quantity !== null ? 'COUNTED' : 'PENDING',
                        counted_at: item.counted_quantity !== null ? new Date().toISOString() : null
                    })
                    .eq('id', item.id);

                if (itemError) throw itemError;
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
