import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import { UserRole } from '../../models/User';

/**
 * Get all sales points
 * GET /api/kyogong/sales-points
 */
export const getSalesPoints = async (req: Request, res: Response) => {
  try {
    const { is_active } = req.query;
    const branch_id = req.user?.branch_id;

    let query = supabase
      .from('sales_points')
      .select('*')
      .order('name');

    // Only filter by branch_id if it's a valid non-null value
    if (branch_id !== null && branch_id !== undefined) {
      query = query.eq('branch_id', branch_id);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data: salesPoints, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: salesPoints || []
    });
  } catch (error: any) {
    console.error('Get sales points error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get sales points'
    });
  }
};

/**
 * Get sales point details
 * GET /api/kyogong/sales-points/:id
 */
export const getSalesPointDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: salesPoint, error } = await supabase
      .from('sales_points')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!salesPoint) {
      return res.status(404).json({
        success: false,
        error: 'Sales point not found'
      });
    }

    res.json({
      success: true,
      data: salesPoint
    });
  } catch (error: any) {
    console.error('Get sales point details error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get sales point details'
    });
  }
};

/**
 * Get dynamic services
 * GET /api/kyogong/dynamic-services
 */
export const getDynamicServices = async (req: Request, res: Response) => {
  try {
    const { service_type, is_active } = req.query;
    let branch_id = req.user?.branch_id;

    // Sanitize branch_id - replace string "null" or "undefined" with literal null
    if (branch_id === 'null' || branch_id === 'undefined') {
      branch_id = null;
    }

    logger.info(`Getting dynamic services: service_type=${service_type}, is_active=${is_active}, branch_id=${branch_id}, user_role=${req.user?.role}`);

    let query = supabase
      .from('dynamic_services')
      .select('*');

    // Filter by branch_id if it's set and the user is not a Super Admin
    if (branch_id && branch_id !== 'null') {
      query = query.eq('branch_id', branch_id);
    } else if (req.user?.role !== UserRole.SUPER_ADMIN && req.user?.role !== UserRole.GENERAL_MANAGER) {
      // For non-admins without a branch_id, they'll see nothing or we could default to branch 1
      // For now, let's just use the provided branch_id which might be null
      query = query.eq('branch_id', branch_id);
    }
    
    // Order the results
    query = query.order('service_type').order('name');

    if (service_type) {
      query = query.eq('service_type', service_type);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data: services, error } = await query;

    if (error) {
      logger.error('Supabase error fetching dynamic services:', { error, branch_id, service_type });
      throw error;
    }

    res.json({
      success: true,
      data: services || []
    });
  } catch (error: any) {
    logger.error('Get dynamic services error:', { 
      message: error.message, 
      stack: error.stack,
      details: error
    });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get dynamic services'
    });
  }

};

/**
 * Create dynamic service
 * POST /api/kyogong/dynamic-services
 */
export const createDynamicService = async (req: Request, res: Response) => {
  try {
    const {
      service_type,
      name,
      pricing_model,
      base_price,
      price_per_hour
    } = req.body;

    const branch_id = req.user?.branch_id;

    if (!service_type || !name || !pricing_model || !base_price) {
      return res.status(400).json({
        success: false,
        error: 'Service type, name, pricing model, and base price are required'
      });
    }

    const { data: service, error } = await supabase
      .from('dynamic_services')
      .insert({
        branch_id,
        service_type,
        name,
        pricing_model,
        base_price,
        price_per_hour,
        is_active: true
      })
      .select('*')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Dynamic service created successfully',
      data: service
    });
  } catch (error: any) {
    console.error('Create dynamic service error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create dynamic service'
    });
  }
};

/**
 * Update dynamic service
 * PUT /api/kyogong/dynamic-services/:id
 */
export const updateDynamicService = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      service_type,
      name,
      pricing_model,
      base_price,
      price_per_hour,
      is_active
    } = req.body;

    const { data: service, error } = await supabase
      .from('dynamic_services')
      .update({
        service_type,
        name,
        pricing_model,
        base_price,
        price_per_hour,
        is_active
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Dynamic service not found'
      });
    }

    res.json({
      success: true,
      message: 'Dynamic service updated successfully',
      data: service
    });
  } catch (error: any) {
    console.error('Update dynamic service error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update dynamic service'
    });
  }
};

/**
 * Get pool tokens inventory
 * GET /api/kyogong/pool-tokens
 */
export const getPoolTokensInventory = async (req: Request, res: Response) => {
  try {
    const { shift_id, start_date, end_date } = req.query;
    const branch_id = req.user?.branch_id;

    let query = supabase
      .from('pool_tokens_inventory')
      .select(`
        *,
        shift:cashier_shifts(id, shift_number, status)
      `)
      .eq('branch_id', branch_id)
      .order('date', { ascending: false });

    if (shift_id) {
      query = query.eq('shift_id', shift_id);
    }

    if (start_date) {
      query = query.gte('date', start_date);
    }

    if (end_date) {
      query = query.lte('date', end_date);
    }

    const { data: inventory, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: inventory || []
    });
  } catch (error: any) {
    console.error('Get pool tokens inventory error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get pool tokens inventory'
    });
  }
};
