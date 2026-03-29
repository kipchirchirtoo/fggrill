import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { applyBranchFilter, isGlobalRole } from '../utils/branchIsolation';

// @desc    Get all maintenance tasks
// @route   GET /api/maintenance/tasks
// @access  Private
export const getTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Apply filters from query params
    let query = supabase
      .from('maintenance_tasks')
      .select('*')
      .order('created_at', { ascending: false });

    query = applyBranchFilter(query, req);
    const isGlobal = isGlobalRole(req.user?.role);
    if (isGlobal && req.query.branch_id) {
      query = query.eq('branch_id', req.query.branch_id);
    }

    if (req.query.status) {
      query = query.eq('status', req.query.status);
    }

    const { data: tasks, error } = await query;

    if (error) throw error;

    // Fetch related users separately to avoid schema cache issues
    const userIds = new Set<string>();
    tasks?.forEach(task => {
      if (task.assigned_to_id) userIds.add(task.assigned_to_id);
      if (task.reported_by_id) userIds.add(task.reported_by_id);
      if (task.verified_by_id) userIds.add(task.verified_by_id);
    });

    let usersMap = new Map();
    if (userIds.size > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .in('id', Array.from(userIds));

      usersMap = new Map(users?.map(u => [u.id, u]) || []);
    }

    // Attach user data to tasks
    const enrichedTasks = tasks?.map(task => ({
      ...task,
      assigned_to: task.assigned_to_id ? usersMap.get(task.assigned_to_id) : null,
      reported_by: task.reported_by_id ? usersMap.get(task.reported_by_id) : null,
      verified_by: task.verified_by_id ? usersMap.get(task.verified_by_id) : null
    }));

    res.status(200).json({
      success: true,
      data: enrichedTasks
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single maintenance task
// @route   GET /api/maintenance/tasks/:id
// @access  Private
export const getTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: task, error } = await supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!task) {
      res.status(404).json({
        success: false,
        message: 'Task not found'
      });
      return;
    }

    // Fetch related users separately
    const userIds = new Set<string>();
    if (task.assigned_to_id) userIds.add(task.assigned_to_id);
    if (task.reported_by_id) userIds.add(task.reported_by_id);
    if (task.verified_by_id) userIds.add(task.verified_by_id);

    let usersMap = new Map();
    if (userIds.size > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .in('id', Array.from(userIds));

      usersMap = new Map(users?.map(u => [u.id, u]) || []);
    }

    // Attach user data to task
    const enrichedTask = {
      ...task,
      assigned_to: task.assigned_to_id ? usersMap.get(task.assigned_to_id) : null,
      reported_by: task.reported_by_id ? usersMap.get(task.reported_by_id) : null,
      verified_by: task.verified_by_id ? usersMap.get(task.verified_by_id) : null
    };

    res.status(200).json({
      success: true,
      data: enrichedTask
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create maintenance task
// @route   POST /api/maintenance/tasks
// @access  Private
export const createTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const task = {
      ...req.body,
      reported_by_id: req.user.id,
      reported_at: new Date().toISOString(),
      status: 'pending'
    };

    const { data, error } = await supabase
      .from('maintenance_tasks')
      .insert([task])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update maintenance task
// @route   PUT /api/maintenance/tasks/:id
// @access  Private
export const updateTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: existingTask, error: fetchError } = await supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !existingTask) {
      res.status(404).json({
        success: false,
        message: 'Task not found'
      });
      return;
    }

    const { data, error } = await supabase
      .from('maintenance_tasks')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete maintenance task
// @route   DELETE /api/maintenance/tasks/:id
// @access  Private
export const deleteTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('maintenance_tasks')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign maintenance task
// @route   PUT /api/maintenance/tasks/:id/assign
// @access  Private
export const assignTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { assigneeId } = req.body;

    const { data, error } = await supabase
      .from('maintenance_tasks')
      .update({
        assigned_to_id: assigneeId,
        assigned_at: new Date().toISOString(),
        status: 'assigned'
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Start maintenance task
// @route   PUT /api/maintenance/tasks/:id/start
// @access  Private
export const startTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('maintenance_tasks')
      .update({
        started_at: new Date().toISOString(),
        status: 'in-progress'
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Complete maintenance task
// @route   PUT /api/maintenance/tasks/:id/complete
// @access  Private
export const completeTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('maintenance_tasks')
      .update({
        completed_at: new Date().toISOString(),
        status: 'completed'
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify maintenance task
// @route   PUT /api/maintenance/tasks/:id/verify
// @access  Private
export const verifyTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('maintenance_tasks')
      .update({
        verified_by_id: req.user.id,
        verified_at: new Date().toISOString(),
        status: 'verified'
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Report maintenance issue
// @route   POST /api/maintenance/issues
// @access  Private
export const reportIssue = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const issue = {
      ...req.body,
      reported_by_id: req.user.id,
      reported_at: new Date().toISOString(),
      status: 'pending'
    };

    const { data, error } = await supabase
      .from('maintenance_issues')
      .insert([issue])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resolve maintenance issue
// @route   PUT /api/maintenance/issues/:id/resolve
// @access  Private
export const resolveIssue = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('maintenance_issues')
      .update({
        resolved_by_id: req.user.id,
        resolved_at: new Date().toISOString(),
        status: 'resolved',
        resolution_notes: req.body.notes
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update task checklist
// @route   PUT /api/maintenance/tasks/:id/checklist
// @access  Private
export const updateChecklist = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('maintenance_tasks')
      .update({
        checklist: req.body.checklist
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add part usage to task
// @route   POST /api/maintenance/tasks/:id/parts
// @access  Private
export const addPartUsage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const partUsage = {
      task_id: req.params.id,
      ...req.body,
      used_at: new Date().toISOString(),
      used_by_id: req.user.id
    };

    const { data, error } = await supabase
      .from('maintenance_part_usage')
      .insert([partUsage])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update tool status
// @route   PUT /api/maintenance/tools/:id
// @access  Private
export const updateToolStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('maintenance_tools')
      .update({
        status: req.body.status,
        last_checked: new Date().toISOString(),
        checked_by_id: req.user.id,
        notes: req.body.notes
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get task history
// @route   GET /api/maintenance/tasks/:id/history
// @access  Private
export const getTaskHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('maintenance_task_history')
      .select(`
        *,
        performed_by:users (*)
      `)
      .eq('task_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get asset history
// @route   GET /api/maintenance/assets/:id/history
// @access  Private
export const getAssetHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('maintenance_asset_history')
      .select(`
        *,
        performed_by:users (*)
      `)
      .eq('asset_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create maintenance asset
// @route   POST /api/maintenance/assets
// @access  Private
export const createAsset = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const asset = {
      ...req.body,
      created_by_id: req.user.id,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('maintenance_assets')
      .insert([asset])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update maintenance asset
// @route   PUT /api/maintenance/assets/:id
// @access  Private
export const updateAsset = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('maintenance_assets')
      .update({
        ...req.body,
        updated_at: new Date().toISOString(),
        updated_by_id: req.user.id
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete maintenance asset
// @route   DELETE /api/maintenance/assets/:id
// @access  Private
export const deleteAsset = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('maintenance_assets')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all maintenance assets
// @route   GET /api/maintenance/assets
// @access  Private
export const getAssets = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('maintenance_assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single maintenance asset
// @route   GET /api/maintenance/assets/:id
// @access  Private
export const getAsset = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('maintenance_assets')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload task photos
// @route   POST /api/maintenance/tasks/:id/photos
// @access  Private
export const uploadTaskPhotos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    const uploadPromises = files.map(async (file) => {
      const { data, error } = await supabase.storage
        .from('maintenance-photos')
        .upload(
          `tasks/${req.params.id}/${Date.now()}-${file.originalname}`,
          file.buffer,
          {
            contentType: file.mimetype
          }
        );

      if (error) throw error;
      return data;
    });

    const uploadedFiles = await Promise.all(uploadPromises);

    // Get existing photos
    const { data: task, error: taskError } = await supabase
      .from('maintenance_tasks')
      .select('photos')
      .eq('id', req.params.id)
      .single();

    if (taskError) throw taskError;

    // Update task with new photos
    const photos = [...(task.photos || []), ...uploadedFiles.map(f => f.path)];
    const { data, error } = await supabase
      .from('maintenance_tasks')
      .update({ photos })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get maintenance schedule
// @route   GET /api/maintenance/schedule
// @access  Private
export const getSchedule = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('maintenance_tasks')
      .select('*')
      .in('status', ['pending', 'assigned', 'in-progress'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get maintenance statistics
// @route   GET /api/maintenance/stats
// @access  Private
export const getStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { count: totalTasks, error: totalError } = await supabase
      .from('maintenance_tasks')
      .select('*', { count: 'exact' })
      .limit(0);

    if (totalError) throw totalError;

    const { count: pendingTasks, error: pendingError } = await supabase
      .from('maintenance_tasks')
      .select('*', { count: 'exact' })
      .eq('status', 'pending')
      .limit(0);

    if (pendingError) throw pendingError;

    const { count: completedTasks, error: completedError } = await supabase
      .from('maintenance_tasks')
      .select('*', { count: 'exact' })
      .eq('status', 'completed')
      .limit(0);

    if (completedError) throw completedError;

    res.status(200).json({
      success: true,
      data: {
        totalTasks,
        pendingTasks,
        completedTasks
      }
    });
  } catch (error) {
    next(error);
  }
};
