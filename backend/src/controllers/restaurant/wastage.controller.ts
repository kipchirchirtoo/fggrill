/**
 * Restaurant Wastage Controller
 * Record and track food waste in the kitchen
 * Uses direct PostgreSQL connection for wastage_records table
 */

import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';

// Direct PostgreSQL connection for wastage table
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Waste reasons
const WASTE_REASONS = [
  'spoilage',
  'expiry', 
  'damage',
  'overcooking',
  'customer_return',
  'quality_control',
  'other'
] as const;

type WasteReason = typeof WASTE_REASONS[number];

// ============================================================
// GET WASTAGE RECORDS
// ============================================================

export const getWastageRecords = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.user?.branch_id;
    const { from_date, to_date, reason } = req.query;

    let query = `
      SELECT 
        w.*,
        b.name as branch_name,
        u.first_name || ' ' || u.last_name as logged_by_name
      FROM wastage_records w
      LEFT JOIN branches b ON w.branch_id = b.id
      LEFT JOIN users u ON w.logged_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (branchId) {
      query += ` AND w.branch_id = $${paramIndex}`;
      params.push(branchId);
      paramIndex++;
    }
    if (from_date) {
      query += ` AND w.logged_at >= $${paramIndex}`;
      params.push(from_date);
      paramIndex++;
    }
    if (to_date) {
      query += ` AND w.logged_at <= $${paramIndex}`;
      params.push(to_date);
      paramIndex++;
    }
    if (reason) {
      query += ` AND w.reason = $${paramIndex}`;
      params.push(reason);
      paramIndex++;
    }

    query += ` ORDER BY w.logged_at DESC LIMIT 100`;

    const result = await pool.query(query, params);
    const records = result.rows;

    // Calculate summary stats
    const summary = {
      totalRecords: records.length,
      totalCost: records.reduce((sum, r) => sum + (parseFloat(r.cost_impact) || 0), 0),
      byReason: records.reduce((acc, r) => {
        const reason = r.reason || 'other';
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    res.status(200).json({
      success: true,
      count: records.length,
      summary,
      data: records
    });
  } catch (error) {
    logger.error('Error fetching wastage records:', error);
    res.status(200).json({
      success: true,
      count: 0,
      summary: { totalRecords: 0, totalCost: 0, byReason: {} },
      data: []
    });
  }
};

// ============================================================
// CREATE WASTAGE RECORD
// ============================================================

export const createWastageRecord = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.user?.branch_id || 1;
    const userId = req.user?.id;
    const {
      item_name,
      item_id,
      item_type,
      quantity,
      unit,
      reason,
      cost_impact,
      description
    } = req.body;

    // Validation
    if (!item_name || !quantity || !unit || !reason) {
      res.status(400).json({
        success: false,
        message: 'Item name, quantity, unit, and reason are required'
      });
      return;
    }

    if (!WASTE_REASONS.includes(reason)) {
      res.status(400).json({
        success: false,
        message: `Invalid reason. Must be one of: ${WASTE_REASONS.join(', ')}`
      });
      return;
    }

    if (quantity <= 0) {
      res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0'
      });
      return;
    }

    // Handle UUID for logged_by - use null if not a valid UUID
    let loggedBy = null;
    if (userId && userId !== 'dev-user' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      loggedBy = userId;
    }

    const result = await pool.query(`
      INSERT INTO wastage_records (branch_id, item_name, item_id, item_type, quantity, unit, reason, cost_impact, description, logged_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [branchId, item_name, item_id || null, item_type || 'custom', quantity, unit, reason, cost_impact || 0, description || null, loggedBy]);

    res.status(201).json({
      success: true,
      message: 'Wastage recorded successfully',
      data: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Error creating wastage record:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to record wastage'
    });
  }
};

// ============================================================
// GET WASTAGE SUMMARY/STATS
// ============================================================

export const getWastageSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.user?.branch_id;
    const { period } = req.query; // 'today', 'week', 'month'

    let fromDate: string;
    const now = new Date();
    
    switch (period) {
      case 'week':
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'month':
        fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      default: // today
        fromDate = new Date().toISOString().split('T')[0];
    }

    let query = `
      SELECT * FROM wastage_records
      WHERE logged_at >= $1
    `;
    const params: any[] = [fromDate];

    if (branchId) {
      query += ` AND branch_id = $2`;
      params.push(branchId);
    }

    const result = await pool.query(query, params);
    const records = result.rows;

    // Group by reason
    const byReason = records.reduce((acc, record) => {
      const reason = record.reason || 'other';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by day
    const byDay = records.reduce((acc, record) => {
      const day = new Date(record.logged_at).toISOString().split('T')[0];
      if (!acc[day]) {
        acc[day] = { count: 0, cost: 0 };
      }
      acc[day].count++;
      acc[day].cost += parseFloat(record.cost_impact) || 0;
      return acc;
    }, {} as Record<string, { count: number; cost: number }>);

    res.status(200).json({
      success: true,
      data: {
        totalRecords: records.length,
        totalCost: records.reduce((sum, r) => sum + (parseFloat(r.cost_impact) || 0), 0),
        byReason,
        byDay,
        period: period || 'today'
      }
    });
  } catch (error) {
    logger.error('Error fetching wastage summary:', error);
    res.status(200).json({
      success: true,
      data: {
        totalRecords: 0,
        totalCost: 0,
        byReason: {},
        byDay: {},
        period: 'today'
      }
    });
  }
};

// ============================================================
// GET MENU ITEMS FOR WASTAGE (items that can be wasted)
// ============================================================

export const getWastageItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const items: any[] = [];

    // Try to get menu items from Supabase
    try {
      const { data: menuItems } = await supabase
        .from('restaurant_menu_items')
        .select('id, name, price, category_id')
        .eq('is_available', true)
        .order('name')
        .limit(100);

      if (menuItems) {
        const categoryIds = [...new Set(menuItems.filter(m => m.category_id).map(m => m.category_id))];
        let categoryMap: Record<string, string> = {};
        
        if (categoryIds.length > 0) {
          const { data: categories } = await supabase
            .from('restaurant_menu_categories')
            .select('id, name')
            .in('id', categoryIds);
          
          categoryMap = (categories || []).reduce((acc, c) => {
            acc[c.id] = c.name;
            return acc;
          }, {} as Record<string, string>);
        }

        menuItems.forEach(item => {
          items.push({
            id: item.id,
            name: item.name,
            type: 'menu_item',
            category: categoryMap[item.category_id] || 'Menu',
            unit: 'portion',
            cost: item.price || 0
          });
        });
      }
    } catch (e) {
      logger.warn('Could not fetch menu items:', e);
    }

    // Try to get inventory items from simple_items
    try {
      const { data: inventoryItems } = await supabase
        .from('simple_items')
        .select('sku, item_name, category, cost_price, retail_price')
        .order('item_name')
        .limit(100);

      if (inventoryItems) {
        inventoryItems.forEach(item => {
          items.push({
            id: item.sku,
            name: item.item_name,
            type: 'inventory_item',
            category: item.category || 'Inventory',
            unit: 'unit',
            cost: item.cost_price || item.retail_price || 0
          });
        });
      }
    } catch (e) {
      logger.warn('Could not fetch inventory items:', e);
    }

    // Add common kitchen items if no items found
    if (items.length === 0) {
      const commonItems = [
        { id: 'food-1', name: 'Cooked Rice', type: 'custom', category: 'Prepared Food', unit: 'kg', cost: 150 },
        { id: 'food-2', name: 'Grilled Chicken', type: 'custom', category: 'Prepared Food', unit: 'portion', cost: 450 },
        { id: 'food-3', name: 'Mixed Vegetables', type: 'custom', category: 'Prepared Food', unit: 'kg', cost: 200 },
        { id: 'food-4', name: 'Beef Stew', type: 'custom', category: 'Prepared Food', unit: 'portion', cost: 500 },
        { id: 'food-5', name: 'Fish Fillet', type: 'custom', category: 'Prepared Food', unit: 'portion', cost: 600 },
        { id: 'food-6', name: 'Soup', type: 'custom', category: 'Prepared Food', unit: 'liter', cost: 300 },
        { id: 'food-7', name: 'Salad', type: 'custom', category: 'Prepared Food', unit: 'portion', cost: 250 },
        { id: 'food-8', name: 'Bread', type: 'custom', category: 'Bakery', unit: 'piece', cost: 50 },
        { id: 'raw-1', name: 'Raw Chicken', type: 'custom', category: 'Raw Ingredients', unit: 'kg', cost: 350 },
        { id: 'raw-2', name: 'Raw Beef', type: 'custom', category: 'Raw Ingredients', unit: 'kg', cost: 600 },
        { id: 'raw-3', name: 'Fresh Vegetables', type: 'custom', category: 'Raw Ingredients', unit: 'kg', cost: 100 },
        { id: 'raw-4', name: 'Fresh Fish', type: 'custom', category: 'Raw Ingredients', unit: 'kg', cost: 500 },
        { id: 'raw-5', name: 'Eggs', type: 'custom', category: 'Raw Ingredients', unit: 'piece', cost: 15 },
        { id: 'raw-6', name: 'Milk', type: 'custom', category: 'Dairy', unit: 'liter', cost: 120 },
        { id: 'raw-7', name: 'Cooking Oil', type: 'custom', category: 'Supplies', unit: 'liter', cost: 250 },
      ];
      items.push(...commonItems);
    }

    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    logger.error('Error fetching wastage items:', error);
    res.status(200).json({
      success: true,
      count: 0,
      data: []
    });
  }
};

// ============================================================
// UPDATE WASTAGE RECORD
// ============================================================

export const updateWastageRecord = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      item_name,
      quantity,
      unit,
      reason,
      cost_impact,
      description
    } = req.body;

    // Build update query dynamically
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (item_name !== undefined) {
      updates.push(`item_name = $${paramIndex}`);
      params.push(item_name);
      paramIndex++;
    }
    if (quantity !== undefined) {
      if (quantity <= 0) {
        res.status(400).json({
          success: false,
          message: 'Quantity must be greater than 0'
        });
        return;
      }
      updates.push(`quantity = $${paramIndex}`);
      params.push(quantity);
      paramIndex++;
    }
    if (unit !== undefined) {
      updates.push(`unit = $${paramIndex}`);
      params.push(unit);
      paramIndex++;
    }
    if (reason !== undefined) {
      if (!WASTE_REASONS.includes(reason)) {
        res.status(400).json({
          success: false,
          message: `Invalid reason. Must be one of: ${WASTE_REASONS.join(', ')}`
        });
        return;
      }
      updates.push(`reason = $${paramIndex}`);
      params.push(reason);
      paramIndex++;
    }
    if (cost_impact !== undefined) {
      updates.push(`cost_impact = $${paramIndex}`);
      params.push(cost_impact);
      paramIndex++;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(description || null);
      paramIndex++;
    }

    if (updates.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
      return;
    }

    // Add updated_at
    updates.push(`updated_at = NOW()`);

    // Add id parameter
    params.push(id);

    const query = `
      UPDATE wastage_records 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Wastage record not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Wastage record updated successfully',
      data: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Error updating wastage record:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update wastage record'
    });
  }
};

// ============================================================
// DELETE WASTAGE RECORD
// ============================================================

export const deleteWastageRecord = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM wastage_records WHERE id = $1', [id]);

    res.status(200).json({
      success: true,
      message: 'Wastage record deleted'
    });
  } catch (error) {
    logger.error('Error deleting wastage record:', error);
    next(error);
  }
};
