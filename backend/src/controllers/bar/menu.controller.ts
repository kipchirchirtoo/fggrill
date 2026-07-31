import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';

// ==========================================
// DRINK CATEGORIES
// ==========================================

export const getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data: categories, error } = await supabase
      .from('bar_drink_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    res.status(200).json({ success: true, data: categories || [] });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, sort_order, description } = req.body;

    const { data, error } = await supabase
      .from('bar_drink_categories')
      .insert([{
        name,
        sort_order,
        description,
        is_active: true
      }])
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
    const branchId = req.query.branch_id || req.user?.branch_id;

    // Keep the bar menu isolated from restaurant food items. Restaurant menu
    // lives in restaurant_menu_items; bar menu is managed in bar_drinks.
    let query = supabase
      .from('bar_drinks')
      .select(`
        *,
        category:bar_drink_categories(id, name)
      `);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (category_id) {
      query = query.eq('category_id', category_id);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;

    // Normalise: add category_name as a flat field for Flutter compatibility
    const enriched = (data || []).map((item: any) => ({
      ...item,
      category_name: item.category?.name ?? '',
      branch_name: item.branch_id ? String(item.branch_id) : 'All',
    }));

    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
};

export const getDrink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('bar_drinks')
      .select(`
        *,
        category:bar_drink_categories(id, name)
      `)
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
      unit, branch_id, image_url, sku
    } = req.body;

    const categoryName = req.body.category || req.body.category_name;
    let resolvedCategoryId = category_id;
    if (!resolvedCategoryId && categoryName) {
      resolvedCategoryId = await resolveBarCategoryId(categoryName) || null;
    }

    const { data, error } = await supabase
      .from('bar_drinks')
      .insert([{
        category_id: resolvedCategoryId,
        name,
        description,
        price,
        cost_price,
        unit: unit || 'bottle',
        branch_id: branch_id || null,
        image_url,
        sku: sku || null,
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

    const {
      category_id,
      name,
      description,
      price,
      cost_price,
      unit,
      branch_id,
      image_url,
      is_available,
      sku
    } = updates;
    const validUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (category_id !== undefined) {
      validUpdates.category_id = category_id || null;
    } else {
      const categoryName = updates.category || updates.category_name;
      if (categoryName !== undefined) {
        validUpdates.category_id = await resolveBarCategoryId(categoryName) || null;
      }
    }

    if (name !== undefined) validUpdates.name = name;
    if (description !== undefined) validUpdates.description = description;
    if (price !== undefined) validUpdates.price = price;
    if (cost_price !== undefined) validUpdates.cost_price = cost_price;
    if (unit !== undefined) validUpdates.unit = unit;
    if (branch_id !== undefined) validUpdates.branch_id = branch_id || null;
    if (image_url !== undefined) validUpdates.image_url = image_url;
    if (is_available !== undefined) validUpdates.is_available = is_available;
    if (sku !== undefined) validUpdates.sku = sku || null;

    const { data, error } = await supabase
      .from('bar_drinks')
      .update(validUpdates)
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
      .from('bar_drinks')
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

async function resolveBarCategoryId(categoryName: string | undefined): Promise<string | null> {
  if (!categoryName) return null;
  const name = categoryName.trim();
  if (!name) return null;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(name)) return name;

  const { data } = await supabase
    .from('bar_drink_categories')
    .select('id')
    .ilike('name', name)
    .limit(1);

  if (data && data.length > 0) {
    return data[0].id;
  }

  const { data: newCat, error } = await supabase
    .from('bar_drink_categories')
    .insert([{ name }])
    .select('id')
    .single();

  if (error || !newCat) {
    logger.error('Error creating bar category from name:', error);
    return null;
  }
  return newCat.id;
}
