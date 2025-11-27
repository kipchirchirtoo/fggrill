import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// @desc    Get all housekeeping tasks with filters and pagination
// @route   GET /api/housekeeping/tasks
// @access  Private
export const getTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const startIndex = (page - 1) * limit;

    let query = supabase
      .from('housekeeping_tasks')
      .select(`
        *,
        room:rooms(*),
        assigned_to:staff_profiles!assigned_to(id, user:users!user_id(first_name, last_name)),
        completed_by:staff_profiles!completed_by(id, user:users!user_id(first_name, last_name)),
        verified_by:staff_profiles!verified_by(id, user:users!user_id(first_name, last_name))
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(startIndex, startIndex + limit - 1);

    // Add filters
    if (req.query.status) {
      query = query.eq('status', req.query.status);
    }
    if (req.query.priority) {
      query = query.eq('priority', req.query.priority);
    }
    if (req.query.assignedTo) {
      query = query.eq('assigned_to', req.query.assignedTo);
    }
    if (req.query.taskType) {
      query = query.eq('task_type', req.query.taskType);
    }

    const { data: tasks, error, count } = await query;

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      count: tasks.length,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
      data: tasks
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single task
// @route   GET /api/housekeeping/tasks/:id
// @access  Private
export const getTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: task, error } = await supabase
      .from('housekeeping_tasks')
      .select(`
        *,
        room:rooms(*),
        assigned_to:staff_profiles!assigned_to(id, user:users!user_id(first_name, last_name)),
        completed_by:staff_profiles!completed_by(id, user:users!user_id(first_name, last_name)),
        verified_by:staff_profiles!verified_by(id, user:users!user_id(first_name, last_name)),
        issues:housekeeping_task_issues(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) {
      throw error;
    }

    if (!task) {
      res.status(404).json({
        success: false,
        message: 'Task not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new task
// @route   POST /api/housekeeping/tasks
// @access  Private
export const createTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId, taskType, priority, assignedTo, dueDate, notes } = req.body;

    // Check if room exists
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      res.status(404).json({
        success: false,
        message: 'Room not found'
      });
      return;
    }

    // Create task
    const { data: task, error: taskError } = await supabase
      .from('housekeeping_tasks')
      .insert([
        {
          room_id: roomId,
          task_type: taskType,
          priority,
          assigned_to: assignedTo,
          due_date: dueDate,
          notes,
          created_by: req.user?.id
        }
      ])
      .select()
      .single();

    if (taskError) {
      throw taskError;
    }

    // Update room status if checkout clean
    if (taskType === 'checkout_clean') {
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ status: 'cleaning' })
        .eq('id', roomId);

      if (updateError) {
        throw updateError;
      }
    }

    res.status(201).json({
      success: true,
      data: task
    });

    logger.info(`New housekeeping task created for room ${room.room_number}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Update task
// @route   PUT /api/housekeeping/tasks/:id
// @access  Private
export const updateTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, notes, suppliesUsed } = req.body;

    // Get task
    const { data: task, error: taskError } = await supabase
      .from('housekeeping_tasks')
      .select('*, room:rooms(*)')
      .eq('id', req.params.id)
      .single();

    if (taskError || !task) {
      res.status(404).json({
        success: false,
        message: 'Task not found'
      });
      return;
    }

    // Handle status changes
    if (status && status !== task.status) {
      switch (status) {
        case 'completed':
          // Update room status and cleaning details
          await supabase
            .from('rooms')
            .update({
              status: 'available',
              last_cleaned: new Date().toISOString(),
              next_cleaning: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            })
            .eq('id', task.room_id);
          break;

        case 'verified':
          // Update room inspection details
          await supabase
            .from('rooms')
            .update({
              last_inspected: new Date().toISOString()
            })
            .eq('id', task.room_id);
          break;

        case 'failed':
          // Update room status
          await supabase
            .from('rooms')
            .update({ status: 'cleaning' })
            .eq('id', task.room_id);
          break;
      }
    }

    // Update supplies inventory if provided
    if (suppliesUsed && suppliesUsed.length > 0) {
      for (const supply of suppliesUsed) {
        // Create supply transaction
        await supabase
          .from('housekeeping_supply_transactions')
          .insert([
            {
              supply_id: supply.supplyId,
              transaction_type: 'out',
              quantity: supply.quantity,
              notes: `Used in housekeeping task ${task.id}`,
              created_by: req.user?.id
            }
          ]);
      }
    }

    // Update task
    const { data: updatedTask, error: updateError } = await supabase
      .from('housekeeping_tasks')
      .update({
        status,
        notes,
        updated_at: new Date().toISOString(),
        ...(status === 'completed' ? {
          completed_at: new Date().toISOString(),
          completed_by: req.user?.id
        } : {})
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    res.status(200).json({
      success: true,
      data: updatedTask
    });

    logger.info(`Housekeeping task updated: ${task.id}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete task
// @route   DELETE /api/housekeeping/tasks/:id
// @access  Private (Admin only)
export const deleteTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get task
    const { data: task, error: taskError } = await supabase
      .from('housekeeping_tasks')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (taskError || !task) {
      res.status(404).json({
        success: false,
        message: 'Task not found'
      });
      return;
    }

    // Delete task
    const { error: deleteError } = await supabase
      .from('housekeeping_tasks')
      .delete()
      .eq('id', req.params.id);

    if (deleteError) {
      throw deleteError;
    }

    res.status(200).json({
      success: true,
      data: {}
    });

    logger.info(`Housekeeping task deleted: ${task.id}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Get room cleaning status
// @route   GET /api/housekeeping/rooms/:id/status
// @access  Private
export const getRoomStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (roomError || !room) {
      res.status(404).json({
        success: false,
        message: 'Room not found'
      });
      return;
    }

    // Get latest task for the room
    const { data: tasks, error: taskError } = await supabase
      .from('housekeeping_tasks')
      .select(`
        *,
        assigned_to:staff_profiles!assigned_to(id, user:users!user_id(first_name, last_name))
      `)
      .eq('room_id', room.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (taskError) {
      throw taskError;
    }

    res.status(200).json({
      success: true,
      data: {
        room_status: room.status,
        last_cleaned: room.last_cleaned,
        next_cleaning: room.next_cleaning,
        last_inspected: room.last_inspected,
        current_task: tasks?.[0] || null
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get staff workload
// @route   GET /api/housekeeping/staff/workload
// @access  Private
export const getStaffWorkload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get all housekeeping staff
    const { data: staff, error: staffError } = await supabase
      .from('staff_profiles')
      .select(`
        id,
        user:users!user_id(first_name, last_name),
        tasks:housekeeping_tasks!assigned_to(*)
      `)
      .eq('department', 'housekeeping');

    if (staffError) {
      throw staffError;
    }

    // Process workload data
    const workload = staff?.map((member: any) => ({
      id: member.id,
      staff_name: `${member.user?.[0]?.first_name || ''} ${member.user?.[0]?.last_name || ''}`,
      total_tasks: member.tasks?.filter((task: any) => 
        ['pending', 'in_progress'].includes(task.status)
      ).length || 0,
      tasks: member.tasks?.filter((task: any) => 
        ['pending', 'in_progress'].includes(task.status)
      ) || []
    })) || [];

    res.status(200).json({
      success: true,
      data: workload
    });
  } catch (error) {
    next(error);
  }
};

