import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export const getPolicies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branch_id } = req.query;
    let query = supabase.from('payroll_policies').select('*').order('category', { ascending: true });
    
    if (branch_id) {
      query = query.or(`branch_id.is.null,branch_id.eq.${branch_id}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createPolicy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, category, formula_type, rate, min_limit, max_limit, branch_id } = req.body;
    
    const { data, error } = await supabase
      .from('payroll_policies')
      .insert([{
        name,
        category,
        formula_type,
        rate,
        min_limit,
        max_limit,
        branch_id,
        created_by: (req as any).user?.id
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updatePolicy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, category, formula_type, rate, max_limit, min_limit, is_active } = req.body;
    
    const { data, error } = await supabase
      .from('payroll_policies')
      .update({
        name,
        category,
        formula_type,
        rate,
        max_limit,
        min_limit,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const deletePolicy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('payroll_policies')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.status(200).json({ success: true, message: 'Policy deleted successfully' });
  } catch (error) {
    next(error);
  }
};
