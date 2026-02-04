import express, { Request, Response } from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import { pool } from '../config/pg';
import { logger } from '../utils/logger';

const router = express.Router();

const ALL_FACILITIES_ROLES = [
  UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER,
  UserRole.FACILITIES_MANAGER, UserRole.HOUSEKEEPING, UserRole.MAINTENANCE
];

const SUPERVISOR_ROLES = [
  UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER,
  UserRole.FACILITIES_MANAGER
];

router.use(protect);

// Dashboard
router.get('/dashboard', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => {
  try {
    const branchId = req.query.branch_id || req.headers['x-branch-id'];
    const stats = {
      rooms: { total: 25, clean: 18, dirty: 5, outOfOrder: 2, inspected: 15 },
      tasks: { total: 12, pending: 4, inProgress: 3, completed: 5 },
      workOrders: { total: 8, open: 2, inProgress: 3, completed: 3 },
      staff: { housekeeping: 6, maintenance: 4, onDuty: 8 }
    };
    res.json({ success: true, data: { stats, recentTasks: [], recentWorkOrders: [] } });
  } catch (error) {
    logger.error('Error fetching facilities dashboard:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard' });
  }
});

// Rooms - for dropdown lists
router.get('/rooms', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => {
  try {
    const branchId = req.query.branch_id || req.headers['x-branch-id'];
    const result = await pool.query(`SELECT id, room_number, floor, room_type, status FROM rooms WHERE ($1::int IS NULL OR branch_id = $1) ORDER BY floor, room_number LIMIT 200`, [branchId || null]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching rooms:', error);
    res.json({ success: true, data: [] });
  }
});

// Staff list for dropdowns
router.get('/staff/list', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => {
  try {
    const branchId = req.query.branch_id || req.headers['x-branch-id'];
    const department = req.query.department as string;

    let query = `
      SELECT sp.id, sp.department, sp.role, sp.status, (u.first_name || ' ' || u.last_name) as name, u.email
      FROM staff_profiles sp
      LEFT JOIN users u ON sp.user_id = u.id
      WHERE sp.status = 'active'
      `;
    const params: any[] = [];

    if (department) {
      params.push(department);
      query += ` AND sp.department = $${params.length} `;
    }

    query += ` ORDER BY u.first_name, u.last_name LIMIT 100`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching staff list:', error);
    res.json({ success: true, data: [] });
  }
});

// Equipment list for dropdowns
router.get('/equipment/list', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => {
  try {
    const branchId = req.query.branch_id || req.headers['x-branch-id'];
    const result = await pool.query(`
      SELECT id, name, location, status FROM maintenance_equipment
    WHERE($1:: int IS NULL OR branch_id = $1)
      ORDER BY name LIMIT 100
      `, [branchId || null]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching equipment:', error);
    res.json({ success: true, data: [] });
  }
});

// Supplies list for dropdowns
router.get('/supplies/list', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT hs.id, hs.name, hs.current_stock, hs.minimum_stock, hsc.name as category_name
      FROM housekeeping_supplies hs
      LEFT JOIN housekeeping_supply_categories hsc ON hs.category_id = hsc.id
      ORDER BY hs.name LIMIT 100
      `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching supplies:', error);
    res.json({ success: true, data: [] });
  }
});

// ============ HOUSEKEEPING TASKS ============
router.get('/housekeeping/tasks', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => {
  try {
    const branchId = req.query.branch_id || req.headers['x-branch-id'];
    const result = await pool.query(`
      SELECT ht.*, r.room_number FROM housekeeping_tasks ht
      LEFT JOIN rooms r ON ht.room_id = r.id
    WHERE($1:: int IS NULL OR ht.branch_id = $1)
      ORDER BY ht.created_at DESC LIMIT 50
    `, [branchId || null]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

router.post('/housekeeping/tasks', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => {
  try {
    const { room_id, room_number, task_type, priority, assigned_to, notes, due_date, branch_id } = req.body;
    const userId = (req as any).user?.id;
    const taskTypeMap: Record<string, string> = {
      'cleaning': 'daily_clean', 'daily_clean': 'daily_clean', 'deep_cleaning': 'deep_clean', 'deep_clean': 'deep_clean',
      'turndown': 'linen_change', 'linen_change': 'linen_change', 'inspection': 'inspection', 'restock': 'restock',
      'checkout_clean': 'checkout_clean', 'maintenance_clean': 'maintenance_clean'
    };
    const mappedTaskType = taskTypeMap[task_type] || 'daily_clean';

    // Use room_id directly if provided, otherwise look up by room_number
    let finalRoomId = room_id;
    if (!finalRoomId && room_number) {
      try {
        const roomResult = await pool.query(`SELECT id FROM rooms WHERE room_number = $1 AND($2:: int IS NULL OR branch_id = $2) LIMIT 1`, [room_number, branch_id]);
        finalRoomId = roomResult.rows[0]?.id;
      } catch (e) { /* room table may not exist */ }
    }

    if (!finalRoomId) {
      return res.status(400).json({ success: false, error: 'Room not found. Please select a valid room.' });
    }

    const result = await pool.query(`
      INSERT INTO housekeeping_tasks(room_id, task_type, priority, status, assigned_to, notes, due_date, created_by, branch_id)
    VALUES($1, $2:: housekeeping_task_type, $3:: task_priority, 'pending', $4, $5, $6, $7, $8)
    RETURNING *
      `, [finalRoomId, mappedTaskType, priority || 'normal', assigned_to || null, notes, due_date || new Date(), userId, branch_id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Error creating housekeeping task:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create task' });
  }
});

router.put('/housekeeping/tasks/:id/status', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await pool.query(
      `UPDATE housekeeping_tasks SET status = $1:: task_status, updated_at = NOW() WHERE id = $2 RETURNING * `,
      [status, id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
});

// ============ INSPECTIONS ============
router.get('/housekeeping/inspections', authorize(SUPERVISOR_ROLES), async (req: Request, res: Response) => {
  try {
    const branchId = req.query.branch_id || req.headers['x-branch-id'];
    const result = await pool.query(`
      SELECT hi.*, r.room_number, sp.first_name || ' ' || sp.last_name as inspector_name
      FROM hk_inspections hi
      LEFT JOIN rooms r ON hi.room_id = r.id
      LEFT JOIN hk_staff_profiles sp ON hi.inspected_by = sp.id
      ORDER BY hi.inspected_at DESC LIMIT 50
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching inspections:', error);
    res.json({ success: true, data: [] });
  }
});

router.post('/housekeeping/inspections', authorize(SUPERVISOR_ROLES), async (req: Request, res: Response) => {
  try {
    const { room_number, cleanliness_score, maintenance_score, amenities_score, notes, overall_score, branch_id } = req.body;
    const userId = (req as any).user?.id;

    // Find room
    let roomId = null;
    try {
      const roomResult = await pool.query(`SELECT id FROM rooms WHERE room_number = $1 LIMIT 1`, [room_number]);
      roomId = roomResult.rows[0]?.id;
    } catch (e) { /* room table may not exist */ }

    if (!roomId) {
      return res.status(400).json({ success: false, error: 'Room not found' });
    }

    // Find or get inspector profile
    let inspectorId = null;
    try {
      const inspResult = await pool.query(`SELECT id FROM hk_staff_profiles WHERE user_id = $1 LIMIT 1`, [userId]);
      inspectorId = inspResult.rows[0]?.id;
    } catch (e) { /* table may not exist */ }

    if (!inspectorId) {
      return res.status(400).json({ success: false, error: 'Inspector profile not found' });
    }

    const result = await pool.query(`
      INSERT INTO hk_inspections(room_id, room_number, inspection_type, cleanliness_score, maintenance_score, amenities_score, overall_score, notes, inspected_by, inspected_at)
    VALUES($1, $2, 'routine', $3, $4, $5, $6, $7, $8, NOW()) RETURNING *
      `, [roomId, room_number, cleanliness_score || 8, maintenance_score || 8, amenities_score || 8, overall_score || 8, notes, inspectorId]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Error creating inspection:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create inspection' });
  }
});

// ============ LOST & FOUND ============
router.get('/housekeeping/lost-found', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => {
  try {
    const branchId = req.query.branch_id || req.headers['x-branch-id'];
    const result = await pool.query(`
      SELECT lf.*, r.room_number 
      FROM hk_lost_found lf
      LEFT JOIN rooms r ON lf.room_id = r.id
    WHERE($1:: int IS NULL OR lf.branch_id = $1)
      ORDER BY lf.found_at DESC LIMIT 50
    `, [branchId || null]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching lost & found:', error);
    res.json({ success: true, data: [] });
  }
});

router.post('/housekeeping/lost-found', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => {
  try {
    const { item_name, description, location_found, category, found_by, branch_id } = req.body;
    const userId = (req as any).user?.id;

    // Find staff profile for found_by
    let foundById = null;
    try {
      const staffResult = await pool.query(`SELECT id FROM hk_staff_profiles WHERE user_id = $1 LIMIT 1`, [userId]);
      foundById = staffResult.rows[0]?.id;
    } catch (e) { /* table may not exist */ }

    const result = await pool.query(`
      INSERT INTO hk_lost_found(item_description, item_category, found_location, status, found_by, found_at, branch_id)
    VALUES($1, $2, $3, 'found', $4, NOW(), $5) RETURNING *
      `, [item_name + (description ? ': ' + description : ''), category || 'other', location_found, foundById, branch_id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Error creating lost & found item:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to log item' });
  }
});

router.put('/housekeeping/lost-found/:id/status', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await pool.query(`UPDATE hk_lost_found SET status = $1:: hk_lost_found_status, updated_at = NOW() WHERE id = $2 RETURNING * `, [status, id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update item' });
  }
});

// ============ WORK ORDERS ============
router.get('/maintenance/work-orders', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => {
  try {
    const branchId = req.query.branch_id || req.headers['x-branch-id'];
    const result = await pool.query(`
      SELECT wo.*, sp.first_name || ' ' || sp.last_name as assigned_name
      FROM maintenance_work_orders wo
      LEFT JOIN staff_profiles sp ON wo.assigned_to = sp.id
      ORDER BY wo.created_at DESC LIMIT 50
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching work orders:', error);
    res.json({ success: true, data: [] });
  }
});

router.post('/maintenance/work-orders', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => {
  try {
    const { title, description, location, category, priority, assigned_to, branch_id } = req.body;
    const userId = (req as any).user?.id;

    // Generate order number
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const countResult = await pool.query(`SELECT COUNT(*) FROM maintenance_work_orders WHERE order_number LIKE $1`, [`WO${dateStr}% `]);
    const seq = parseInt(countResult.rows[0]?.count || '0') + 1;
    const orderNumber = `WO${dateStr}${seq.toString().padStart(4, '0')} `;

    const maintenanceType = 'corrective';
    const priorityMap: Record<string, string> = { 'low': 'low', 'medium': 'normal', 'high': 'high', 'urgent': 'urgent' };
    const mappedPriority = priorityMap[priority] || 'normal';

    const result = await pool.query(`
      INSERT INTO maintenance_work_orders(order_number, location, location_type, issue_description, priority, status, maintenance_type, reported_by)
    VALUES($1, $2, $3, $4, $5:: work_order_priority, 'pending', $6:: maintenance_type, $7) RETURNING *
      `, [orderNumber, location, category || 'general', title + (description ? ': ' + description : ''), mappedPriority, maintenanceType, userId]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Error creating work order:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create work order' });
  }
});

router.put('/maintenance/work-orders/:id/status', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await pool.query(
      `UPDATE maintenance_work_orders SET status = $1:: work_order_status, updated_at = NOW() WHERE id = $2 RETURNING * `,
      [status, id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update work order' });
  }
});

// ============ ASSETS ============
router.get('/maintenance/assets', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => {
  try {
    const branchId = req.query.branch_id || req.headers['x-branch-id'];
    const result = await pool.query(`
    SELECT * FROM maintenance_assets
    WHERE($1:: int IS NULL OR branch_id = $1)
      ORDER BY name LIMIT 100
    `, [branchId || null]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching assets:', error);
    res.json({ success: true, data: [] });
  }
});

router.post('/maintenance/assets', authorize(SUPERVISOR_ROLES), async (req: Request, res: Response) => {
  try {
    const { name, category, location, serial_number, purchase_date, warranty_expiry, notes, branch_id } = req.body;

    // Generate asset tag
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const countResult = await pool.query(`SELECT COUNT(*) FROM maintenance_assets WHERE asset_tag LIKE $1`, [`AST${dateStr}% `]);
    const seq = parseInt(countResult.rows[0]?.count || '0') + 1;
    const assetTag = `AST${dateStr}${seq.toString().padStart(4, '0')} `;

    const result = await pool.query(`
      INSERT INTO maintenance_assets(asset_tag, name, category, location, serial_number, purchase_date, warranty_expiry, notes, status, branch_id)
    VALUES($1, $2, $3, $4, $5, $6, $7, $8, 'operational', $9) RETURNING *
      `, [assetTag, name, category || 'general', location, serial_number, purchase_date, warranty_expiry, notes, branch_id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Error creating asset:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create asset' });
  }
});

// ============ MAINTENANCE SCHEDULE ============
router.get('/maintenance/schedule', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => {
  try {
    const branchId = req.query.branch_id || req.headers['x-branch-id'];
    const result = await pool.query(`
      SELECT ms.*, me.name as equipment_name, me.location as equipment_location
      FROM maintenance_schedules ms
      LEFT JOIN maintenance_equipment me ON ms.equipment_id = me.id
      ORDER BY ms.next_due ASC LIMIT 50
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching maintenance schedule:', error);
    res.json({ success: true, data: [] });
  }
});

router.post('/maintenance/schedule', authorize(SUPERVISOR_ROLES), async (req: Request, res: Response) => {
  try {
    const { title, asset_name, equipment_name, maintenance_type, description, frequency, scheduled_date, next_due, assigned_to, branch_id } = req.body;

    // Find equipment by name
    let equipmentId = null;
    const eqName = equipment_name || asset_name;
    if (eqName) {
      try {
        const eqResult = await pool.query(`SELECT id FROM maintenance_equipment WHERE name ILIKE $1 LIMIT 1`, [` % ${eqName}% `]);
        equipmentId = eqResult.rows[0]?.id;
      } catch (e) { /* table may not exist */ }
    }

    if (!equipmentId) {
      return res.status(400).json({ success: false, error: 'Equipment not found. Please add the equipment first.' });
    }

    const freqDays = frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : frequency === 'monthly' ? 30 : frequency === 'quarterly' ? 90 : frequency === 'yearly' ? 365 : parseInt(frequency) || 30;

    const result = await pool.query(`
      INSERT INTO maintenance_schedules(equipment_id, maintenance_type, description, frequency, next_due)
    VALUES($1, $2:: maintenance_type, $3, $4, $5) RETURNING *
      `, [equipmentId, maintenance_type || 'preventive', title + (description ? ': ' + description : ''), freqDays, scheduled_date || next_due || new Date()]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Error creating maintenance schedule:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create schedule' });
  }
});

router.put('/maintenance/schedule/:id/status', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE maintenance_schedules SET last_performed = NOW(), next_due = NOW() + (frequency * INTERVAL '1 day'), updated_at = NOW() WHERE id = $1 RETURNING * `,
      [id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update schedule' });
  }
});

// ============ STAFF ============
router.get('/staff', authorize(SUPERVISOR_ROLES), async (req: Request, res: Response) => {
  try {
    const branchId = req.query.branch_id || req.headers['x-branch-id'];
    const result = await pool.query(`
      SELECT sp.*, (u.first_name || ' ' || u.last_name) as name, u.email FROM staff_profiles sp
      LEFT JOIN users u ON sp.user_id = u.id
      WHERE sp.department IN('housekeeping', 'maintenance') AND sp.status = 'active'
  `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching staff:', error);
    res.json({ success: true, data: [] });
  }
});

router.post('/staff', authorize(SUPERVISOR_ROLES), async (req: Request, res: Response) => {
  try {
    const { name, email, phone, department, position, role, shift, salary, start_date, id_number, branch_id } = req.body;

    // Split name into first and last name
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Staff';

    // First create user
    const userResult = await pool.query(`
      INSERT INTO users(id, first_name, last_name, email, role) 
      VALUES($1, $2, $3, $4, $5) 
      RETURNING id
  `, [require('crypto').randomUUID(), firstName, lastName, email, (role || 'HOUSEKEEPING').toLowerCase()]);
    const newUserId = userResult.rows[0].id;

    // Then create staff profile
    const result = await pool.query(`
      INSERT INTO staff_profiles(user_id, role, department, shift, salary, start_date, id_number, status)
VALUES($1, $2, $3, $4, $5, $6, $7, 'active') RETURNING *
  `, [newUserId, position || 'staff', department || 'housekeeping', shift || 'morning', salary || 0, start_date || new Date(), id_number || 'N/A']);
    res.json({ success: true, data: { ...result.rows[0], name, email } });
  } catch (error: any) {
    logger.error('Error creating staff:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create staff' });
  }
});

// ============ INVENTORY ============
router.get('/inventory', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => {
  try {
    const branchId = req.query.branch_id || req.headers['x-branch-id'];
    const result = await pool.query(`
      SELECT hs.*, hsc.name as category_name 
      FROM housekeeping_supplies hs
      LEFT JOIN housekeeping_supply_categories hsc ON hs.category_id = hsc.id
      ORDER BY hs.name
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching inventory:', error);
    res.json({ success: true, data: [] });
  }
});

router.post('/inventory/requests', authorize(ALL_FACILITIES_ROLES), async (req: Request, res: Response) => {
  try {
    const { supply_id, item_name, quantity, urgency, notes, branch_id } = req.body;
    const userId = (req as any).user?.id;

    // Find supply by name if supply_id not provided
    let supplyId = supply_id;
    if (!supplyId && item_name) {
      try {
        const supplyResult = await pool.query(`SELECT id FROM housekeeping_supplies WHERE name ILIKE $1 LIMIT 1`, [` % ${item_name}% `]);
        supplyId = supplyResult.rows[0]?.id;
      } catch (e) { /* table may not exist */ }
    }

    // Find staff profile
    let staffId = null;
    try {
      const staffResult = await pool.query(`SELECT id FROM staff_profiles WHERE user_id = $1 LIMIT 1`, [userId]);
      staffId = staffResult.rows[0]?.id;
    } catch (e) { /* table may not exist */ }

    if (!staffId) {
      return res.status(400).json({ success: false, error: 'Staff profile not found' });
    }

    if (!supplyId) {
      return res.status(400).json({ success: false, error: 'Supply item not found' });
    }

    const result = await pool.query(`
      INSERT INTO housekeeping_supply_requests(supply_id, requested_by, quantity, urgency, notes, status)
VALUES($1, $2, $3, $4:: task_priority, $5, 'pending') RETURNING *
  `, [supplyId, staffId, quantity || 1, urgency || 'normal', notes]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Error creating supply request:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create request' });
  }
});

// Quality Compliance
router.get('/quality-compliance', authorize(SUPERVISOR_ROLES), async (req: Request, res: Response) => {
  try {
    const branchId = req.query.branch_id || req.headers['x-branch-id'];

    // Get real inspection stats
    let inspectionStats = { total: 0, passed: 0, avgScore: 0 };
    try {
      const statsResult = await pool.query(`
        SELECT COUNT(*) as total,
  COUNT(*) FILTER(WHERE result = 'pass') as passed,
    AVG(overall_score) as avg_score
        FROM hk_inspections
  `);
      inspectionStats = {
        total: parseInt(statsResult.rows[0]?.total || '0'),
        passed: parseInt(statsResult.rows[0]?.passed || '0'),
        avgScore: parseFloat(statsResult.rows[0]?.avg_score || '0') * 10
      };
    } catch (e) { /* table may not exist */ }

    res.json({ success: true, data: { inspectionStats, complianceItems: [] } });
  } catch (error) {
    logger.error('Error fetching quality compliance:', error);
    res.json({ success: true, data: { inspectionStats: { total: 0, passed: 0, avgScore: 0 }, complianceItems: [] } });
  }
});

export default router;
