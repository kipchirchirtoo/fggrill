import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { createLedgerEntry, createPortionLedgerEntry } from './stock.controller';

/**
 * Create recipe
 * POST /api/kitchen/recipes
 */
export const createRecipe = async (req: Request, res: Response) => {
    try {
        const { menu_item_id, menu_item_name, portion_size, portions_per_recipe, selling_price, ingredients, cooking_instructions } = req.body;
        const userId = (req as any).user?.id;

        if (!menu_item_name || !ingredients || !Array.isArray(ingredients)) {
            return res.status(400).json({ success: false, message: 'Menu item name and ingredients are required' });
        }

        // Create recipe
        const { data: recipe, error: recipeError } = await supabase
            .from('recipes')
            .insert({
                menu_item_id,
                name: menu_item_name,
                output_quantity: portions_per_recipe || 1,
                output_unit: 'portion',
                metadata: { portion_size, selling_price, cooking_instructions }
            })
            .select()
            .single();

        if (recipeError) throw recipeError;

        // Create recipe items
        let totalCost = 0;
        for (const ingredient of ingredients) {
            const itemCost = (ingredient.quantity_per_portion || 0) * (ingredient.unit_cost || 0);
            totalCost += itemCost;

            await supabase
                .from('recipe_items')
                .insert({
                    recipe_id: recipe.id,
                    item_sku: ingredient.item_sku,
                    item_name: ingredient.item_name,
                    quantity_required: ingredient.quantity_per_portion,
                    unit: ingredient.unit_of_measure
                });
        }

        // Update recipe metadata with calculated cost
        const foodCostPercentage = selling_price > 0 ? (totalCost / selling_price * 100) : 0;
        await supabase
            .from('recipes')
            .update({
                metadata: { portion_size, selling_price, cooking_instructions, standard_cost: totalCost, food_cost_percentage: foodCostPercentage }
            })
            .eq('id', recipe.id);

        res.json({ success: true, data: { ...recipe, standard_cost: totalCost, food_cost_percentage: foodCostPercentage } });
    } catch (error: any) {
        console.error('Error creating recipe:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get recipes
 * GET /api/kitchen/recipes
 */
export const getRecipes = async (req: Request, res: Response) => {
    try {
        const { active_only } = req.query;

        let query = supabase
            .from('recipes')
            .select(`
        *,
        ingredients:recipe_items(*)
      `)
            .order('menu_item_name');

        if (active_only === 'true') {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching recipes:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get single recipe
 * GET /api/kitchen/recipes/:id
 */
export const getRecipe = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('recipes')
            .select(`
        *,
        ingredients:recipe_items(*)
      `)
            .eq('id', id)
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching recipe:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update recipe
 * PUT /api/kitchen/recipes/:id
 */
export const updateRecipe = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { menu_item_name, portion_size, portions_per_recipe, selling_price, ingredients, cooking_instructions, is_active } = req.body;

        // Update recipe
        const { error: recipeError } = await supabase
            .from('recipes')
            .update({
                menu_item_name,
                portion_size,
                portions_per_recipe,
                selling_price,
                cooking_instructions,
                is_active,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (recipeError) throw recipeError;

        // If ingredients provided, update them
        if (ingredients && Array.isArray(ingredients)) {
            // Delete existing ingredients
            await supabase
                .from('recipe_items')
                .delete()
                .eq('recipe_id', id);

            // Insert new ingredients
            let totalCost = 0;
            for (const ingredient of ingredients) {
                const itemCost = (ingredient.quantity_per_portion || 0) * (ingredient.unit_cost || 0);
                totalCost += itemCost;

                await supabase
                    .from('recipe_items')
                    .insert({
                        recipe_id: id,
                        item_sku: ingredient.item_sku,
                        item_name: ingredient.item_name,
                        quantity_required: ingredient.quantity_per_portion,
                        unit: ingredient.unit_of_measure
                    });
            }

            // Update recipe cost
            const foodCostPercentage = selling_price > 0 ? (totalCost / selling_price * 100) : 0;
            await supabase
                .from('recipes')
                .update({
                    standard_cost: totalCost,
                    food_cost_percentage: foodCostPercentage
                })
                .eq('id', id);
        }

        res.json({ success: true, message: 'Recipe updated successfully' });
    } catch (error: any) {
        console.error('Error updating recipe:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Deactivate recipe
 * DELETE /api/kitchen/recipes/:id
 */
export const deleteRecipe = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('recipes')
            .update({ is_active: false })
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: 'Recipe deactivated' });
    } catch (error: any) {
        console.error('Error deactivating recipe:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Internal helper to deduct ingredients for a specific order item
 */
export async function deductIngredientsForItem(params: {
    order_id: number | string;
    menu_item_id: string;
    quantity: number;
    branch_id: number;
    user_id?: string;
}) {
    const { order_id, menu_item_id, quantity, branch_id, user_id } = params;

    // Get recipe for menu item
    const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .select('*, ingredients:recipe_items(*)')
        .eq('menu_item_id', menu_item_id)
        .eq('is_active', true)
        .single();

    if (recipeError || !recipe) {
        // console.warn(`No active recipe found for menu item ${menu_item_id}`);
        return null;
    }

    // Deduct each ingredient
    for (const ingredient of recipe.ingredients) {
        const totalQuantity = Number(ingredient.quantity_required) * Number(quantity);

        // Create usage entry
        await supabase
            .from('kitchen_usage')
            .insert({
                branch_id,
                usage_date: new Date().toISOString().split('T')[0],
                usage_type: 'SALES',
                item_sku: ingredient.item_sku,
                item_name: ingredient.item_name,
                quantity: totalQuantity,
                unit_of_measure: ingredient.unit,
                linked_order_id: order_id,
                linked_menu_item_id: menu_item_id,
                recipe_id: recipe.id
            });

        // Create ledger entry
        await createLedgerEntry({
            branch_id,
            item_sku: ingredient.item_sku,
            item_name: ingredient.item_name,
            transaction_type: 'USAGE',
            reference_type: 'POS_ORDER',
            reference_id: order_id.toString(),
            quantity_out: totalQuantity,
            unit_of_measure: ingredient.unit_of_measure,
            user_id,
            notes: `Auto-deducted for ${recipe.menu_item_name} (Order #${order_id})`
        });

        // --- PORTION DEDUCTION LOGIC ---
        // Check if this item is tracked as portions
        const { data: portionStock } = await supabase
            .from('kitchen_portion_stock')
            .select('*')
            .eq('branch_id', branch_id)
            .eq('item_sku', ingredient.item_sku)
            .single();

        if (portionStock) {
            // Deduct from portion stock
            await createPortionLedgerEntry({
                branch_id,
                item_sku: ingredient.item_sku,
                portion_name: portionStock.portion_name,
                transaction_type: 'POS_SALE',
                reference_type: 'POS_ORDER',
                reference_id: order_id.toString(),
                quantity_out: totalQuantity,
                user_id,
                notes: `POS Sale: ${recipe.menu_item_name} (Order #${order_id}) - ${new Date().toLocaleTimeString()}`
            });
        }
    }

    return recipe;
}

/**
 * Auto-deduct ingredients from POS order (Controller version)
 * POST /api/kitchen/recipes/auto-deduct
 */
export const autoDeductIngredients = async (req: Request, res: Response) => {
    try {
        const { order_id, menu_item_id, quantity, branch_id } = req.body;

        if (!order_id || !menu_item_id || !quantity || !branch_id) {
            return res.status(400).json({ success: false, message: 'Order ID, menu item ID, quantity, and branch ID are required' });
        }

        const result = await deductIngredientsForItem({
            order_id,
            menu_item_id,
            quantity,
            branch_id,
            user_id: (req as any).user?.id
        });

        if (!result) {
            return res.json({ success: true, message: 'No recipe found, skipping deduction' });
        }

        res.json({ success: true, message: 'Ingredients deducted successfully' });
    } catch (error: any) {
        console.error('Error auto-deducting ingredients:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Lock recipe (Manager only)
 * POST /api/kitchen/recipes/:id/lock
 */
export const lockRecipe = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.id;

        const { data, error } = await supabase
            .from('recipes')
            .update({
                is_locked: true,
                locked_by: userId,
                locked_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Log change
        await supabase
            .from('recipe_change_log')
            .insert({
                recipe_id: id,
                changed_by: userId,
                change_type: 'LOCKED',
                change_description: 'Recipe locked by manager'
            });

        res.json({ success: true, data, message: 'Recipe locked successfully' });
    } catch (error: any) {
        console.error('Error locking recipe:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Unlock recipe (Manager only)
 * POST /api/kitchen/recipes/:id/unlock
 */
export const unlockRecipe = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user?.id;

        const { data, error } = await supabase
            .from('recipes')
            .update({
                is_locked: false,
                locked_by: null,
                locked_at: null
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Log change
        await supabase
            .from('recipe_change_log')
            .insert({
                recipe_id: id,
                changed_by: userId,
                change_type: 'UNLOCKED',
                change_description: 'Recipe unlocked by manager'
            });

        res.json({ success: true, data, message: 'Recipe unlocked successfully' });
    } catch (error: any) {
        console.error('Error unlocking recipe:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get recipe change history
 * GET /api/kitchen/recipes/:id/history
 */
export const getRecipeHistory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('recipe_change_log')
            .select(`
                *,
                changed_by_user:users!changed_by(first_name, last_name)
            `)
            .eq('recipe_id', id)
            .order('changed_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching recipe history:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
