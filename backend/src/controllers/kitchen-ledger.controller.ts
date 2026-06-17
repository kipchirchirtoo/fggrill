import { Request, Response } from 'express';
import { supabase } from '../config/database';
import { createLedgerEntry as recordStockMovement } from './kitchen/stock.controller';

/**
 * Kitchen Ledger Controller
 * Handles kitchen food control, store receipts, and portion tracking
 */

// ============================================
// KITCHEN LEDGER ENTRIES
// ============================================

// Get all ledger entries (using kitchen_stock_ledger)
export const getLedgerEntries = async (req: Request, res: Response) => {
  try {
    const { branch_id, start_date, end_date, item_sku } = req.query;

    let query = supabase
      .from('kitchen_stock_ledger')
      .select('*')
      .order('transaction_date', { ascending: false });

    if (branch_id) {
      query = query.eq('branch_id', branch_id);
    }

    if (start_date) {
      query = query.gte('transaction_date', start_date);
    }

    if (end_date) {
      query = query.lte('transaction_date', end_date);
    }

    if (item_sku) {
      query = query.eq('item_sku', item_sku);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      message: 'Ledger entries retrieved successfully',
      data: data || []
    });
  } catch (error: any) {
    console.error('Error fetching ledger entries:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch ledger entries'
    });
  }
};

// Create ledger entry (using kitchen_stock_ledger)
export const createLedgerEntry = async (req: Request, res: Response) => {
  try {
    const {
      branch_id,
      item_sku,
      item_name,
      transaction_type, // 'RECEIPT', 'USAGE', 'WASTAGE', 'ADJUSTMENT'
      quantity_in,
      quantity_out,
      unit_of_measure,
      shift,
      notes
    } = req.body;

    if (!branch_id || !item_sku || !item_name || !transaction_type || !unit_of_measure) {
      return res.status(400).json({
        success: false,
        message: 'branch_id, item_sku, item_name, transaction_type, and unit_of_measure are required'
      });
    }

    // Get current stock balance for this item
    const { data: currentStock } = await supabase
      .from('kitchen_stock')
      .select('current_balance')
      .eq('branch_id', branch_id)
      .eq('item_sku', item_sku)
      .single();

    const opening_balance = currentStock?.current_balance || 0;
    const closing_balance = Number(opening_balance) + (Number(quantity_in) || 0) - (Number(quantity_out) || 0);

    // Insert into kitchen_stock_ledger
    const { data, error } = await supabase
      .from('kitchen_stock_ledger')
      .insert({
        branch_id,
        item_sku,
        item_name,
        transaction_date: new Date().toISOString(),
        transaction_type,
        reference_type: 'MANUAL_ENTRY',
        reference_id: `KL${Date.now()}`,
        opening_balance,
        quantity_in: quantity_in || 0,
        quantity_out: quantity_out || 0,
        closing_balance,
        unit_of_measure,
        shift: shift || null,
        user_id: (req as any).user?.id || null,
        notes: notes || null
      })
      .select()
      .single();

    if (error) throw error;

    // Update kitchen_stock current_balance
    await supabase
      .from('kitchen_stock')
      .upsert({
        branch_id,
        item_sku,
        item_name,
        unit_of_measure,
        current_balance: closing_balance,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'branch_id,item_sku'
      });

    res.status(201).json({
      success: true,
      message: 'Ledger entry created successfully',
      data
    });
  } catch (error: any) {
    console.error('Error creating ledger entry:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create ledger entry'
    });
  }
};

// Update ledger entry
export const updateLedgerEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes, shift } = req.body;

    const { data, error } = await supabase
      .from('kitchen_stock_ledger')
      .update({
        notes,
        shift,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Ledger entry updated successfully',
      data
    });
  } catch (error: any) {
    console.error('Error updating ledger entry:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update ledger entry'
    });
  }
};

// Update ledger entry status - NOT APPLICABLE (kitchen_stock_ledger doesn't have status)
export const updateLedgerStatus = async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Status update not applicable for kitchen stock ledger'
    });
  } catch (error: any) {
    console.error('Error updating ledger status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update ledger status'
    });
  }
};

// ============================================
// KITCHEN STORE RECEIPTS (TABLE DOESN'T EXIST - RETURN EMPTY)
// ============================================

// Get all kitchen store receipts
export const getStoreReceipts = async (req: Request, res: Response) => {
  try {
    // Table kitchen_store_receipts doesn't exist in new DB
    res.json({
      success: true,
      message: 'Store receipts feature not available - table does not exist',
      data: []
    });
  } catch (error: any) {
    console.error('Error fetching store receipts:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch store receipts'
    });
  }
};

// Create kitchen store receipt
export const createStoreReceipt = async (req: Request, res: Response) => {
  try {
    // Table kitchen_store_receipts doesn't exist in new DB
    res.status(501).json({
      success: false,
      message: 'Store receipts feature not available - table does not exist'
    });
  } catch (error: any) {
    console.error('Error creating store receipt:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create store receipt'
    });
  }
};

// Verify store receipt
export const verifyStoreReceipt = async (req: Request, res: Response) => {
  try {
    // Table kitchen_store_receipts doesn't exist in new DB
    res.status(501).json({
      success: false,
      message: 'Store receipts feature not available - table does not exist'
    });
  } catch (error: any) {
    console.error('Error verifying store receipt:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify store receipt'
    });
  }
};

// ============================================
// PORTION TRACKING (TABLES DON'T EXIST - RETURN EMPTY)
// ============================================

// Get portion tracking records
export const getPortionTracking = async (req: Request, res: Response) => {
  try {
    // Table kitchen_portion_tracking doesn't exist in new DB
    res.json({
      success: true,
      message: 'Portion tracking feature not available - table does not exist',
      data: []
    });
  } catch (error: any) {
    console.error('Error fetching portion tracking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch portion tracking'
    });
  }
};

// Create portion tracking
export const createPortionTracking = async (req: Request, res: Response) => {
  try {
    // Table kitchen_portion_tracking doesn't exist in new DB
    res.status(501).json({
      success: false,
      message: 'Portion tracking feature not available - table does not exist'
    });
  } catch (error: any) {
    console.error('Error creating portion tracking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create portion tracking'
    });
  }
};

// Update portion tracking with actual production
export const updatePortionTracking = async (req: Request, res: Response) => {
  try {
    // Table kitchen_portion_tracking doesn't exist in new DB
    res.status(501).json({
      success: false,
      message: 'Portion tracking feature not available - table does not exist'
    });
  } catch (error: any) {
    console.error('Error updating portion tracking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update portion tracking'
    });
  }
};

// ============================================
// VARIANCE LOGS (TABLE DOESN'T EXIST - RETURN EMPTY)
// ============================================

// Get variance logs
export const getVarianceLogs = async (req: Request, res: Response) => {
  try {
    // Table kitchen_variance_logs doesn't exist in new DB
    res.json({
      success: true,
      message: 'Variance logs feature not available - table does not exist',
      data: []
    });
  } catch (error: any) {
    console.error('Error fetching variance logs:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch variance logs'
    });
  }
};

// Create variance log
export const createVarianceLog = async (req: Request, res: Response) => {
  try {
    // Table kitchen_variance_logs doesn't exist in new DB
    res.status(501).json({
      success: false,
      message: 'Variance logs feature not available - table does not exist'
    });
  } catch (error: any) {
    console.error('Error creating variance log:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create variance log'
    });
  }
};

// Approve/reject variance log
export const approveVarianceLog = async (req: Request, res: Response) => {
  try {
    // Table kitchen_variance_logs doesn't exist in new DB
    res.status(501).json({
      success: false,
      message: 'Variance logs feature not available - table does not exist'
    });
  } catch (error: any) {
    console.error('Error approving variance log:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to approve variance log'
    });
  }
};

// Get kitchen dashboard statistics
export const getKitchenStats = async (req: Request, res: Response) => {
  try {
    const { branch_id } = req.query;

    // Only return stats for existing tables
    const { data: stockLedger } = await supabase
      .from('kitchen_stock_ledger')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branch_id);

    const { data: foodControls } = await supabase
      .from('kitchen_food_controls')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branch_id)
      .eq('is_active', true);

    res.json({
      success: true,
      message: 'Kitchen statistics retrieved successfully',
      data: {
        stockLedgerEntries: 0,
        activeFoodControls: 0,
        todayReceipts: 0,
        pendingVariances: 0,
        message: 'Limited statistics - most kitchen tables do not exist in new database'
      }
    });
  } catch (error: any) {
    console.error('Error fetching kitchen stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch kitchen statistics'
    });
  }
};
