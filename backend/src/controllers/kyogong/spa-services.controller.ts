import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';

/**
 * Get all SPA services
 * GET /api/kyogong/spa-services
 */
export const getSpaServices = async (req: Request, res: Response) => {
  try {
    const { category, is_active } = req.query;
    const branch_id = req.user?.branch_id;

    let query = supabase
      .from('spa_services')
      .select('*')
      .eq('branch_id', branch_id)
      .order('category')
      .order('name');

    if (category) {
      query = query.eq('category', category);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data: services, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: services || []
    });
  } catch (error: any) {
    console.error('Get SPA services error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get SPA services'
    });
  }
};

/**
 * Create SPA service
 * POST /api/kyogong/spa-services
 */
export const createSpaService = async (req: Request, res: Response) => {
  try {
    const {
      category,
      name,
      description,
      base_price,
      duration_minutes
    } = req.body;

    const branch_id = req.user?.branch_id;

    if (!category || !name || !base_price) {
      return res.status(400).json({
        success: false,
        error: 'Category, name, and base price are required'
      });
    }

    const { data: service, error } = await supabase
      .from('spa_services')
      .insert({
        branch_id,
        category,
        name,
        description,
        base_price,
        duration_minutes,
        is_active: true
      })
      .select('*')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'SPA service created successfully',
      data: service
    });
  } catch (error: any) {
    console.error('Create SPA service error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create SPA service'
    });
  }
};

/**
 * Update SPA service
 * PUT /api/kyogong/spa-services/:id
 */
export const updateSpaService = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      category,
      name,
      description,
      base_price,
      duration_minutes,
      is_active
    } = req.body;

    const { data: service, error } = await supabase
      .from('spa_services')
      .update({
        category,
        name,
        description,
        base_price,
        duration_minutes,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'SPA service not found'
      });
    }

    res.json({
      success: true,
      message: 'SPA service updated successfully',
      data: service
    });
  } catch (error: any) {
    console.error('Update SPA service error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update SPA service'
    });
  }
};

/**
 * Get SPA categories
 * GET /api/kyogong/spa-services/categories
 */
export const getSpaCategories = async (req: Request, res: Response) => {
  try {
    const categories = [
      { code: 'MASSAGE', name: 'Massage' },
      { code: 'WAXING', name: 'Waxing' },
      { code: 'NAIL', name: 'Nail Parlour' },
      { code: 'SALOON', name: 'Saloon' },
      { code: 'SAUNA', name: 'Sauna' },
      { code: 'KINYOZI', name: 'Kinyozi' }
    ];

    res.json({
      success: true,
      data: categories
    });
  } catch (error: any) {
    console.error('Get SPA categories error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get SPA categories'
    });
  }
};
