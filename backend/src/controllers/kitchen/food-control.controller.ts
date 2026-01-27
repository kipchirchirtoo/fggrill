import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';

// @desc    Get all food control yield rules
// @route   GET /api/kitchen/food-controls
// @access  Private
export const getFoodControls = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id } = req.query;

        let query = supabase
            .from('kitchen_food_controls')
            .select('*')
            .order('raw_item_name', { ascending: true });

        if (branch_id) {
            query = query.eq('branch_id', branch_id);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new food control rule
// @route   POST /api/kitchen/food-controls
// @access  Private (Kitchen Managers)
export const createFoodControl = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            raw_item_name,
            raw_quantity,
            raw_unit,
            produced_item_name,
            produced_portions,
            branch_id
        } = req.body;

        const { data, error } = await supabase
            .from('kitchen_food_controls')
            .insert([{
                raw_item_name,
                raw_quantity,
                raw_unit,
                produced_item_name,
                produced_portions,
                branch_id
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            data
        });

        logger.info(`New food control rule created: ${raw_item_name}`);
    } catch (error) {
        next(error);
    }
};

// @desc    Update a food control rule
// @route   PUT /api/kitchen/food-controls/:id
// @access  Private (Kitchen Managers)
export const updateFoodControl = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const { data, error } = await supabase
            .from('kitchen_food_controls')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a food control rule
// @route   DELETE /api/kitchen/food-controls/:id
// @access  Private (Kitchen Managers)
export const deleteFoodControl = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('kitchen_food_controls')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.status(200).json({
            success: true,
            message: 'Food control rule deleted'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Calculate expected yield based on raw input
// @route   POST /api/kitchen/food-controls/calculate
// @access  Private
export const calculateYield = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { rule_id, raw_input_quantity } = req.body;

        const { data: rule, error } = await supabase
            .from('kitchen_food_controls')
            .select('*')
            .eq('id', rule_id)
            .single();

        if (error || !rule) {
            res.status(404).json({ success: false, message: 'Yield rule not found' });
            return;
        }

        // Calculation: (Input / Standard Raw Qty) * Standard Produced Portions
        const expected_portions = (raw_input_quantity / rule.raw_quantity) * rule.produced_portions;

        res.status(200).json({
            success: true,
            data: {
                rule,
                raw_input_quantity,
                expected_portions: Number(expected_portions.toFixed(2))
            }
        });
    } catch (error) {
        next(error);
    }
};
