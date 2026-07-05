import { Request, Response } from 'express';
import { supabase } from '../config/database';

// =====================================================
// SHIFT TEMPLATES
// =====================================================

// Get all shift templates
export const getShiftTemplates = async (req: Request, res: Response) => {
  try {
    const branchId = req.headers['x-branch-id'];

    let query = supabase
      .from('shift_templates')
      .select('*')
      .eq('is_active', true)
      .order('start_time', { ascending: true });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error fetching shift templates:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch shift templates'
    });
  }
};

// Create shift template
export const createShiftTemplate = async (req: Request, res: Response) => {
  try {
    const branchId = req.headers['x-branch-id'];
    const templateData = {
      ...req.body,
      branch_id: branchId
    };

    const { data, error } = await supabase
      .from('shift_templates')
      .insert([templateData])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Shift template created successfully'
    });
  } catch (error: any) {
    console.error('Error creating shift template:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create shift template'
    });
  }
};

// Update shift template
export const updateShiftTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const templateData = req.body;

    const { data, error } = await supabase
      .from('shift_templates')
      .update(templateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data,
      message: 'Shift template updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating shift template:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update shift template'
    });
  }
};

// Delete shift template
export const deleteShiftTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('shift_templates')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Shift template deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting shift template:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete shift template'
    });
  }
};

// =====================================================
// STAFF SHIFTS
// =====================================================

// Get staff shifts
export const getStaffShifts = async (req: Request, res: Response) => {
  try {
    const branchId = req.headers['x-branch-id'];
    const { startDate, endDate, staffId, status } = req.query;

    let query = supabase
      .from('staff_shifts')
      .select(`
        *,
        staff:users!staff_shifts_staff_id_fkey(id, first_name, last_name, role),
        shift_template:shift_templates(name, start_time, end_time),
        created_by_user:users!staff_shifts_created_by_fkey(first_name, last_name)
      `)
      .order('shift_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (startDate) {
      query = query.gte('shift_date', startDate);
    }

    if (endDate) {
      query = query.lte('shift_date', endDate);
    }

    if (staffId) {
      query = query.eq('staff_id', staffId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error fetching staff shifts:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch staff shifts'
    });
  }
};

// Create staff shift
export const createStaffShift = async (req: Request, res: Response) => {
  try {
    const branchId = req.headers['x-branch-id'];
    const userId = (req as any).user?.id;
    
    const shiftData = {
      ...req.body,
      branch_id: branchId,
      created_by: userId
    };

    const { data, error } = await supabase
      .from('staff_shifts')
      .insert([shiftData])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Staff shift created successfully'
    });
  } catch (error: any) {
    console.error('Error creating staff shift:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create staff shift'
    });
  }
};

// Bulk create staff shifts
export const bulkCreateStaffShifts = async (req: Request, res: Response) => {
  try {
    const branchId = req.headers['x-branch-id'];
    const userId = (req as any).user?.id;
    const { shifts } = req.body;

    if (!Array.isArray(shifts) || shifts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Shifts array is required'
      });
    }

    const shiftsData = shifts.map(shift => ({
      ...shift,
      branch_id: branchId,
      created_by: userId
    }));

    const { data, error } = await supabase
      .from('staff_shifts')
      .insert(shiftsData)
      .select();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: `${data.length} shifts created successfully`
    });
  } catch (error: any) {
    console.error('Error bulk creating staff shifts:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create staff shifts'
    });
  }
};

// Update staff shift
export const updateStaffShift = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const shiftData = req.body;

    const { data, error } = await supabase
      .from('staff_shifts')
      .update(shiftData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data,
      message: 'Staff shift updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating staff shift:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update staff shift'
    });
  }
};

// Check in to shift
export const checkInShift = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('staff_shifts')
      .update({
        check_in_time: new Date().toISOString(),
        status: 'confirmed'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data,
      message: 'Checked in successfully'
    });
  } catch (error: any) {
    console.error('Error checking in to shift:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check in'
    });
  }
};

// Check out from shift
export const checkOutShift = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('staff_shifts')
      .update({
        check_out_time: new Date().toISOString(),
        status: 'completed'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data,
      message: 'Checked out successfully'
    });
  } catch (error: any) {
    console.error('Error checking out from shift:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check out'
    });
  }
};

// Delete staff shift
export const deleteStaffShift = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('staff_shifts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Staff shift deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting staff shift:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete staff shift'
    });
  }
};

// =====================================================
// SHIFT SWAPS
// =====================================================

// Get shift swap requests
export const getShiftSwaps = async (req: Request, res: Response) => {
  try {
    const { status, staffId } = req.query;

    let query = supabase
      .from('shift_swaps')
      .select(`
        *,
        original_shift:staff_shifts!shift_swaps_original_shift_id_fkey(*),
        requesting_staff:users!shift_swaps_requesting_staff_id_fkey(first_name, last_name),
        target_staff:users!shift_swaps_target_staff_id_fkey(first_name, last_name),
        approved_by_user:users!shift_swaps_approved_by_fkey(first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (staffId) {
      query = query.or(`requesting_staff_id.eq.${staffId},target_staff_id.eq.${staffId}`);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error fetching shift swaps:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch shift swaps'
    });
  }
};

// Create shift swap request
export const createShiftSwap = async (req: Request, res: Response) => {
  try {
    const swapData = req.body;

    const { data, error } = await supabase
      .from('shift_swaps')
      .insert([swapData])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Shift swap request created successfully'
    });
  } catch (error: any) {
    console.error('Error creating shift swap:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create shift swap request'
    });
  }
};

// Approve/Reject shift swap
export const updateShiftSwapStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = (req as any).user?.id;

    const updateData: any = {
      status
    };

    if (status === 'approved') {
      updateData.approved_by = userId;
      updateData.approved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('shift_swaps')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data,
      message: `Shift swap ${status} successfully`
    });
  } catch (error: any) {
    console.error('Error updating shift swap:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update shift swap'
    });
  }
};

// Get shift statistics
export const getShiftStatistics = async (req: Request, res: Response) => {
  try {
    const branchId = req.headers['x-branch-id'];
    const { startDate, endDate } = req.query;

    let query = supabase
      .from('staff_shifts')
      .select('*');

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (startDate) {
      query = query.gte('shift_date', startDate);
    }

    if (endDate) {
      query = query.lte('shift_date', endDate);
    }

    const { data: shifts, error } = await query;

    if (error) throw error;

    const stats = {
      totalShifts: shifts?.length || 0,
      scheduledShifts: shifts?.filter(s => s.status === 'scheduled').length || 0,
      confirmedShifts: shifts?.filter(s => s.status === 'confirmed').length || 0,
      completedShifts: shifts?.filter(s => s.status === 'completed').length || 0,
      cancelledShifts: shifts?.filter(s => s.status === 'cancelled').length || 0,
      noShowShifts: shifts?.filter(s => s.status === 'no_show').length || 0
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Error fetching shift statistics:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch shift statistics'
    });
  }
};
