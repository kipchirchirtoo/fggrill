
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';

export const syncFromMaster = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id } = req.body; // Optional: if we want to filter store items by branch? Store items usually central?
        // Store items are central (storage_location_id might be relevant but let's just get all beverages for now)

        // 1. Get all Beverage items from Master Store
        const { data: storeItems, error: storeError } = await supabase
            .from('store_items')
            .select('*')
            .eq('category', 'beverage');

        if (storeError) throw storeError;

        if (!storeItems || storeItems.length === 0) {
            res.status(200).json({ success: true, message: 'No beverage items found in Master Inventory', addedCount: 0 });
            return;
        }

        // 2. Get existing Bar Inventory names to avoid duplicates
        const { data: barItems, error: barError } = await supabase
            .from('restaurant_bar_inventory')
            .select('name');

        if (barError) throw barError;

        const existingNames = new Set((barItems || []).map(i => i.name.toLowerCase()));
        const newItems = [];

        for (const item of storeItems) {
            if (!existingNames.has(item.name.toLowerCase())) {
                newItems.push({
                    name: item.name,
                    category: 'beverage', // Default to generic beverage, or map sub_category if available
                    bottle_size_ml: 750, // Default or null
                    current_bottles: 0, // Start with 0 in Bar
                    par_level: item.reorder_level || 5, // Use master reorder level or default
                    cost_per_bottle: item.unit_cost,
                    selling_price_per_serving: 0, // Needs manual setting
                    supplier_id: null // Could map if supplier logic matches
                });
            }
        }

        if (newItems.length > 0) {
            const { error: insertError } = await supabase
                .from('restaurant_bar_inventory')
                .insert(newItems);

            if (insertError) throw insertError;
        }

        res.status(200).json({
            success: true,
            message: `Successfully synced ${newItems.length} items from Master Inventory`,
            addedCount: newItems.length
        });

    } catch (error) {
        next(error);
    }
};
