// =====================================================
// HOUSEKEEPING INSPECTIONS CONTROLLER
// =====================================================

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import { ISubmitInspectionRequest, HKInspectionResult, HKTaskStatus, HKRoomStatus } from '../../types/housekeeping.types';

async function getStaffProfileId(userId: string | undefined): Promise<string | null> {
  if (!userId) return null;
  const { data , error } = await supabase.from('hk_staff_profiles').select('id').eq('user_id', userId).single();
  if (error) {
    console.error('Database error:', error);
    throw error;
  }
  return data?.id || null;
}

/**
 * @desc    Get all inspections
 * @route   GET /api/housekeeping/inspections
 * @access  Private (Supervisors, Managers)
 */
export const getInspections = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const startIndex = (page - 1) * limit;
    const { result, inspectedBy, date } = req.query;

    let query = supabase
      .from('hk_inspections')
      .select(`
        *,
        inspector:hk_staff_profiles!inspected_by(id, staff_code, user:users!user_id(first_name, last_name)),
        task:hk_tasks(id, task_number, task_type)
      `, { count: 'exact' })
      .order('inspected_at', { ascending: false })
      .range(startIndex, startIndex + limit - 1);

    if (result) query = query.eq('result', result);
    if (inspectedBy) query = query.eq('inspected_by', inspectedBy);
    if (date) query = query.gte('inspected_at', `${date}T00:00:00`).lte('inspected_at', `${date}T23:59:59`);

    const { data: inspections, error, count } = await query;
    if (error) throw error;

    res.status(200).json({
      success: true,
      count: inspections?.length || 0,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
      data: inspections
    });
  } catch (error) {
    logger.error('Error fetching inspections:', error);
    next(error);
  }
};

/**
 * @desc    Get single inspection
 * @route   GET /api/housekeeping/inspections/:id
 * @access  Private
 */
export const getInspection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: inspection, error } = await supabase
      .from('hk_inspections')
      .select(`
        *,
        inspector:hk_staff_profiles!inspected_by(id, staff_code, designation, user:users!user_id(first_name, last_name)),
        task:hk_tasks(*),
        room:rooms(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      res.status(404).json({ success: false, message: 'Inspection not found' });
      return;
    }

    res.status(200).json({ success: true, data: inspection });
  } catch (error) {
    logger.error('Error fetching inspection:', error);
    next(error);
  }
};

/**
 * @desc    Submit room inspection
 * @route   POST /api/housekeeping/inspections
 * @access  Private (Supervisors)
 */
export const submitInspection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      taskId,
      roomId,
      inspectionType,
      cleanlinessScore,
      tidinessScore,
      bathroomScore,
      amenitiesScore,
      linensScore,
      maintenanceScore,
      deficiencies,
      photos,
      notes
    } = req.body as ISubmitInspectionRequest;

    const staffId = await getStaffProfileId(req.user?.id);
    if (!staffId) {
      res.status(403).json({ success: false, message: 'Staff profile required' });
      return;
    }

    // Get room info
    const { data: room } = await supabase
      .from('rooms')
      .select('room_number')
      .eq('id', roomId)
      .single();

    // Calculate overall score
    const scores = [cleanlinessScore, tidinessScore, bathroomScore, amenitiesScore, linensScore, maintenanceScore];
    const validScores = scores.filter(s => s !== undefined && s !== null);
    const overallScore = validScores.length > 0
      ? parseFloat((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1))
      : 0;

    // Determine result
    let result: HKInspectionResult = HKInspectionResult.PASSED;
    if (overallScore < 3) {
      result = HKInspectionResult.FAILED;
    } else if (deficiencies && deficiencies.length > 0) {
      const hasMajor = deficiencies.some(d => d.severity === 'major');
      if (hasMajor) {
        result = HKInspectionResult.NEEDS_REWORK;
      } else {
        result = HKInspectionResult.PASSED_WITH_NOTES;
      }
    }

    // Create inspection
    const { data: inspection, error: inspError } = await supabase
      .from('hk_inspections')
      .insert([{
        task_id: taskId || null,
        room_id: roomId,
        room_number: room?.room_number,
        inspection_type: inspectionType,
        cleanliness_score: cleanlinessScore,
        tidiness_score: tidinessScore,
        bathroom_score: bathroomScore,
        amenities_score: amenitiesScore,
        linens_score: linensScore,
        maintenance_score: maintenanceScore,
        overall_score: overallScore,
        result,
        deficiencies: deficiencies || [],
        photos: photos || [],
        inspected_by: staffId,
        notes,
        requires_rework: result === HKInspectionResult.FAILED || result === HKInspectionResult.NEEDS_REWORK
      }])
      .select()
      .single();

    if (inspError) throw inspError;

    // Update task if provided
    if (taskId) {
      const taskStatus = result === HKInspectionResult.FAILED || result === HKInspectionResult.NEEDS_REWORK
        ? HKTaskStatus.INSPECTION_FAILED
        : HKTaskStatus.INSPECTION_PASSED;

      await supabase
        .from('hk_tasks')
        .update({ inspection_id: inspection.id, status: taskStatus })
        .eq('id', taskId);
    }

    // Update room status
    const roomStatus = result === HKInspectionResult.FAILED || result === HKInspectionResult.NEEDS_REWORK
      ? HKRoomStatus.VACANT_DIRTY
      : HKRoomStatus.VACANT_CLEAN;

    await supabase
      .from('rooms')
      .update({
        hk_status: roomStatus,
        last_inspected_at: new Date().toISOString(),
        last_inspected_by: staffId
      })
      .eq('id', roomId);

    // Create rework task if needed
    if (inspection.requires_rework && taskId) {
      const { data: originalTask } = await supabase
        .from('hk_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (originalTask) {
        const { data: reworkTask } = await supabase
          .from('hk_tasks')
          .insert([{
            room_id: roomId,
            room_number: room?.room_number,
            floor_number: originalTask.floor_number,
            task_type: originalTask.task_type,
            priority: 'high',
            status: 'pending',
            assigned_to: originalTask.assigned_to,
            is_rework: true,
            original_task_id: taskId,
            rework_count: (originalTask.rework_count || 0) + 1,
            special_instructions: `Rework required: ${deficiencies?.map(d => d.description).join(', ')}`,
            created_by: req.user?.id
          }])
          .select()
          .single();

        if (reworkTask) {
          await supabase
            .from('hk_inspections')
            .update({ rework_task_id: reworkTask.id })
            .eq('id', inspection.id);
        }
      }
    }

    res.status(201).json({ success: true, data: inspection });
    logger.info(`Inspection completed for room ${room?.room_number}: ${result}`);
  } catch (error) {
    logger.error('Error submitting inspection:', error);
    next(error);
  }
};

/**
 * @desc    Get inspection statistics
 * @route   GET /api/housekeeping/inspections/stats
 * @access  Private (Supervisors, Managers)
 */
export const getInspectionStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const today = new Date().toISOString().split('T')[0];

    let query = supabase
      .from('hk_inspections')
      .select('result, overall_score, inspected_at');

    if (startDate && endDate) {
      query = query.gte('inspected_at', `${startDate}T00:00:00`).lte('inspected_at', `${endDate}T23:59:59`);
    } else {
      query = query.gte('inspected_at', `${today}T00:00:00`);
    }

    const { data: inspections, error } = await query;
    if (error) throw error;

    const total = inspections?.length || 0;
    const passed = inspections?.filter(i => i.result === 'passed' || i.result === 'passed_with_notes').length || 0;
    const failed = inspections?.filter(i => i.result === 'failed' || i.result === 'needs_rework').length || 0;
    const avgScore = total > 0
      ? parseFloat((inspections!.reduce((sum, i) => sum + (i.overall_score || 0), 0) / total).toFixed(2))
      : 0;

    res.status(200).json({
      success: true,
      data: {
        total,
        passed,
        failed,
        passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
        avgScore
      }
    });
  } catch (error) {
    logger.error('Error fetching inspection stats:', error);
    next(error);
  }
};

/**
 * @desc    Get inspection queue (rooms pending inspection)
 * @route   GET /api/housekeeping/inspections/queue
 * @access  Private (Supervisors)
 */
export const getInspectionQueue = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.query.branchId as string || req.user?.branchId;

    const { data: tasks, error } = await supabase
      .from('hk_tasks')
      .select(`
        id, task_number, room_number, floor_number, task_type, is_vip, completed_at,
        room:rooms(id, room_type),
        completed_by_staff:hk_staff_profiles!completed_by(id, staff_code, user:users!user_id(first_name, last_name))
      `)
      .eq('status', 'pending_inspection')
      .order('is_vip', { ascending: false })
      .order('completed_at', { ascending: true });

    if (error) throw error;

    res.status(200).json({ success: true, count: tasks?.length || 0, data: tasks });
  } catch (error) {
    logger.error('Error fetching inspection queue:', error);
    next(error);
  }
};
