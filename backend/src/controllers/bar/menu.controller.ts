import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';

// ==========================================
// DRINK CATEGORIES
// ==========================================

export const getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('bar_drink_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, sort_order, description } = req.body;

    const { data, error } = await supabase
      .from('bar_drink_categories')
      .insert([{ name, sort_order, description, is_active: true }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// DRINKS MENU
// ==========================================

export const getDrinks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { category_id, search } = req.query;

    let query = supabase
      .from('bar_drinks')
      .select(`
        *,
        category:bar_drink_categories(name)
      `)
      .eq('is_available', true);

    if (category_id) {
      query = query.eq('category_id', category_id);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getDrink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('bar_drinks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createDrink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // "Quality Control: Standardized recipes" - Implicit in ensuring price/cost match
    const { 
      category_id, name, description, price, cost_price, 
      unit, branch_id 
    } = req.body;

    const { data, error } = await supabase
      .from('bar_drinks')
      .insert([{
        category_id, name, description, price, cost_price,
        unit, branch_id, is_available: true
      }])
      .select()
      .single();

    if (error) throw error;

    // Automatically initialize stock entry for this drink if branch_id is present
    if (data && branch_id) {
      await supabase.from('bar_stock').insert({
        drink_id: data.id,
        branch_id,
        quantity: 0,
        min_stock: 10, // Default par level
        cost_per_unit: cost_price
      });
    }

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateDrink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('bar_drinks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const toggleDrinkAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Get current status
    const { data: current } = await supabase
      .from('bar_drinks')
      .select('is_available')
      .eq('id', id)
      .single();

    if (!current) throw new Error('Drink not found');

    const { data, error } = await supabase
      .from('bar_drinks')
      .update({ is_available: !current.is_available })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const deleteDrink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('bar_drinks').delete().eq('id', id);
    if (error) throw error;
    res.status(200).json({ success: true, message: 'Drink deleted' });
  } catch (error) {
    next(error);
  }
};
