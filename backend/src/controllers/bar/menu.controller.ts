import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';

// ==========================================
// DRINK CATEGORIES
// ==========================================

const FOOD_KEYWORDS = [
  'breakfast', 'lunch', 'dinner', 'main course', 'main dish',
  'appetizer', 'soup', 'food', 'starter', 'dessert', 'side',
  'grill', 'pizza', 'burger', 'steak', 'snack', 'entree'
];

export const getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data: categories, error } = await supabase
      .from('restaurant_menu_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    // Filter categories to only include bar-related ones by excluding food keywords
    const data = (categories || []).filter(cat => {
      const name = cat.name.toLowerCase();
      return !FOOD_KEYWORDS.some(keyword => name.includes(keyword));
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, sort_order, description } = req.body;

    const { data, error } = await supabase
      .from('restaurant_menu_categories')
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

    // First, get valid bar category IDs to ensure we only return drinks/bar items
    const { data: categories } = await supabase
      .from('restaurant_menu_categories')
      .select('id, name')
      .eq('is_active', true);

    const barCategoryIds = (categories || [])
      .filter(cat => {
        const name = cat.name.toLowerCase();
        return !FOOD_KEYWORDS.some(keyword => name.includes(keyword));
      })
      .map(cat => cat.id);

    let query = supabase
      .from('restaurant_menu_items')
      .select(`
        *,
        category:restaurant_menu_categories(name)
      `)
      .eq('is_available', true);

    if (category_id) {
      // If a specific category is requested, still ensure it's a bar category
      if (barCategoryIds.includes(category_id as string)) {
        query = query.eq('category_id', category_id);
      } else {
        // Requested category is not a bar category
        res.status(200).json({ success: true, data: [] });
        return;
      }
    } else {
      // If no category_id, filter by all bar-related categories
      if (barCategoryIds.length > 0) {
        query = query.in('category_id', barCategoryIds);
      } else {
        res.status(200).json({ success: true, data: [] });
        return;
      }
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
      .from('restaurant_menu_items')
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
    const {
      category_id, name, description, price, cost_price,
      unit, branch_id, image_url
    } = req.body;

    // We no longer require branch_id for menu items as they are global in the new schema
    // Preparation time is required in new schema, default to 5 mins for drinks

    const { data, error } = await supabase
      .from('restaurant_menu_items')
      .insert([{
        category_id,
        name,
        description,
        price,
        // cost_price is not in restaurant_menu_items, strictly speaking. 
        // But for compatibility with frontend we might just ignore it here, or store it elsewhere (recipe).
        image_url,
        preparation_time: 5, // Default for drinks
        is_available: true
      }])
      .select()
      .single();

    if (error) throw error;

    // Note: We removed the auto-creation of bar_stock. 
    // Inventory should be managed via the Inventory module (creating a restaurant_bar_inventory item).

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateDrink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Filter out fields that might not exist in target table
    const { cost_price, branch_id, unit, ...validUpdates } = updates;

    const { data, error } = await supabase
      .from('restaurant_menu_items')
      .update({ ...validUpdates, updated_at: new Date().toISOString() })
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
      .from('restaurant_menu_items')
      .select('is_available')
      .eq('id', id)
      .single();

    if (!current) throw new Error('Drink not found');

    const { data, error } = await supabase
      .from('restaurant_menu_items')
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
    const { error } = await supabase.from('restaurant_menu_items').delete().eq('id', id);
    if (error) throw error;
    res.status(200).json({ success: true, message: 'Drink deleted' });
  } catch (error) {
    next(error);
  }
};

export const uploadDrinkImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { imageBase64, contentType, fileName } = req.body;

    if (!imageBase64) {
      res.status(400).json({ success: false, message: 'No image data provided' });
      return;
    }

    const buffer = Buffer.from(imageBase64.split(',')[1], 'base64');
    const path = `menu-items/${id}/${Date.now()}-${fileName || 'image.jpg'}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('menu-items')
      .upload(path, buffer, {
        contentType: contentType || 'image/jpeg',
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('menu-items')
      .getPublicUrl(path);

    const { data: drink, error: updateError } = await supabase
      .from('restaurant_menu_items')
      .update({ image_url: publicUrl })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.status(200).json({ success: true, data: drink });
  } catch (error) {
    next(error);
  }
};
