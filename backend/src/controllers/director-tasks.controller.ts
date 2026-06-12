import { Request, Response } from 'express';
import { supabase } from '../config/database';

export class DirectorTasksController {

  /**
   * Create a new review task (Director only)
   * @route POST /api/finance/director/tasks
   */
  static async createTask(req: Request, res: Response) {
    try {
      const directorId = (req as any).user?.id;
      const {
        title,
        description,
        assigned_to_role,
        assigned_to_user_id,
        branch_id,
        priority,
        related_record_date,
        related_stream,
        director_notes,
        due_date
      } = req.body;

      if (!title || !description || !assigned_to_role) {
        return res.status(400).json({ success: false, message: 'title, description, and assigned_to_role are required' });
      }

      const { data, error } = await supabase
        .from('director_review_tasks')
        .insert([{
          director_id: directorId,
          title,
          description,
          assigned_to_role,
          assigned_to_user_id: assigned_to_user_id || null,
          branch_id: branch_id || null,
          priority: priority || 'MEDIUM',
          status: 'PENDING',
          related_record_date: related_record_date || null,
          related_stream: related_stream || null,
          director_notes: director_notes || null,
          due_date: due_date || null
        }])
        .select('*, branches(name)')
        .single();

      if (error) throw error;

      return res.status(201).json({ success: true, data });
    } catch (error: any) {
      console.error('Create Task Error:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get all tasks — Director sees all; others see only tasks assigned to their role
   * @route GET /api/finance/director/tasks
   */
  static async getTasks(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { status, branch_id, assigned_to_role, priority } = req.query;

      let query = supabase
        .from('director_review_tasks')
        .select(`
          *,
          branches(name),
          director:staff_profiles!director_review_tasks_director_id_fkey(first_name, last_name),
          assignee:staff_profiles!director_review_tasks_assigned_to_user_id_fkey(first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      // Non-director roles only see tasks assigned to them
      const isDirector = ['director', 'super_admin'].includes((user?.role || '').toLowerCase());
      if (!isDirector) {
        const roleMap: Record<string, string> = {
          branch_accountant: 'branch_accountant',
          accountant: 'branch_accountant',
          auditor: 'auditor',
          hr_manager: 'hr_manager',
          branch_manager: 'branch_manager',
          general_manager: 'general_manager'
        };
        const mappedRole = roleMap[user?.role?.toLowerCase()] || user?.role?.toLowerCase();
        query = query.eq('assigned_to_role', mappedRole);
      }

      if (status) query = query.eq('status', status as string);
      if (branch_id) query = query.eq('branch_id', branch_id as string);
      if (assigned_to_role) query = query.eq('assigned_to_role', assigned_to_role as string);
      if (priority) query = query.eq('priority', priority as string);

      const { data, error } = await query;
      if (error) throw error;

      return res.status(200).json({ success: true, data: data || [] });
    } catch (error: any) {
      console.error('Get Tasks Error:', error);
      return res.status(500).json({ success: false, message: error.message, data: [] });
    }
  }

  /**
   * Respond to a task (assigned staff member)
   * @route PATCH /api/finance/director/tasks/:id/respond
   */
  static async respondToTask(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { response_notes } = req.body;

      if (!response_notes) {
        return res.status(400).json({ success: false, message: 'response_notes is required' });
      }

      const { data, error } = await supabase
        .from('director_review_tasks')
        .update({
          response_notes,
          status: 'IN_PROGRESS',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Close/resolve a task (Director only)
   * @route PATCH /api/finance/director/tasks/:id/close
   */
  static async closeTask(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, director_notes } = req.body; // status: COMPLETED or DISMISSED

      const { data, error } = await supabase
        .from('director_review_tasks')
        .update({
          status: status || 'COMPLETED',
          director_notes: director_notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get staff members for a specific branch and role (for task assignment dropdown)
   * @route GET /api/finance/director/tasks/staff
   */
  static async getBranchStaff(req: Request, res: Response) {
    try {
      const { branch_id, role } = req.query;

      let query = supabase
        .from('staff_profiles')
        .select('id, first_name, last_name, role, branch_id')
        .order('first_name');

      if (branch_id) query = query.eq('branch_id', branch_id as string);
      if (role) query = query.ilike('role', `%${role}%`);

      const { data, error } = await query;
      if (error) throw error;

      return res.status(200).json({ success: true, data: data || [] });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, data: [] });
    }
  }
}
