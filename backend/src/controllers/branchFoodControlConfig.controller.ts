import { Request, Response } from 'express';
import { supabase } from '../config/database';

/**
 * Get branch food control configuration
 * GET /api/branch-food-control-config/:branchId
 */
export const getBranchConfig = async (req: Request, res: Response) => {
    try {
        const { branchId } = req.params;

        const { data, error } = await supabase
            .from('branch_food_control_config')
            .select('*')
            .eq('branch_id', branchId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        // Return default config if not found
        if (!data) {
            return res.json({
                success: true,
                data: {
                    branch_id: branchId,
                    variance_threshold_kes: 200,
                    variance_threshold_percent: 10,
                    food_cost_alert_threshold: 35,
                    allowed_waste_reason_codes: ['SPOILAGE', 'OVERCOOKING', 'CUSTOMER_RETURN', 'PREPARATION_ERROR', 'THEFT', 'OTHER'],
                    require_manager_approval_for_theft: true,
                    auto_submit_to_accountant_on_close: true
                }
            });
        }

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching branch config:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update branch food control configuration
 * PUT /api/branch-food-control-config/:branchId
 */
export const updateBranchConfig = async (req: Request, res: Response) => {
    try {
        const { branchId } = req.params;
        const configData = req.body;

        // Check if config exists
        const { data: existing } = await supabase
            .from('branch_food_control_config')
            .select('id')
            .eq('branch_id', branchId)
            .single();

        let data, error;

        if (existing) {
            // Update existing
            ({ data, error } = await supabase
                .from('branch_food_control_config')
                .update({
                    ...configData,
                    updated_at: new Date().toISOString()
                })
                .eq('branch_id', branchId)
                .select()
                .single());
        } else {
            // Insert new
            ({ data, error } = await supabase
                .from('branch_food_control_config')
                .insert({
                    branch_id: branchId,
                    ...configData
                })
                .select()
                .single());
        }

        if (error) throw error;

        res.json({ success: true, data, message: 'Configuration updated successfully' });
    } catch (error: any) {
        console.error('Error updating branch config:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get all branch configurations (Admin only)
 * GET /api/branch-food-control-config
 */
export const getAllBranchConfigs = async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('branch_food_control_config')
            .select(`
                *,
                branch:branches(id, name, code)
            `)
            .order('branch_id');

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error: any) {
        console.error('Error fetching all branch configs:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
