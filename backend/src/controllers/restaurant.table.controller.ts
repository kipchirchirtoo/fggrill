import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// @desc    Get all tables with current status
// @route   GET /api/restaurant/tables
// @access  Private (Restaurant Staff)
export const getTables = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { branch_id, section_id, status } = req.query;

    let query = supabase
      .from('restaurant_tables')
      .select(`
        *,
        section:restaurant_sections(*),
        current_assignment:restaurant_table_assignments!inner(
          *,
          server:staff_profiles(*)
        )
      `)
      .eq('is_active', true);

    const branchId = req.user?.branch_id || req.query.branch_id;
    if (branchId) query = query.eq('branch_id', branchId);
    if (section_id) query = query.eq('section_id', section_id);
    if (status) query = query.eq('status', status);

    const { data: tables, error } = await query.order('table_number');

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: tables?.length || 0,
      data: tables
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single table
// @route   GET /api/restaurant/tables/:id
// @access  Private
export const getTableById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data: table, error } = await supabase
      .from('restaurant_tables')
      .select(`
        *,
        section:restaurant_sections(*),
        current_assignment:restaurant_table_assignments(
          *,
          server:staff_profiles(*)
        ),
        current_order:restaurant_orders!inner(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    if (!table) {
      res.status(404).json({
        success: false,
        message: 'Table not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: table
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new table
// @route   POST /api/restaurant/tables
// @access  Private (Manager)
export const createTable = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      branchId,
      sectionId,
      tableNumber,
      capacity,
      positionX,
      positionY,
      notes
    } = req.body;

    const { data: table, error } = await supabase
      .from('restaurant_tables')
      .insert([{
        branch_id: req.user?.branch_id || branchId,
        section_id: sectionId,
        table_number: tableNumber,
        capacity,
        position_x: positionX,
        position_y: positionY,
        notes,
        status: 'available'
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: table
    });

    logger.info(`New table created: ${tableNumber}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Update table
// @route   PUT /api/restaurant/tables/:id
// @access  Private (Manager)
export const updateTable = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      sectionId,
      tableNumber,
      capacity,
      positionX,
      positionY,
      notes,
      isActive
    } = req.body;

    const { data: table, error } = await supabase
      .from('restaurant_tables')
      .update({
        section_id: sectionId,
        table_number: tableNumber,
        capacity,
        position_x: positionX,
        position_y: positionY,
        notes,
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: table
    });

    logger.info(`Table updated: ${tableNumber}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Update table status
// @route   PUT /api/restaurant/tables/:id/status
// @access  Private (Restaurant Staff)
export const updateTableStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status } = req.body;

    const { data: table, error } = await supabase
      .from('restaurant_tables')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: table
    });

    logger.info(`Table ${table.table_number} status updated to ${status}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Assign server to table
// @route   POST /api/restaurant/tables/:id/assign
// @access  Private (Restaurant Staff)
export const assignServer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { serverId } = req.body;
    const tableId = req.params.id;

    // End any existing assignments for this table
    await supabase
      .from('restaurant_table_assignments')
      .update({
        is_active: false,
        ended_at: new Date().toISOString()
      })
      .eq('table_id', tableId)
      .eq('is_active', true);

    // Create new assignment
    const { data: assignment, error } = await supabase
      .from('restaurant_table_assignments')
      .insert([{
        table_id: tableId,
        server_id: serverId,
        is_active: true
      }])
      .select(`
        *,
        table:restaurant_tables(*),
        server:staff_profiles(*)
      `)
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: assignment
    });

    logger.info(`Server assigned to table ${tableId}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Get floor plan with all tables
// @route   GET /api/restaurant/tables/floor-plan
// @access  Private
export const getFloorPlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { branch_id } = req.query;

    let query = supabase
      .from('restaurant_tables')
      .select(`
        *,
        section:restaurant_sections(*)
      `)
      .eq('is_active', true);

    if (branch_id) {
      query = query.eq('branch_id', branch_id);
    }

    const { data: tables, error } = await query;

    if (error) throw error;

    // Group by section
    const floorPlan = tables?.reduce((acc: any, table: any) => {
      const sectionId = table.section_id || 'unassigned';
      if (!acc[sectionId]) {
        acc[sectionId] = {
          section: table.section,
          tables: []
        };
      }
      acc[sectionId].tables.push(table);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: floorPlan
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update floor plan (batch update positions)
// @route   PUT /api/restaurant/tables/floor-plan
// @access  Private (Manager)
export const updateFloorPlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { tables } = req.body; // Array of {id, positionX, positionY}

    const updates = tables.map(async (table: any) => {
      return supabase
        .from('restaurant_tables')
        .update({
          position_x: table.positionX,
          position_y: table.positionY,
          updated_at: new Date().toISOString()
        })
        .eq('id', table.id);
    });

    await Promise.all(updates);

    res.status(200).json({
      success: true,
      message: 'Floor plan updated successfully'
    });

    logger.info(`Floor plan updated for ${tables.length} tables`);
  } catch (error) {
    next(error);
  }
};

// @desc    Get table occupancy stats
// @route   GET /api/restaurant/tables/stats
// @access  Private
export const getTableStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { branch_id } = req.query;

    let query = supabase
      .from('restaurant_tables')
      .select('status, capacity')
      .eq('is_active', true);

    if (branch_id) {
      query = query.eq('branch_id', branch_id);
    }

    const { data: tables, error } = await query;

    if (error) throw error;

    const stats = {
      total: tables?.length || 0,
      available: tables?.filter(t => t.status === 'available').length || 0,
      occupied: tables?.filter(t => t.status === 'occupied').length || 0,
      reserved: tables?.filter(t => t.status === 'reserved').length || 0,
      cleaning: tables?.filter(t => t.status === 'cleaning').length || 0,
      maintenance: tables?.filter(t => t.status === 'maintenance').length || 0,
      totalCapacity: tables?.reduce((sum, t) => sum + (t.capacity || 0), 0) || 0,
      availableCapacity: tables?.filter(t => t.status === 'available').reduce((sum, t) => sum + (t.capacity || 0), 0) || 0
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};
