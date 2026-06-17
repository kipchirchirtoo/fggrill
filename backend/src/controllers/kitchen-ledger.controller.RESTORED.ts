import { Request, Response } from 'express';
import { supabase } from '../config/database';
import { createLedgerEntry as recordStockMovement } from './kitchen/stock.controller';

/**
 * Kitchen Ledger Controller - RESTORED FOR NEW TABLES
 * Handles kitchen food control, store receipts, and portion tracking
 * Updated: 2026-06-17 - Uses newly created tables
 */

// ============================================
// KITCHEN LEDGER ENTRIES (kitchen_stock_ledger)
// ============================================

// Get all ledger entries
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

    const { data, error} = await query;

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

// Create ledger entry
export const createLedgerEntry = async (req: Request, res: Response) => {
  try {
    const {
      branch_id,
      item_sku,
      item_name,
      transaction_type,
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

    // Get current stock balance
    const { data: currentStock } = await supabase
      .from('kitchen_stock')
      .select('current_balance')
      .eq('branch_id', branch_id)
      .eq('item_sku', item_sku)
      .single();

    const opening_balance = currentStock?.current_balance || 0;
    const closing_balance = Number(opening_balance) + (Number(quantity_in) || 0) - (Number(quantity_out) || 0);

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

// Update ledger entry status
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
// KITCHEN STORE RECEIPTS
// ============================================

// Get all kitchen store receipts
export const getStoreReceipts = async (req: Request, res: Response) => {
  try {
    const { branch_id, status, start_date, end_date } = req.query;

    let query = supabase
      .from('kitchen_store_receipts')
      .select(`
        *,
        items:kitchen_store_receipt_items(*)
      `)
      .order('receipt_date', { ascending: false });

    if (branch_id) {
      query = query.eq('branch_id', branch_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (start_date) {
      query = query.gte('receipt_date', start_date);
    }

    if (end_date) {
      query = query.lte('receipt_date', end_date);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      message: 'Store receipts retrieved successfully',
      data: data || []
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
    const {
      branch_id,
      dispatch_note_id,
      received_from,
      items,
      remarks
    } = req.body;

    // Generate receipt number
    const { data: receiptNumberData } = await supabase
      .rpc('generate_kitchen_receipt_number');

    const receipt_number = receiptNumberData || `KR${Date.now()}`;

    // Create receipt header
    const { data: receipt, error: receiptError } = await supabase
      .from('kitchen_store_receipts')
      .insert({
        receipt_number,
        branch_id,
        dispatch_note_id,
        received_from,
        received_by: (req as any).user?.id,
        total_items: items?.length || 0,
        remarks,
        status: 'pending'
      })
      .select()
      .single();

    if (receiptError) throw receiptError;

    // Create receipt items
    if (items && items.length > 0) {
      const itemsToInsert = items.map((item: any) => ({
        receipt_id: receipt.id,
        item_sku: item.item_sku,
        item_name: item.item_name,
        expected_quantity: item.expected_quantity,
        received_quantity: item.received_quantity,
        unit_of_measure: item.unit_of_measure,
        expected_portions: item.expected_portions,
        status: Number(item.received_quantity) < Number(item.expected_quantity) ? 'shortage' :
          Number(item.received_quantity) > Number(item.expected_quantity) ? 'excess' : 'ok',
        remarks: item.remarks
      }));

      const { error: itemsError } = await supabase
        .from('kitchen_store_receipt_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;
    }

    // Fetch complete receipt with items
    const { data: completeReceipt } = await supabase
      .from('kitchen_store_receipts')
      .select(`
        *,
        items:kitchen_store_receipt_items(*)
      `)
      .eq('id', receipt.id)
      .single();

    res.status(201).json({
      success: true,
      message: 'Store receipt created successfully',
      data: completeReceipt
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
    const { id } = req.params;
    const { status, remarks } = req.body;

    const { data, error } = await supabase
      .from('kitchen_store_receipts')
      .update({
        status: status || 'verified',
        verified_by: (req as any).user?.id,
        verified_at: new Date().toISOString(),
        remarks
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Store receipt verified successfully',
      data
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
// PORTION TRACKING
// ============================================

// Get portion tracking records
export const getPortionTracking = async (req: Request, res: Response) => {
  try {
    const { branch_id, status, start_date, end_date } = req.query;

    let query = supabase
      .from('kitchen_portion_tracking')
      .select('*')
      .order('tracking_date', { ascending: false });

    if (branch_id) {
      query = query.eq('branch_id', branch_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (start_date) {
      query = query.gte('tracking_date', start_date);
    }

    if (end_date) {
      query = query.lte('tracking_date', end_date);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      message: 'Portion tracking records retrieved successfully',
      data: data || []
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
    const {
      branch_id,
      receipt_id,
      item_sku,
      item_name,
      menu_item_id,
      menu_item_name,
      received_quantity,
      unit_of_measure,
      expected_portions
    } = req.body;

    // Generate tracking number
    const { data: trackingNumberData } = await supabase
      .rpc('generate_portion_tracking_number');

    const tracking_number = trackingNumberData || `PT${Date.now()}`;

    const { data, error } = await supabase
      .from('kitchen_portion_tracking')
      .insert({
        tracking_number,
        branch_id,
        receipt_id,
        item_sku,
        item_name,
        menu_item_id,
        menu_item_name,
        received_quantity,
        unit_of_measure,
        expected_portions,
        chef_id: (req as any).user?.id,
        status: 'tracking'
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Portion tracking created successfully',
      data
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
    const { id } = req.params;
    const { actual_portions_produced, variance_reason, production_notes } = req.body;

    const { data: current } = await supabase
      .from('kitchen_portion_tracking')
      .select('*')
      .eq('id', id)
      .single();

    if (!current) {
      return res.status(404).json({
        success: false,
        message: 'Portion tracking record not found'
      });
    }

    const updateData: any = {
      actual_portions_produced,
      variance_reason,
      production_notes,
      updated_at: new Date().toISOString()
    };

    if (Number(actual_portions_produced) !== Number(current.expected_portions) && !variance_reason) {
      updateData.status = 'variance_pending_reason';
    } else if (Number(actual_portions_produced) !== Number(current.expected_portions) && variance_reason) {
      updateData.status = 'variance_reported';
    } else {
      updateData.status = 'completed';
    }

    const { data, error } = await supabase
      .from('kitchen_portion_tracking')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Portion tracking updated successfully',
      data
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
// VARIANCE LOGS
// ============================================

// Get variance logs
export const getVarianceLogs = async (req: Request, res: Response) => {
  try {
    const { portion_tracking_id, branch_id, approval_status } = req.query;

    let query = supabase
      .from('kitchen_variance_logs')
      .select('*')
      .order('reported_at', { ascending: false });

    if (portion_tracking_id) {
      query = query.eq('portion_tracking_id', portion_tracking_id);
    }

    if (branch_id) {
      query = query.eq('branch_id', branch_id);
    }

    if (approval_status) {
      query = query.eq('approval_status', approval_status);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      message: 'Variance logs retrieved successfully',
      data: data || []
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
    const {
      portion_tracking_id,
      branch_id,
      variance_type,
      variance_amount,
      reason,
      corrective_action,
      cost_impact
    } = req.body;

    const { data, error } = await supabase
      .from('kitchen_variance_logs')
      .insert({
        portion_tracking_id,
        branch_id,
        variance_type,
        variance_amount,
        reason,
        corrective_action,
        cost_impact,
        reported_by: (req as any).user?.id,
        approval_status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Variance log created successfully',
      data
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
    const { id } = req.params;
    const { approval_status, remarks } = req.body;

    const { data, error } = await supabase
      .from('kitchen_variance_logs')
      .update({
        approval_status,
        approved_by: (req as any).user?.id,
        approved_at: new Date().toISOString(),
        remarks
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: `Variance log ${approval_status} successfully`,
      data
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
    const today = new Date().toISOString().split('T')[0];

    // Get today's receipts
    const { count: receiptsCount } = await supabase
      .from('kitchen_store_receipts')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branch_id)
      .gte('receipt_date', today);

    // Get pending variance approvals
    const { count: pendingVariancesCount } = await supabase
      .from('kitchen_variance_logs')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branch_id)
      .eq('approval_status', 'pending');

    // Get today's portion tracking
    const { data: portionTracking } = await supabase
      .from('kitchen_portion_tracking')
      .select('status')
      .eq('branch_id', branch_id)
      .eq('tracking_date', today);

    res.json({
      success: true,
      message: 'Kitchen statistics retrieved successfully',
      data: {
        todayReceipts: receiptsCount || 0,
        pendingVariances: pendingVariancesCount || 0,
        activePortionTracking: portionTracking?.filter(p => p.status === 'tracking').length || 0,
        portionVariances: portionTracking?.filter(p => p.status === 'variance_reported').length || 0
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
