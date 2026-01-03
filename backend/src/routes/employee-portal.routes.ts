import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

// =====================================================
// EMPLOYEE PORTAL API ROUTES
// =====================================================

// Get employee dashboard data
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Get employee profile
    const { data: profile, error: profileError } = await supabase
      .from('staff_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Get upcoming schedule
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const { data: schedules } = await supabase
      .from('staff_schedules')
      .select('*')
      .eq('staff_id', profile?.id)
      .gte('date', today)
      .lte('date', nextWeek)
      .order('date', { ascending: true });

    // Get pending tasks
    const { data: tasks } = await supabase
      .from('employee_tasks')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .order('due_date', { ascending: true })
      .limit(5);

    // Get recent announcements
    const { data: announcements } = await supabase
      .from('employee_announcements')
      .select('*')
      .eq('is_active', true)
      .or(`branch_id.is.null,branch_id.eq.${profile?.branch_id || 0}`)
      .order('published_at', { ascending: false })
      .limit(5);

    // Get leave balance (simplified calculation)
    const currentYear = new Date().getFullYear();
    const { data: leavesTaken } = await supabase
      .from('staff_leave')
      .select('start_date, end_date')
      .eq('staff_id', profile?.id)
      .eq('status', 'approved')
      .gte('start_date', `${currentYear}-01-01`);

    const totalLeaveDays = leavesTaken?.reduce((acc: number, leave: any) => {
      const start = new Date(leave.start_date);
      const end = new Date(leave.end_date);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return acc + days;
    }, 0) || 0;

    const annualLeaveEntitlement = 21; // Standard annual leave days
    const leaveBalance = annualLeaveEntitlement - totalLeaveDays;

    // Get today's clock status
    const { data: todayClock } = await supabase
      .from('employee_time_clock')
      .select('*')
      .eq('user_id', userId)
      .gte('clock_in', `${today}T00:00:00`)
      .order('clock_in', { ascending: false })
      .limit(1);

    res.json({
      success: true,
      data: {
        profile,
        schedules: schedules || [],
        tasks: tasks || [],
        announcements: announcements || [],
        leaveBalance: {
          total: annualLeaveEntitlement,
          used: totalLeaveDays,
          remaining: leaveBalance
        },
        clockStatus: todayClock?.[0] || null
      }
    });
  } catch (error: any) {
    console.error('Employee dashboard error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get employee profile
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    const { data: profile } = await supabase
      .from('staff_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    res.json({
      success: true,
      data: { ...user, staffProfile: profile }
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update employee profile
router.put('/profile', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { phone_number, address, emergency_contact } = req.body;

    // Update user table
    if (phone_number || address) {
      await supabase
        .from('users')
        .update({ phone_number, address, updated_at: new Date().toISOString() })
        .eq('id', userId);
    }

    // Update staff profile
    if (emergency_contact) {
      await supabase
        .from('staff_profiles')
        .update({ emergency_contact, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    }

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get schedules
router.get('/schedules', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { start_date, end_date } = req.query;

    const { data: profile } = await supabase
      .from('staff_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      return res.json({ success: true, data: [] });
    }

    let query = supabase
      .from('staff_schedules')
      .select('*')
      .eq('staff_id', profile.id)
      .order('date', { ascending: true });

    if (start_date) query = query.gte('date', start_date);
    if (end_date) query = query.lte('date', end_date);

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Get schedules error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clock in/out
router.post('/clock', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { action, notes } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('branch_id')
      .eq('id', userId)
      .single();

    const today = new Date().toISOString().split('T')[0];

    if (action === 'clock_in') {
      // Check if already clocked in today
      const { data: existing } = await supabase
        .from('employee_time_clock')
        .select('*')
        .eq('user_id', userId)
        .gte('clock_in', `${today}T00:00:00`)
        .is('clock_out', null)
        .single();

      if (existing) {
        return res.status(400).json({ success: false, message: 'Already clocked in' });
      }

      const { data, error } = await supabase
        .from('employee_time_clock')
        .insert({
          user_id: userId,
          branch_id: user?.branch_id,
          clock_in: new Date().toISOString(),
          notes,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, message: 'Clocked in successfully', data });
    } else if (action === 'clock_out') {
      const { data: activeRecord } = await supabase
        .from('employee_time_clock')
        .select('*')
        .eq('user_id', userId)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .single();

      if (!activeRecord) {
        return res.status(400).json({ success: false, message: 'No active clock-in found' });
      }

      const { data, error } = await supabase
        .from('employee_time_clock')
        .update({
          clock_out: new Date().toISOString(),
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', activeRecord.id)
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, message: 'Clocked out successfully', data });
    }
  } catch (error: any) {
    console.error('Clock error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get time clock history
router.get('/time-clock', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { start_date, end_date } = req.query;

    let query = supabase
      .from('employee_time_clock')
      .select('*')
      .eq('user_id', userId)
      .order('clock_in', { ascending: false });

    if (start_date) query = query.gte('clock_in', `${start_date}T00:00:00`);
    if (end_date) query = query.lte('clock_in', `${end_date}T23:59:59`);

    const { data, error } = await query.limit(50);

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Get time clock error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get leave requests
router.get('/leave', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const { data: profile } = await supabase
      .from('staff_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      return res.json({ success: true, data: [] });
    }

    const { data, error } = await supabase
      .from('staff_leave')
      .select('*')
      .eq('staff_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Get leave error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Request leave
router.post('/leave', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { leave_type, start_date, end_date, reason } = req.body;

    const { data: profile } = await supabase
      .from('staff_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      return res.status(400).json({ success: false, message: 'Staff profile not found' });
    }

    const { data, error } = await supabase
      .from('staff_leave')
      .insert({
        staff_id: profile.id,
        leave_type,
        start_date,
        end_date,
        reason,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Leave request submitted', data });
  } catch (error: any) {
    console.error('Request leave error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cancel leave request
router.delete('/leave/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    const { data: profile } = await supabase
      .from('staff_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    const { error } = await supabase
      .from('staff_leave')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('staff_id', profile?.id)
      .eq('status', 'pending');

    if (error) throw error;
    res.json({ success: true, message: 'Leave request cancelled' });
  } catch (error: any) {
    console.error('Cancel leave error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get tasks
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { status } = req.query;

    let query = supabase
      .from('employee_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Get tasks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update task status
router.put('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { status, notes } = req.body;

    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }
    if (notes) updateData.notes = notes;

    const { data, error } = await supabase
      .from('employee_tasks')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Task updated', data });
  } catch (error: any) {
    console.error('Update task error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get payslips
router.get('/payslips', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const { data: profile } = await supabase
      .from('staff_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      return res.json({ success: true, data: [] });
    }

    const { data, error } = await supabase
      .from('staff_payroll')
      .select('*')
      .eq('staff_id', profile.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Get payslips error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get documents
router.get('/documents', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { type } = req.query;

    let query = supabase
      .from('employee_documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('document_type', type);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Get documents error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get announcements
router.get('/announcements', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const { data: user } = await supabase
      .from('users')
      .select('branch_id')
      .eq('id', userId)
      .single();

    const { data, error } = await supabase
      .from('employee_announcements')
      .select('*')
      .eq('is_active', true)
      .or(`branch_id.is.null,branch_id.eq.${user?.branch_id || 0}`)
      .order('published_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Get announcements error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get training records
router.get('/training', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const { data, error } = await supabase
      .from('employee_training')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Get training error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get performance reviews
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const { data: profile } = await supabase
      .from('staff_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      return res.json({ success: true, data: [] });
    }

    const { data, error } = await supabase
      .from('staff_performance')
      .select('*')
      .eq('staff_id', profile.id)
      .order('review_period_year', { ascending: false })
      .order('review_period_month', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Get performance error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
