import express from 'express';
import { pool } from '../config/pg';
import { protect } from '../middleware/auth';
import { validateCentralOperationsRole } from '../middleware/role-validation';

const router = express.Router();

/**
 * Central Operations Routes
 * These routes handle all central operations functionality including:
 * - Multi-branch operations
 * - Central warehouse management
 * - Branch oversight and comparison
 * - Strategic planning
 */

// Dashboard endpoint
router.get('/dashboard', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    // 1. Branch stats
    const { rows: branchStats } = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active
      FROM branches
    `);

    // 2. Inventory stats - combine simple_items and inventory_items
    let inventoryStats = [{ total_items: 0, low_stock: 0, total_value: 0 }];
    try {
      const { rows } = await pool.query(`
        WITH combined_inventory AS (
          SELECT quantity, reorder_level, (quantity * cost_price) as value 
          FROM simple_items WHERE quantity IS NOT NULL
          UNION ALL
          SELECT 
            COALESCE(par_stock, 0) as quantity, 
            COALESCE(reorder_point, 10) as reorder_level, 
            COALESCE(par_stock * unit_cost, 0) as value 
          FROM inventory_items WHERE par_stock IS NOT NULL
        )
        SELECT 
          COUNT(*) as total_items,
          COUNT(*) FILTER (WHERE quantity <= reorder_level) as low_stock,
          COALESCE(SUM(value), 0) as total_value
        FROM combined_inventory
      `);
      inventoryStats = rows;
    } catch (e) {
      console.error('Inventory query error:', e);
    }

    // 3. Request stats
    let requestStats = [{ total: 0, pending: 0, approved: 0 }];
    try {
      const { rows } = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'PENDING' OR status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'APPROVED' OR status = 'approved') as approved
        FROM stock_requests
      `);
      requestStats = rows;
    } catch (e) {
      console.error('Stock requests query error:', e);
    }

    // 4. Dispatch stats
    let dispatchStats = [{ total: 0, pending: 0, in_transit: 0, delivered: 0 }];
    try {
      const { rows } = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'PENDING' OR status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'DISPATCHED' OR status = 'in_transit' OR status = 'IN_TRANSIT') as in_transit,
          COUNT(*) FILTER (WHERE status = 'DELIVERED' OR status = 'delivered') as delivered
        FROM dispatch_notes
      `);
      dispatchStats = rows;
    } catch (e) {
      console.error('Dispatch notes query error:', e);
    }

    // 5. Revenue stats (Today, Current Month, and Growth)
    let revenueStats = { today: 0, month: 0, growth: 0 };
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const firstDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

      const revenueQuery = `
        WITH all_revenue AS (
          SELECT total_amount, created_at, status::text FROM restaurant_orders WHERE status::text != 'cancelled'
          UNION ALL
          SELECT total_amount, created_at, status::text FROM bookings WHERE status::text != 'cancelled'
          UNION ALL
          SELECT total as total_amount, created_at, status::text FROM bar_orders WHERE status::text != 'cancelled'
        )
        SELECT 
          COALESCE(SUM(CASE WHEN DATE(created_at) = $1 THEN total_amount ELSE 0 END), 0) as today,
          COALESCE(SUM(CASE WHEN DATE(created_at) >= $2 THEN total_amount ELSE 0 END), 0) as current_month,
          COALESCE(SUM(CASE WHEN DATE(created_at) >= $3 AND DATE(created_at) <= $4 THEN total_amount ELSE 0 END), 0) as prev_month
        FROM all_revenue
      `;

      const { rows: revRows } = await pool.query(revenueQuery, [today, firstDayOfMonth, firstDayOfPrevMonth, lastDayOfPrevMonth]);

      const currentMonthRev = parseFloat(revRows[0]?.current_month || '0');
      const prevMonthRev = parseFloat(revRows[0]?.prev_month || '0');

      let growth = 0;
      if (prevMonthRev > 0) {
        growth = ((currentMonthRev - prevMonthRev) / prevMonthRev) * 100;
      } else if (currentMonthRev > 0) {
        growth = 100; // 100% growth if there was no revenue last month
      }

      revenueStats = {
        today: parseFloat(revRows[0]?.today || '0'),
        month: currentMonthRev,
        growth: parseFloat(growth.toFixed(1))
      };
    } catch (e) {
      console.error('Revenue query error:', e);
    }

    console.log('Dashboard stats - Branch stats:', branchStats[0]);
    console.log('Dashboard stats - Inventory stats:', inventoryStats[0]);
    console.log('Dashboard stats - Request stats:', requestStats[0]);
    console.log('Dashboard stats - Dispatch stats:', dispatchStats[0]);
    console.log('Dashboard stats - Revenue stats:', revenueStats);

    res.status(200).json({
      success: true,
      message: 'Dashboard data retrieved successfully',
      data: {
        stats: {
          totalBranches: parseInt(String(branchStats[0]?.total || '0')),
          activeBranches: parseInt(String(branchStats[0]?.active || '0')),
          inventory: {
            totalItems: parseInt(String(inventoryStats[0]?.total_items || '0')),
            lowStockItems: parseInt(String(inventoryStats[0]?.low_stock || '0')),
            totalValue: parseFloat(String(inventoryStats[0]?.total_value || '0'))
          },
          requests: {
            total: parseInt(String(requestStats[0]?.total || '0')),
            pending: parseInt(String(requestStats[0]?.pending || '0')),
            approved: parseInt(String(requestStats[0]?.approved || '0'))
          },
          dispatches: {
            total: parseInt(String(dispatchStats[0]?.total || '0')),
            pending: parseInt(String(dispatchStats[0]?.pending || '0')),
            inTransit: parseInt(String(dispatchStats[0]?.in_transit || '0')),
            delivered: parseInt(String(dispatchStats[0]?.delivered || '0'))
          },
          revenue: revenueStats
        }
      }
    });
  } catch (error) {
    console.error('Error getting central operations dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


// Branch listing endpoint
router.get('/branches', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    // Query branches with only columns that exist
    const { rows } = await pool.query(`
      SELECT id, name, code, location, status, is_main_branch
      FROM branches
      ORDER BY is_main_branch DESC, name
    `);

    res.status(200).json({
      success: true,
      message: 'Branches retrieved successfully',
      data: rows
    });
  } catch (error) {
    console.error('Error getting branches:', error);

    // Fallback to hardcoded branches if database query fails
    const fallbackBranches = [
      { id: 1, name: 'Bomet', code: 'BOM', location: 'Bomet Town', status: 'active', is_main_branch: true },
      { id: 2, name: 'Kericho', code: 'KER', location: 'Kericho Town', status: 'active', is_main_branch: false },
      { id: 3, name: 'Kapsoit', code: 'KAP', location: 'Kapsoit', status: 'active', is_main_branch: false },
      { id: 4, name: 'Litein', code: 'LIT', location: 'Litein Town', status: 'active', is_main_branch: false }
    ];

    res.status(200).json({
      success: true,
      message: 'Branches retrieved (fallback)',
      data: fallbackBranches
    });
  }
});

// Branch comparison endpoint
// Branch comparison endpoint
router.get('/branches/compare', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { metric = 'revenue', period = 'month' } = req.query;

    let startDate = new Date();
    if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (period === 'year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    } else {
      startDate.setMonth(startDate.getMonth() - 1); // Default to month
    }

    const startDateStr = startDate.toISOString().split('T')[0];

    // Query revenue by branch
    const { rows } = await pool.query(`
      WITH branch_revenue AS (
        SELECT branch_id, SUM(total_amount) as amount FROM restaurant_orders WHERE DATE(created_at) >= $1 AND status::text != 'cancelled' GROUP BY branch_id
        UNION ALL
        SELECT branch_id, SUM(total_amount) as amount FROM bookings WHERE DATE(created_at) >= $1 AND status::text != 'cancelled' GROUP BY branch_id
        UNION ALL
        SELECT branch_id, SUM(total) as amount FROM bar_orders WHERE DATE(created_at) >= $1 AND status::text != 'cancelled' GROUP BY branch_id
      )
      SELECT 
        b.id,
        b.name,
        b.code,
        COALESCE(SUM(br.amount), 0) as value
      FROM branches b
      LEFT JOIN branch_revenue br ON b.id = br.branch_id
      GROUP BY b.id, b.name, b.code
      ORDER BY value DESC
    `, [startDateStr]);

    res.status(200).json({
      success: true,
      message: 'Branch comparison data retrieved successfully',
      data: rows.map(row => ({
        id: row.id,
        name: row.name,
        code: row.code,
        revenue: parseFloat(row.value)
      }))
    });
  } catch (error) {
    console.error('Error getting branch comparison:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get branch comparison',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// All branches staff overview
// All branches staff overview
router.get('/staff/all', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    // Query staff counts by branch
    const { rows: branchStaff } = await pool.query(`
      SELECT 
        b.id as branch_id,
        b.name as branch_name,
        COUNT(u.id) as staff_count
      FROM branches b
      LEFT JOIN users u ON b.id = u.branch_id
      GROUP BY b.id, b.name
    `);

    // Query staff counts by role
    const { rows: roleStaff } = await pool.query(`
      SELECT 
        role,
        COUNT(*) as count
      FROM users
      GROUP BY role
    `);

    // Query total staff
    const { rows: totalStaff } = await pool.query('SELECT COUNT(*) as total FROM users');

    res.status(200).json({
      success: true,
      message: 'Staff overview retrieved successfully',
      data: {
        total: parseInt(totalStaff[0].total),
        byBranch: branchStaff.map(row => ({
          branchId: row.branch_id,
          branchName: row.branch_name,
          count: parseInt(row.staff_count)
        })),
        byRole: roleStaff.map(row => ({
          role: row.role,
          count: parseInt(row.count)
        }))
      }
    });
  } catch (error) {
    console.error('Error getting staff overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get staff overview',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Central warehouse inventory
// Get master inventory with optional filters
router.get('/warehouse/inventory', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { category, search, lowStock } = req.query;

    let query = `
      SELECT * FROM simple_items
      WHERE 1=1
    `;

    const queryParams: any[] = [];

    if (category && category !== 'all') {
      query += ` AND category = $${queryParams.length + 1}`;
      queryParams.push(category);
    }

    if (search) {
      query += ` AND (item_name ILIKE $${queryParams.length + 1} OR sku ILIKE $${queryParams.length + 1})`;
      queryParams.push(`%${search}%`);
    }

    if (lowStock === 'true') {
      query += ` AND quantity <= reorder_level`;
    }

    query += ' ORDER BY item_name ASC';

    const { rows } = await pool.query(query, queryParams);

    res.status(200).json({
      success: true,
      message: 'Master inventory retrieved successfully',
      data: rows.map(row => ({
        sku: row.sku,
        name: row.item_name,
        category: row.category,
        unit: row.unit_of_measure,
        central_stock: row.quantity,
        reorder_level: row.reorder_level,
        value: row.quantity * row.cost_price,
        unit_cost: row.cost_price,
        barcode: row.barcode,
        description: row.description,
        branch_allocations: {} // Placeholder for now
      }))
    });
  } catch (error) {
    console.error('Error getting master inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get master inventory',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


// Get inventory item by SKU
router.get('/warehouse/inventory/:sku', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { sku } = req.params;

    const { rows } = await pool.query(`
      SELECT * FROM simple_items
      WHERE sku = $1
    `, [sku]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Item with SKU ${sku} not found`
      });
    }

    const row = rows[0];
    res.status(200).json({
      success: true,
      message: 'Item retrieved successfully',
      data: {
        sku: row.sku,
        name: row.item_name,
        category: row.category,
        unit: row.unit_of_measure,
        central_stock: row.quantity,
        reorder_level: row.reorder_level,
        value: row.quantity * row.cost_price,
        unit_cost: row.cost_price,
        barcode: row.barcode,
        description: row.description,
        branch_allocations: {} // Placeholder
      }
    });
  } catch (error) {
    console.error('Error getting inventory item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get inventory item',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create new inventory item
router.post('/warehouse/inventory', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { sku, name, category, unit, central_stock, reorder_level, cost_price, barcode, description } = req.body;

    // Validate required fields
    if (!sku || !name || !category || !unit) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: sku, name, category, unit'
      });
    }

    // Check if item already exists
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM simple_items WHERE sku = $1',
      [sku]
    );

    if (existingRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Item with SKU ${sku} already exists`
      });
    }

    // Insert new item
    const { rows } = await pool.query(`
      INSERT INTO simple_items (sku, item_name, category, unit_of_measure, quantity, reorder_level, cost_price, barcode, description, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING *
    `, [
      sku, name, category, unit, central_stock || 0, reorder_level || 10, cost_price || 0, barcode || null, description || ''
    ]);

    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: rows[0]
    });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create inventory item',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update inventory item
// Update inventory item
router.put('/warehouse/inventory/:sku', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { sku } = req.params;
    const { name, category, unit, central_stock, reorder_level, cost_price, barcode, description } = req.body;

    // Check if item exists
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM simple_items WHERE sku = $1',
      [sku]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Item with SKU ${sku} not found`
      });
    }

    // Update item
    const { rows } = await pool.query(`
      UPDATE simple_items
      SET 
        item_name = COALESCE($1, item_name),
        category = COALESCE($2, category),
        unit_of_measure = COALESCE($3, unit_of_measure),
        quantity = COALESCE($4, quantity),
        reorder_level = COALESCE($5, reorder_level),
        cost_price = COALESCE($6, cost_price),
        barcode = COALESCE($7, barcode),
        description = COALESCE($8, description),
        last_updated = CURRENT_TIMESTAMP
      WHERE sku = $9
      RETURNING *
    `, [
      name || null,
      category || null,
      unit || null,
      central_stock !== undefined ? central_stock : null,
      reorder_level !== undefined ? reorder_level : null,
      cost_price !== undefined ? cost_price : null,
      barcode || null,
      description || null,
      sku
    ]);

    res.status(200).json({
      success: true,
      message: 'Item updated successfully',
      data: rows[0]
    });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update inventory item',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete inventory item
router.delete('/warehouse/inventory/:sku', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { sku } = req.params;

    // Check if item exists
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM central_warehouse_inventory WHERE sku = $1',
      [sku]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Item with SKU ${sku} not found`
      });
    }

    // Delete item
    await pool.query('DELETE FROM central_warehouse_inventory WHERE sku = $1', [sku]);

    res.status(200).json({
      success: true,
      message: 'Item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete inventory item',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Warehouse Requests Endpoints

// Get all requests with optional filters
// Get warehouse requests with optional filters
router.get('/warehouse/requests', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { status, branch_id } = req.query;

    // Build the query with filters
    let query = `
      SELECT r.*, b.name as branch_name,
      (
        SELECT json_agg(json_build_object(
          'id', ri.id,
          'item_sku', ri.item_sku,
          'item_name', si.item_name,
          'requested_quantity', ri.requested_quantity,
          'approved_quantity', ri.approved_quantity,
          'unit', si.unit
        ))
        FROM stock_request_items ri
        LEFT JOIN simple_items si ON ri.item_sku = si.sku
        WHERE ri.request_id = r.id
      ) as items
      FROM stock_requests r
      LEFT JOIN branches b ON r.requesting_branch_id = b.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];

    if (status) {
      query += ` AND r.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    if (branch_id) {
      query += ` AND r.requesting_branch_id = $${queryParams.length + 1}`;
      queryParams.push(branch_id);
    }

    query += ' ORDER BY r.created_at DESC';

    const { rows } = await pool.query(query, queryParams);

    res.status(200).json({
      success: true,
      message: 'Requests retrieved successfully',
      data: rows.map(row => ({
        id: row.id,
        request_number: row.request_number,
        requesting_branch_id: row.requesting_branch_id,
        branch_name: row.branch_name,
        request_type: row.request_type,
        status: row.status,
        priority: row.priority,
        reason: row.reason,
        needed_by_date: row.needed_by_date,
        requested_by: row.requested_by,
        items: row.items || [],
        created_at: row.created_at,
        updated_at: row.updated_at
      }))
    });
  } catch (error) {
    console.error('Error getting warehouse requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get warehouse requests',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get pending requests
router.get('/warehouse/requests/pending', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.*, b.name as branch_name
      FROM stock_requests r
      LEFT JOIN branches b ON r.requesting_branch_id = b.id
      WHERE r.status = 'PENDING'
      ORDER BY 
        CASE 
          WHEN r.priority = 'URGENT' THEN 1
          WHEN r.priority = 'HIGH' THEN 2
          WHEN r.priority = 'NORMAL' THEN 3
          ELSE 4
        END,
        r.created_at ASC
    `);

    res.status(200).json({
      success: true,
      message: 'Pending requests retrieved successfully',
      data: rows.map(row => ({
        id: row.id,
        request_number: row.request_number,
        requesting_branch_id: row.requesting_branch_id,
        branch_name: row.branch_name,
        request_type: row.request_type,
        status: row.status,
        priority: row.priority,
        reason: row.reason,
        needed_by_date: row.needed_by_date,
        requested_by: row.requested_by,
        created_at: row.created_at,
        updated_at: row.updated_at
      }))
    });
  } catch (error) {
    console.error('Error getting pending requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending requests',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get request by ID
router.get('/warehouse/requests/:id', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(`
      SELECT r.*, b.name as branch_name,
      (
        SELECT json_agg(json_build_object(
          'id', ri.id,
          'item_sku', ri.item_sku,
          'item_name', si.item_name,
          'requested_quantity', ri.requested_quantity,
          'approved_quantity', ri.approved_quantity,
          'unit', si.unit
        ))
        FROM stock_request_items ri
        LEFT JOIN simple_items si ON ri.item_sku = si.sku
        WHERE ri.request_id = r.id
      ) as items
      FROM stock_requests r
      LEFT JOIN branches b ON r.requesting_branch_id = b.id
      WHERE r.id = $1
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Request with ID ${id} not found`
      });
    }

    const row = rows[0];
    res.status(200).json({
      success: true,
      message: 'Request retrieved successfully',
      data: {
        id: row.id,
        request_number: row.request_number,
        requesting_branch_id: row.requesting_branch_id,
        branch_name: row.branch_name,
        request_type: row.request_type,
        status: row.status,
        priority: row.priority,
        reason: row.reason,
        needed_by_date: row.needed_by_date,
        requested_by: row.requested_by,
        items: row.items || [],
        created_at: row.created_at,
        updated_at: row.updated_at
      }
    });
  } catch (error) {
    console.error('Error getting request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create new request
router.post('/warehouse/requests', protect, async (req, res) => {
  const client = await pool.connect();
  try {
    const { branch_id, items, priority = 'NORMAL', notes = '', request_type = 'ROUTINE' } = req.body;

    // Validate required fields
    if (!branch_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: branch_id, items (array)'
      });
    }

    await client.query('BEGIN');

    // Get branch code
    const { rows: branchRows } = await client.query(
      'SELECT code FROM branches WHERE id = $1',
      [branch_id]
    );

    if (branchRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Branch with ID ${branch_id} not found`
      });
    }

    const branchCode = branchRows[0].code;

    // Generate request number
    const { rows: numRows } = await client.query(
      'SELECT get_next_stock_request_number($1) as request_number',
      [branchCode]
    );
    const requestNumber = numRows[0].request_number;

    // Insert new request
    const { rows: requestRows } = await client.query(`
      INSERT INTO stock_requests (
        request_number, requesting_branch_id, requested_by, 
        request_type, priority, reason, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      requestNumber,
      branch_id,
      req.user?.id || null,
      request_type,
      priority,
      notes,
      'PENDING'
    ]);

    const newRequest = requestRows[0];

    // Insert request items
    for (const item of items) {
      // Get current branch stock
      const { rows: stockRows } = await client.query(
        'SELECT quantity FROM branch_stock WHERE branch_id = $1 AND item_sku = $2',
        [branch_id, item.sku]
      );
      const currentStock = stockRows.length > 0 ? stockRows[0].quantity : 0;

      await client.query(`
        INSERT INTO stock_request_items (
          request_id, item_sku, requested_quantity, current_branch_stock, status
        )
        VALUES ($1, $2, $3, $4, $5)
      `, [
        newRequest.id,
        item.sku,
        item.quantity,
        currentStock,
        'PENDING'
      ]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Request created successfully',
      data: {
        ...newRequest,
        items
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Review request (approve/reject)
// Review warehouse request
router.put('/warehouse/requests/:id/review', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const officialStatus = status.toUpperCase();
    if (!['APPROVED', 'REJECTED', 'UNDER_REVIEW'].includes(officialStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'APPROVED', 'REJECTED', or 'UNDER_REVIEW'"
      });
    }

    // Check if request exists
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM stock_requests WHERE id = $1',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Request with ID ${id} not found`
      });
    }

    // Update request
    const { rows } = await pool.query(`
      UPDATE stock_requests
      SET 
        status = $1, 
        review_notes = COALESCE($2, review_notes), 
        reviewed_by = $3,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [officialStatus, notes || null, req.user?.id || null, id]);

    res.status(200).json({
      success: true,
      message: `Request ${officialStatus} successfully`,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error reviewing request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Warehouse Dispatch Endpoints

// Get all dispatches with optional filters
// Get all dispatches with optional filters
router.get('/warehouse/dispatches', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { status, branch_id } = req.query;

    // Build the query with filters
    let query = `
      SELECT d.*, b.name as branch_name, r.request_number,
      (
        SELECT json_agg(json_build_object(
          'id', di.id,
          'item_sku', di.item_sku,
          'item_name', si.item_name,
          'quantity', di.dispatched_quantity,
          'unit', si.unit
        ))
        FROM dispatch_items di
        LEFT JOIN simple_items si ON di.item_sku = si.sku
        WHERE di.dispatch_id = d.id
      ) as items
      FROM dispatch_notes d
      LEFT JOIN branches b ON d.to_branch_id = b.id
      LEFT JOIN stock_requests r ON d.stock_request_id = r.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];

    if (status) {
      query += ` AND d.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    if (branch_id) {
      query += ` AND d.to_branch_id = $${queryParams.length + 1}`;
      queryParams.push(branch_id);
    }

    query += ' ORDER BY d.created_at DESC';

    const { rows } = await pool.query(query, queryParams);

    res.status(200).json({
      success: true,
      message: 'Dispatches retrieved successfully',
      data: rows.map(row => ({
        id: row.id,
        dispatch_number: row.dispatch_number,
        request_id: row.stock_request_id,
        request_number: row.request_number,
        requesting_branch_id: row.to_branch_id,
        branch_name: row.branch_name,
        status: row.status,
        dispatched_by: row.dispatcher_id,
        received_by: row.receiver_id,
        items: row.items || [],
        notes: row.dispatch_notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
        dispatched_at: row.dispatched_at,
        received_at: row.delivered_at
      }))
    });
  } catch (error) {
    console.error('Error getting dispatches:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dispatches',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create dispatch from request
router.post('/warehouse/dispatches', protect, validateCentralOperationsRole, async (req, res) => {
  const client = await pool.connect();
  try {
    const { stock_request_id, items, dispatch_notes, to_branch_id, from_branch_id = 1 } = req.body;

    await client.query('BEGIN');

    // Get destination branch code
    const { rows: branchRows } = await client.query(
      'SELECT code FROM branches WHERE id = $1',
      [to_branch_id]
    );

    if (branchRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Destination branch with ID ${to_branch_id} not found`
      });
    }

    const branchCode = branchRows[0].code;

    // Generate dispatch number
    const { rows: numRows } = await client.query(
      'SELECT get_next_dispatch_number($1) as dispatch_number',
      [branchCode]
    );
    const dispatchNumber = numRows[0].dispatch_number;

    // Create dispatch note
    const { rows: dispatchRows } = await client.query(`
      INSERT INTO dispatch_notes (
        dispatch_number, stock_request_id, from_branch_id, to_branch_id,
        created_by, dispatch_notes, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      dispatchNumber,
      stock_request_id || null,
      from_branch_id,
      to_branch_id,
      req.user?.id || null,
      dispatch_notes || '',
      'DRAFT'
    ]);

    const newDispatch = dispatchRows[0];

    // Insert dispatch items
    for (const item of items) {
      await client.query(`
        INSERT INTO dispatch_items (
          dispatch_id, item_sku, dispatched_quantity, status
        )
        VALUES ($1, $2, $3, $4)
      `, [
        newDispatch.id,
        item.item_sku || item.sku,
        item.dispatched_quantity || item.quantity,
        'PENDING'
      ]);
    }

    // If linked to a request, update request status
    if (stock_request_id) {
      await client.query(
        "UPDATE stock_requests SET status = 'UNDER_REVIEW' WHERE id = $1 AND status = 'PENDING'",
        [stock_request_id]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Dispatch created successfully',
      data: newDispatch
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating dispatch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create dispatch',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Send dispatch (change status to in_transit and deduct from inventory)
router.put('/warehouse/dispatches/:id/dispatch', protect, validateCentralOperationsRole, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Check if dispatch exists and is in DRAFT status
    const { rows: dispatchRows } = await client.query(`
      SELECT d.*, 
      (
        SELECT json_agg(json_build_object(
          'item_sku', di.item_sku,
          'quantity', di.dispatched_quantity
        ))
        FROM dispatch_items di
        WHERE di.dispatch_id = d.id
      ) as items
      FROM dispatch_notes d
      WHERE d.id = $1
    `, [id]);

    if (dispatchRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Dispatch with ID ${id} not found`
      });
    }

    const dispatch = dispatchRows[0];

    if (dispatch.status !== 'DRAFT') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Dispatch must be in DRAFT status to be sent. Current status: ${dispatch.status}`
      });
    }

    const items = dispatch.items || [];

    // Check if all items have sufficient stock in master inventory (simple_items)
    for (const item of items) {
      const { rows: stockRows } = await client.query(
        'SELECT quantity, item_name FROM simple_items WHERE sku = $1',
        [item.item_sku]
      );

      if (stockRows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: `Item with SKU ${item.item_sku} not found in master inventory`
        });
      }

      if (stockRows[0].quantity < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${stockRows[0].item_name} (SKU: ${item.item_sku}). Available: ${stockRows[0].quantity}, Required: ${item.quantity}`
        });
      }
    }

    // Update inventory - deduct stock from master inventory
    for (const item of items) {
      await client.query(
        'UPDATE simple_items SET quantity = quantity - $1 WHERE sku = $2',
        [item.quantity, item.item_sku]
      );
    }

    // Update dispatch status
    const { rows } = await client.query(`
      UPDATE dispatch_notes
      SET 
        status = 'IN_TRANSIT', 
        dispatcher_id = $1, 
        dispatched_at = CURRENT_TIMESTAMP, 
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [req.user?.id || null, id]);

    // If linked to a request, update request status
    if (dispatch.stock_request_id) {
      await client.query(
        "UPDATE stock_requests SET status = 'DISPATCHED' WHERE id = $1",
        [dispatch.stock_request_id]
      );
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Dispatch sent successfully',
      data: rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error dispatching items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to dispatch items',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Receive dispatch at branch
// Receive dispatch (change status to delivered and add to branch inventory)
router.put('/warehouse/dispatches/:id/receive', protect, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { notes, items_received } = req.body;

    await client.query('BEGIN');

    // Check if dispatch exists and is in IN_TRANSIT status
    const { rows: dispatchRows } = await client.query(`
      SELECT d.*, 
      (
        SELECT json_agg(json_build_object(
          'id', di.id,
          'item_sku', di.item_sku,
          'quantity', di.dispatched_quantity
        ))
        FROM dispatch_items di
        WHERE di.dispatch_id = d.id
      ) as items
      FROM dispatch_notes d
      WHERE d.id = $1
    `, [id]);

    if (dispatchRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Dispatch with ID ${id} not found`
      });
    }

    const dispatch = dispatchRows[0];

    if (dispatch.status !== 'IN_TRANSIT') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Dispatch must be in IN_TRANSIT status to be received. Current status: ${dispatch.status}`
      });
    }

    // Update dispatch status
    const { rows } = await client.query(`
      UPDATE dispatch_notes
      SET 
        status = 'DELIVERED', 
        receiver_id = $1, 
        delivered_at = CURRENT_TIMESTAMP, 
        dispatch_notes = COALESCE($2, dispatch_notes), 
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [req.user?.id || null, notes || null, id]);

    // Update branch stock for each item
    const items = dispatch.items || [];
    for (const item of items) {
      // Find received quantity from request body if provided, else use dispatched quantity
      const receivedItem = items_received?.find((ri: any) => ri.item_sku === item.item_sku);
      const receivedQuantity = receivedItem ? receivedItem.received_quantity : item.quantity;

      // Update branch stock (using the update_branch_stock function if it exists, or manual update)
      await client.query(`
        INSERT INTO branch_stock (branch_id, item_sku, quantity, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (branch_id, item_sku)
        DO UPDATE SET quantity = branch_stock.quantity + $3, updated_at = CURRENT_TIMESTAMP
      `, [dispatch.to_branch_id, item.item_sku, receivedQuantity]);

      // Update dispatch_items with received quantity
      await client.query(`
        UPDATE dispatch_items
        SET received_quantity = $1, status = 'RECEIVED'
        WHERE dispatch_id = $2 AND item_sku = $3
      `, [receivedQuantity, id, item.item_sku]);
    }

    // If linked to a request, update request status
    if (dispatch.stock_request_id) {
      await client.query(
        "UPDATE stock_requests SET status = 'DELIVERED' WHERE id = $1",
        [dispatch.stock_request_id]
      );
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Dispatch received successfully',
      data: rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error receiving dispatch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to receive dispatch',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// ==========================================
// BRANCH TRANSFER ENDPOINTS
// ==========================================

// Get all transfers with optional filters
router.get('/warehouse/transfers', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { status, from_branch_id, to_branch_id } = req.query;

    // Build the query with filters
    let query = `
      SELECT t.*, 
             fb.name as from_branch_name, 
             tb.name as to_branch_name
      FROM branch_transfers t
      LEFT JOIN branches fb ON t.from_branch_id = fb.id
      LEFT JOIN branches tb ON t.to_branch_id = tb.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];

    if (status) {
      query += ` AND t.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    if (from_branch_id) {
      query += ` AND t.from_branch_id = $${queryParams.length + 1}`;
      queryParams.push(from_branch_id);
    }

    if (to_branch_id) {
      query += ` AND t.to_branch_id = $${queryParams.length + 1}`;
      queryParams.push(to_branch_id);
    }

    query += ' ORDER BY t.created_at DESC';

    const { rows } = await pool.query(query, queryParams);

    // Calculate stats
    const allTransfers = await pool.query('SELECT status FROM branch_transfers');
    const stats = {
      total: allTransfers.rows.length,
      pending: allTransfers.rows.filter((r: any) => r.status === 'pending').length,
      approved: allTransfers.rows.filter((r: any) => r.status === 'approved').length,
      in_transit: allTransfers.rows.filter((r: any) => r.status === 'in_transit').length,
      completed: allTransfers.rows.filter((r: any) => r.status === 'completed').length,
      rejected: allTransfers.rows.filter((r: any) => r.status === 'rejected').length
    };

    res.status(200).json({
      success: true,
      message: 'Transfers retrieved successfully',
      data: rows,
      stats
    });
  } catch (error) {
    console.error('Error getting transfers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transfers',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create a new transfer request
router.post('/warehouse/transfers', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { from_branch_id, to_branch_id, items, notes } = req.body;

    // Validate required fields
    if (!from_branch_id || !to_branch_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: from_branch_id, to_branch_id, items (array)'
      });
    }

    if (from_branch_id === to_branch_id) {
      return res.status(400).json({
        success: false,
        message: 'Source and destination branches must be different'
      });
    }

    // Generate a unique ID
    const date = new Date();
    const year = date.getFullYear();
    const { rows: countRows } = await pool.query(
      "SELECT COUNT(*) FROM branch_transfers WHERE id LIKE $1",
      [`TRF-${year}-%`]
    );
    const count = parseInt(countRows[0].count) + 1;
    const id = `TRF-${year}-${count.toString().padStart(3, '0')}`;

    // Create the transfer
    const { rows } = await pool.query(`
      INSERT INTO branch_transfers (id, from_branch_id, to_branch_id, status, requested_by, items, notes)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      RETURNING *
    `, [
      id,
      from_branch_id,
      to_branch_id,
      'pending',
      req.user?.email || 'Unknown',
      JSON.stringify(items),
      notes || ''
    ]);

    res.status(201).json({
      success: true,
      message: 'Transfer request created successfully',
      data: rows[0]
    });
  } catch (error) {
    console.error('Error creating transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create transfer',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Approve or reject a transfer
router.put('/warehouse/transfers/:id/review', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "approved" or "rejected"'
      });
    }

    // Check if transfer exists
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM branch_transfers WHERE id = $1',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Transfer with ID ${id} not found`
      });
    }

    if (existingRows[0].status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Transfer has already been ${existingRows[0].status}`
      });
    }

    // Update transfer
    const { rows } = await pool.query(`
      UPDATE branch_transfers
      SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP, 
          notes = COALESCE($3::text, notes), updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [status, req.user?.email || 'Unknown', notes || null, id]);

    res.status(200).json({
      success: true,
      message: `Transfer ${status} successfully`,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error reviewing transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review transfer',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Ship a transfer (mark as in_transit)
router.put('/warehouse/transfers/:id/ship', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if transfer exists
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM branch_transfers WHERE id = $1',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Transfer with ID ${id} not found`
      });
    }

    if (existingRows[0].status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: `Transfer must be approved before shipping. Current status: ${existingRows[0].status}`
      });
    }

    // Update transfer status and deduct from source branch inventory
    const transfer = existingRows[0];
    const items = typeof transfer.items === 'string' ? JSON.parse(transfer.items) : transfer.items;

    // TODO: Deduct items from source branch inventory
    // For now, just update the status

    const { rows } = await pool.query(`
      UPDATE branch_transfers
      SET status = 'in_transit', shipped_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    res.status(200).json({
      success: true,
      message: 'Transfer shipped successfully',
      data: rows[0]
    });
  } catch (error) {
    console.error('Error shipping transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to ship transfer',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Complete a transfer (mark as received)
router.put('/warehouse/transfers/:id/receive', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    // Check if transfer exists
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM branch_transfers WHERE id = $1',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Transfer with ID ${id} not found`
      });
    }

    if (existingRows[0].status !== 'in_transit') {
      return res.status(400).json({
        success: false,
        message: `Transfer must be in transit to be received. Current status: ${existingRows[0].status}`
      });
    }

    // Update transfer status and add to destination branch inventory
    const transfer = existingRows[0];
    const items = typeof transfer.items === 'string' ? JSON.parse(transfer.items) : transfer.items;

    // TODO: Add items to destination branch inventory
    // For now, just update the status

    const { rows } = await pool.query(`
      UPDATE branch_transfers
      SET status = 'completed', completed_by = $1, received_at = CURRENT_TIMESTAMP, 
          notes = COALESCE($2::text, notes), updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [req.user?.email || 'Unknown', notes || null, id]);

    res.status(200).json({
      success: true,
      message: 'Transfer received and completed successfully',
      data: rows[0]
    });
  } catch (error) {
    console.error('Error receiving transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to receive transfer',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get a single transfer by ID
router.get('/warehouse/transfers/:id', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(`
      SELECT t.*, 
             fb.name as from_branch_name, 
             tb.name as to_branch_name
      FROM branch_transfers t
      LEFT JOIN branches fb ON t.from_branch_id = fb.id
      LEFT JOIN branches tb ON t.to_branch_id = tb.id
      WHERE t.id = $1
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Transfer with ID ${id} not found`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Transfer retrieved successfully',
      data: rows[0]
    });
  } catch (error) {
    console.error('Error getting transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transfer',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ==========================================
// SUPPLIER MANAGEMENT ENDPOINTS
// ==========================================

// Get all suppliers
// Get all suppliers with optional filters
router.get('/warehouse/suppliers', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { status } = req.query;

    // Build the query with filters
    let query = 'SELECT * FROM suppliers WHERE 1=1';
    const queryParams: any[] = [];

    if (status) {
      query += ` AND status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    query += ' ORDER BY name ASC';

    const { rows } = await pool.query(query, queryParams);

    res.status(200).json({
      success: true,
      message: 'Suppliers retrieved successfully',
      data: rows
    });
  } catch (error) {
    console.error('Error getting suppliers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get suppliers',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create a new supplier
router.post('/warehouse/suppliers', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { name, contact_person, email, phone, address, category, status, rating, notes } = req.body;

    // Validate required fields
    if (!name || !contact_person || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, contact_person, email, phone'
      });
    }

    // Generate a unique ID
    const date = new Date();
    const year = date.getFullYear();
    const { rows: countRows } = await pool.query(
      "SELECT COUNT(*) FROM suppliers WHERE id LIKE $1",
      [`SUP-${year}-%`]
    );
    const count = parseInt(countRows[0].count) + 1;
    const id = `SUP-${year}-${count.toString().padStart(3, '0')}`;

    // Create the supplier
    const { rows } = await pool.query(`
      INSERT INTO suppliers (id, name, contact_person, email, phone, address, category, status, rating, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      id,
      name,
      contact_person,
      email,
      phone,
      address || '',
      category || '',
      status || 'active',
      rating || 5,
      notes || ''
    ]);

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: rows[0]
    });
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create supplier',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update a supplier
router.put('/warehouse/suppliers/:id', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_person, email, phone, address, category, status, rating, notes } = req.body;

    // Check if supplier exists
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM suppliers WHERE id = $1',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Supplier with ID ${id} not found`
      });
    }

    // Update supplier
    const { rows } = await pool.query(`
      UPDATE suppliers
      SET name = COALESCE($1, name),
          contact_person = COALESCE($2, contact_person),
          email = COALESCE($3, email),
          phone = COALESCE($4, phone),
          address = COALESCE($5, address),
          category = COALESCE($6, category),
          status = COALESCE($7, status),
          rating = COALESCE($8, rating),
          notes = COALESCE($9, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [name, contact_person, email, phone, address, category, status, rating, notes, id]);

    res.status(200).json({
      success: true,
      message: 'Supplier updated successfully',
      data: rows[0]
    });
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update supplier',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete a supplier
router.delete('/warehouse/suppliers/:id', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if supplier exists
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM suppliers WHERE id = $1',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Supplier with ID ${id} not found`
      });
    }

    // Delete supplier
    await pool.query('DELETE FROM suppliers WHERE id = $1', [id]);

    res.status(200).json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete supplier',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get a single supplier by ID
router.get('/warehouse/suppliers/:id', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      'SELECT * FROM suppliers WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Supplier with ID ${id} not found`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Supplier retrieved successfully',
      data: rows[0]
    });
  } catch (error) {
    console.error('Error getting supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get supplier',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ==========================================
// BRANCH OVERSIGHT ENDPOINTS
// ==========================================

// Branch Performance Overview - Real Database Data
router.get('/branch-oversight/performance', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { period = 'week' } = req.query;

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    let prevStartDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        prevStartDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        prevStartDate = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
        break;
      default: // week
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        prevStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get branches
    const { rows: branches } = await pool.query('SELECT * FROM branches ORDER BY name');

    // Get real performance data from orders table
    const branchPerformance = await Promise.all(branches.map(async (branch: any) => {
      // Get current period orders
      let currentOrders: any = { count: 0, revenue: 0 };
      let prevOrders: any = { count: 0, revenue: 0 };

      try {
        const currentResult = await pool.query(`
          SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue
          FROM orders 
          WHERE branch_id = $1 AND created_at >= $2
        `, [branch.id, startDate.toISOString()]);
        currentOrders = currentResult.rows[0] || { count: 0, revenue: 0 };

        const prevResult = await pool.query(`
          SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue
          FROM orders 
          WHERE branch_id = $1 AND created_at >= $2 AND created_at < $3
        `, [branch.id, prevStartDate.toISOString(), startDate.toISOString()]);
        prevOrders = prevResult.rows[0] || { count: 0, revenue: 0 };
      } catch (e) {
        // Orders table might not exist
      }

      const revenue = parseFloat(currentOrders.revenue) || 0;
      const orders = parseInt(currentOrders.count) || 0;
      const prevRevenue = parseFloat(prevOrders.revenue) || 1;
      const prevOrderCount = parseInt(prevOrders.count) || 1;

      const revenueChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue * 100) : 0;
      const ordersChange = prevOrderCount > 0 ? ((orders - prevOrderCount) / prevOrderCount * 100) : 0;

      // Get staff count for efficiency calculation
      let staffCount = 0;
      try {
        const staffResult = await pool.query(
          'SELECT COUNT(*) as count FROM staff_profiles WHERE branch_id = $1',
          [branch.id]
        );
        staffCount = parseInt(staffResult.rows[0]?.count) || 1;
      } catch (e) { }

      // Get top products from order_items
      let topProducts: any[] = [];
      try {
        const productsResult = await pool.query(`
          SELECT mi.name, COUNT(*) as sales
          FROM order_items oi
          JOIN menu_items mi ON oi.menu_item_id = mi.id
          JOIN orders o ON oi.order_id = o.id
          WHERE o.branch_id = $1 AND o.created_at >= $2
          GROUP BY mi.name
          ORDER BY sales DESC
          LIMIT 3
        `, [branch.id, startDate.toISOString()]);
        topProducts = productsResult.rows.map(r => ({ name: r.name, sales: parseInt(r.sales) }));
      } catch (e) { }

      // If no real data, provide zeros
      if (topProducts.length === 0) {
        topProducts = [
          { name: 'No data available', sales: 0 }
        ];
      }

      return {
        branch_id: branch.id,
        branch_name: branch.name,
        revenue: revenue,
        revenue_change: revenueChange.toFixed(1),
        orders: orders,
        orders_change: ordersChange.toFixed(1),
        avg_order_value: orders > 0 ? Math.round(revenue / orders) : 0,
        customer_satisfaction: 0, // Would come from reviews table
        staff_efficiency: orders > 0 ? Math.round((orders / staffCount) * 10) : 0,
        inventory_turnover: 0, // Would come from inventory tracking
        target_achievement: 0, // Would come from targets table
        top_products: topProducts,
        hourly_sales: [] // Would require more complex query
      };
    }));

    const totalRevenue = branchPerformance.reduce((sum: number, b: any) => sum + b.revenue, 0);
    const totalOrders = branchPerformance.reduce((sum: number, b: any) => sum + b.orders, 0);
    const avgSatisfaction = 0; // Would come from reviews

    const sortedByRevenue = [...branchPerformance].sort((a: any, b: any) => b.revenue - a.revenue);

    res.status(200).json({
      success: true,
      message: 'Performance data retrieved successfully',
      data: {
        total_revenue: totalRevenue,
        total_orders: totalOrders,
        avg_satisfaction: avgSatisfaction,
        best_performer: sortedByRevenue[0]?.branch_name || 'N/A',
        worst_performer: sortedByRevenue[sortedByRevenue.length - 1]?.branch_name || 'N/A',
        branches: branchPerformance
      }
    });
  } catch (error) {
    console.error('Error getting performance data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get performance data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Staff Overview - Real Database Data
router.get('/branch-oversight/staff', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    // Get branches
    const { rows: branches } = await pool.query('SELECT * FROM branches ORDER BY name');

    // Get staff from staff_profiles joined with users table
    let staffData: any[] = [];
    try {
      const { rows } = await pool.query(`
        SELECT 
          sp.id,
          CONCAT(u.first_name, ' ', u.last_name) as name,
          u.email,
          u.phone_number as phone,
          sp.role,
          sp.department,
          u.branch_id,
          b.name as branch_name,
          sp.status,
          sp.start_date as hire_date,
          COALESCE(perf.rating, 0) as performance_score,
          COALESCE(perf.attendance, 0) as attendance_rate,
          0 as shifts_completed,
          0 as shifts_missed,
          0 as overtime_hours,
          COALESCE(perf.customer_service, 0) as customer_rating
        FROM staff_profiles sp 
        JOIN users u ON sp.user_id = u.id
        LEFT JOIN branches b ON u.branch_id = b.id 
        LEFT JOIN staff_performance perf ON sp.id = perf.staff_id
        ORDER BY u.first_name, u.last_name
      `);
      staffData = rows.map(s => ({
        ...s,
        status: s.status || 'active'
      }));
    } catch (e) {
      console.error('Error fetching staff:', e);
    }

    // Calculate statistics from real data
    const activeStaff = staffData.filter((s: any) => s.status === 'active').length;
    const onLeave = staffData.filter((s: any) => s.status === 'on_leave').length;
    const avgPerformance = staffData.length > 0
      ? staffData.reduce((sum: number, s: any) => sum + (parseFloat(s.performance_score) || 0), 0) / staffData.length
      : 0;
    const avgAttendance = staffData.length > 0
      ? staffData.reduce((sum: number, s: any) => sum + (parseFloat(s.attendance_rate) || 0), 0) / staffData.length
      : 0;

    const topPerformers = [...staffData]
      .sort((a: any, b: any) => (parseFloat(b.performance_score) || 0) - (parseFloat(a.performance_score) || 0))
      .slice(0, 3);
    const needsAttention = [...staffData]
      .filter((s: any) => (parseFloat(s.performance_score) || 0) < 70 || (parseFloat(s.attendance_rate) || 0) < 80);

    const branchSummaries = branches.map((branch: any) => {
      const branchStaff = staffData.filter((s: any) => s.branch_id === branch.id);
      return {
        branch_id: branch.id,
        branch_name: branch.name,
        total_staff: branchStaff.length,
        active: branchStaff.filter((s: any) => s.status === 'active').length,
        on_leave: branchStaff.filter((s: any) => s.status === 'on_leave').length,
        avg_performance: branchStaff.length > 0
          ? Math.floor(branchStaff.reduce((sum: number, s: any) => sum + (parseFloat(s.performance_score) || 0), 0) / branchStaff.length)
          : 0,
        avg_attendance: branchStaff.length > 0
          ? Math.floor(branchStaff.reduce((sum: number, s: any) => sum + (parseFloat(s.attendance_rate) || 0), 0) / branchStaff.length)
          : 0
      };
    });

    res.status(200).json({
      success: true,
      message: 'Staff overview retrieved successfully',
      data: {
        total_staff: staffData.length,
        active_staff: activeStaff,
        on_leave: onLeave,
        avg_performance: Math.floor(avgPerformance),
        avg_attendance: Math.floor(avgAttendance),
        top_performers: topPerformers,
        needs_attention: needsAttention,
        branch_summaries: branchSummaries,
        all_staff: staffData
      }
    });
  } catch (error) {
    console.error('Error getting staff overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get staff overview',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Compliance Overview - Real Database Data
router.get('/branch-oversight/compliance', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    // Get branches
    const { rows: branches } = await pool.query('SELECT * FROM branches ORDER BY name');

    // Get compliance requirements from database
    let requirements: any[] = [];
    try {
      const { rows } = await pool.query('SELECT * FROM compliance_requirements WHERE is_active = true ORDER BY category, requirement');
      requirements = rows;
    } catch (e) {
      console.error('Error fetching compliance requirements:', e);
    }

    // Get unique categories
    const categories = [...new Set(requirements.map(r => r.category))];

    // Get compliance status for each branch
    let items: any[] = [];
    try {
      const { rows } = await pool.query(`
        SELECT 
          bc.id,
          cr.category,
          cr.requirement,
          cr.priority,
          bc.branch_id,
          b.name as branch_name,
          bc.status,
          bc.due_date,
          bc.last_checked,
          bc.checked_by,
          bc.notes,
          bc.documents
        FROM branch_compliance bc
        JOIN compliance_requirements cr ON bc.requirement_id = cr.id
        JOIN branches b ON bc.branch_id = b.id
        ORDER BY b.name, cr.category
      `);
      items = rows;
    } catch (e) {
      console.error('Error fetching branch compliance:', e);
    }

    // Note: Compliance records should be created manually through the admin interface
    // Auto-creation has been disabled to prevent excessive mock data

    const compliant = items.filter(i => i.status === 'compliant').length;
    const nonCompliant = items.filter(i => i.status === 'non_compliant').length;
    const pending = items.filter(i => i.status === 'pending').length;
    const expired = items.filter(i => i.status === 'expired').length;

    const branchSummaries = branches.map((branch: any) => {
      const branchItems = items.filter(i => i.branch_id === branch.id);
      const branchCompliant = branchItems.filter(i => i.status === 'compliant').length;
      const totalItems = branchItems.length || 1;
      return {
        branch_id: branch.id,
        branch_name: branch.name,
        total_requirements: branchItems.length,
        compliant: branchCompliant,
        non_compliant: branchItems.filter(i => i.status === 'non_compliant').length,
        pending: branchItems.filter(i => i.status === 'pending').length,
        expired: branchItems.filter(i => i.status === 'expired').length,
        compliance_rate: Math.floor((branchCompliant / totalItems) * 100)
      };
    });

    const upcomingDeadlines = items
      .filter(i => i.status === 'pending' && i.due_date)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .slice(0, 5);
    const criticalIssues = items.filter(i => i.status === 'non_compliant' || i.status === 'expired').slice(0, 5);

    const totalItems = items.length || 1;

    res.status(200).json({
      success: true,
      message: 'Compliance data retrieved successfully',
      data: {
        total_requirements: items.length,
        compliant: compliant,
        non_compliant: nonCompliant,
        pending: pending,
        expired: expired,
        overall_compliance_rate: Math.floor((compliant / totalItems) * 100),
        categories: categories.length > 0 ? categories : ['Health & Safety', 'Food Safety', 'Fire Safety', 'Labor Laws', 'Licensing', 'Environmental'],
        branch_summaries: branchSummaries,
        items: items,
        upcoming_deadlines: upcomingDeadlines,
        critical_issues: criticalIssues
      }
    });
  } catch (error) {
    console.error('Error getting compliance data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get compliance data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Report Generation Endpoint - generates CSV reports directly
router.post('/reports/:type', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'csv', period = 'month' } = req.query;
    const reportData = req.body;

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${type}-report-${timestamp}`;

    let csvContent = '';

    if (type === 'performance') {
      // Performance report
      csvContent = 'Branch,Revenue,Orders,Avg Order Value,Revenue Change %,Orders Change %\n';
      const branches = reportData.branches || [];
      branches.forEach((b: any) => {
        csvContent += `"${b.branch_name}",${b.revenue || 0},${b.orders || 0},${b.avg_order_value || 0},${b.revenue_change || 0},${b.orders_change || 0}\n`;
      });
      csvContent += `\nTotal Revenue,${reportData.total_revenue || 0}\n`;
      csvContent += `Total Orders,${reportData.total_orders || 0}\n`;
      csvContent += `Best Performer,${reportData.best_performer || 'N/A'}\n`;
    } else if (type === 'staff') {
      // Staff report
      csvContent = 'Branch,Total Staff,Active,On Leave,Avg Performance,Avg Attendance\n';
      const summaries = reportData.branch_summaries || [];
      summaries.forEach((s: any) => {
        csvContent += `"${s.branch_name}",${s.total_staff || 0},${s.active || 0},${s.on_leave || 0},${s.avg_performance || 0},${s.avg_attendance || 0}\n`;
      });
      csvContent += `\nTotal Staff,${reportData.total_staff || 0}\n`;
      csvContent += `Active Staff,${reportData.active_staff || 0}\n`;
      csvContent += `On Leave,${reportData.on_leave || 0}\n`;
    } else if (type === 'compliance') {
      // Compliance report
      csvContent = 'Branch,Total Requirements,Compliant,Non-Compliant,Pending,Expired,Compliance Rate %\n';
      const summaries = reportData.branch_summaries || [];
      summaries.forEach((s: any) => {
        csvContent += `"${s.branch_name}",${s.total_requirements || 0},${s.compliant || 0},${s.non_compliant || 0},${s.pending || 0},${s.expired || 0},${s.compliance_rate || 0}\n`;
      });
      csvContent += `\nOverall Compliance Rate,${reportData.overall_compliance_rate || 0}%\n`;
      csvContent += `Total Requirements,${reportData.total_requirements || 0}\n`;
      csvContent += `Compliant,${reportData.compliant || 0}\n`;
      csvContent += `Non-Compliant,${reportData.non_compliant || 0}\n`;
    } else {
      throw new Error(`Unknown report type: ${type}`);
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET endpoint for report status/info
router.get('/reports/:type', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'pdf', period = 'month' } = req.query;

    res.status(200).json({
      success: true,
      message: `Report generation endpoint ready for ${type}`,
      data: {
        report_type: type,
        available_formats: ['pdf', 'excel'],
        endpoint: `/api/central-operations/reports/${type}`,
        method: 'POST',
        required_data: type === 'performance'
          ? ['total_revenue', 'total_orders', 'branches']
          : type === 'staff'
            ? ['total_staff', 'active_staff', 'branch_summaries']
            : ['total_requirements', 'compliant', 'branch_summaries']
      }
    });
  } catch (error) {
    console.error('Error getting report info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get report info',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ==========================================
// STRATEGIC PLANNING - BUDGETS
// ==========================================
router.get('/strategic-planning/budgets', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { rows: budgets } = await pool.query(`
      SELECT b.*, br.name as branch_name,
             b.allocated_amount as budgeted_amount,
             b.spent_amount as actual_amount,
             (COALESCE(b.spent_amount, 0) - COALESCE(b.allocated_amount, 0)) as variance
      FROM budgets b
      LEFT JOIN branches br ON b.branch_id = br.id
      ORDER BY b.fiscal_year DESC, b.fiscal_month DESC
    `);
    const { rows: categories } = await pool.query('SELECT * FROM budget_categories WHERE is_active = true');
    const { rows: summary } = await pool.query(`
      SELECT COALESCE(SUM(allocated_amount), 0) as total_budgeted,
             COALESCE(SUM(spent_amount), 0) as total_actual
      FROM budgets WHERE fiscal_year = $1
    `, [new Date().getFullYear()]);

    res.json({ success: true, data: { budgets, categories, summary: summary[0] } });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get budgets' });
  }
});

router.post('/strategic-planning/budgets', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { branch_id, fiscal_year, fiscal_month, category, name, allocated_amount, description } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO budgets (branch_id, fiscal_year, fiscal_month, category, name, allocated_amount, description, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft') RETURNING *
    `, [branch_id, fiscal_year, fiscal_month, category, name, allocated_amount, description]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create budget' });
  }
});

// Update budget
router.put('/strategic-planning/budgets/:id', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { fiscal_year, fiscal_month, category, name, allocated_amount, spent_amount, description, status } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (fiscal_year !== undefined) { updates.push(`fiscal_year = $${paramCount++}`); values.push(fiscal_year); }
    if (fiscal_month !== undefined) { updates.push(`fiscal_month = $${paramCount++}`); values.push(fiscal_month); }
    if (category !== undefined) { updates.push(`category = $${paramCount++}`); values.push(category); }
    if (name !== undefined) { updates.push(`name = $${paramCount++}`); values.push(name); }
    if (allocated_amount !== undefined) { updates.push(`allocated_amount = $${paramCount++}`); values.push(allocated_amount); }
    if (spent_amount !== undefined) { updates.push(`spent_amount = $${paramCount++}`); values.push(spent_amount); }
    if (description !== undefined) { updates.push(`description = $${paramCount++}`); values.push(description); }
    if (status !== undefined) { updates.push(`status = $${paramCount++}`); values.push(status); }
    updates.push(`updated_at = NOW()`);

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE budgets SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Budget not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update budget' });
  }
});

// Delete budget
router.delete('/strategic-planning/budgets/:id', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query('DELETE FROM budgets WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Budget not found' });
    }
    res.json({ success: true, message: 'Budget deleted' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete budget' });
  }
});

// Get branches for dropdowns
router.get('/branches', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, code FROM branches WHERE is_active = true ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get branches' });
  }
});

// ==========================================
// STRATEGIC PLANNING - FORECASTING
// ==========================================
router.get('/strategic-planning/forecasting', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { rows: forecasts } = await pool.query(`
      SELECT f.*, br.name as branch_name FROM forecasts f
      LEFT JOIN branches br ON f.branch_id = br.id
      ORDER BY f.forecast_date DESC
    `);
    const { rows: models } = await pool.query('SELECT * FROM forecast_models WHERE is_active = true');
    res.json({ success: true, data: { forecasts, models } });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get forecasts' });
  }
});

router.post('/strategic-planning/forecasting', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { branch_id, forecast_type, metric_name, forecast_date, forecast_value, confidence_level, model_used, notes } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO forecasts (branch_id, forecast_type, metric_name, forecast_date, forecast_value, confidence_level, model_used, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [branch_id, forecast_type, metric_name, forecast_date, forecast_value, confidence_level || 80, model_used || 'linear', notes]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create forecast' });
  }
});

// Update forecast
router.put('/strategic-planning/forecasting/:id', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { forecast_type, metric_name, forecast_date, forecast_value, actual_value, confidence_level, model_used, notes } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (forecast_type !== undefined) { updates.push(`forecast_type = $${paramCount++}`); values.push(forecast_type); }
    if (metric_name !== undefined) { updates.push(`metric_name = $${paramCount++}`); values.push(metric_name); }
    if (forecast_date !== undefined) { updates.push(`forecast_date = $${paramCount++}`); values.push(forecast_date); }
    if (forecast_value !== undefined) { updates.push(`forecast_value = $${paramCount++}`); values.push(forecast_value); }
    if (actual_value !== undefined) { updates.push(`actual_value = $${paramCount++}`); values.push(actual_value); }
    if (confidence_level !== undefined) { updates.push(`confidence_level = $${paramCount++}`); values.push(confidence_level); }
    if (model_used !== undefined) { updates.push(`model_used = $${paramCount++}`); values.push(model_used); }
    if (notes !== undefined) { updates.push(`notes = $${paramCount++}`); values.push(notes); }
    updates.push(`updated_at = NOW()`);

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE forecasts SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Forecast not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update forecast' });
  }
});

// Delete forecast
router.delete('/strategic-planning/forecasting/:id', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query('DELETE FROM forecasts WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Forecast not found' });
    }
    res.json({ success: true, message: 'Forecast deleted' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete forecast' });
  }
});

// Generate AI forecast using Python microservice
router.post('/strategic-planning/forecasting/generate', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { branch_id, forecast_type, metric_name, periods } = req.body;

    // Call Python microservice for AI forecasting
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
    const response = await fetch(`${pythonServiceUrl}/api/forecasting/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id, forecast_type, metric_name, periods: periods || 30 })
    });

    if (response.ok) {
      const data = await response.json();
      res.json({ success: true, data });
    } else {
      // Fallback to simple linear forecast
      const { rows: historicalData } = await pool.query(`
        SELECT DATE(created_at) as date, COALESCE(SUM(total_amount), 0) as value
        FROM restaurant_orders 
        WHERE branch_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '90 days'
        GROUP BY DATE(created_at) ORDER BY date
      `, [branch_id]);

      // Simple linear regression fallback
      const n = historicalData.length;
      if (n < 7) {
        return res.json({ success: true, data: { forecasts: [], message: 'Insufficient historical data' } });
      }

      const avgValue = historicalData.reduce((sum: number, d: any) => sum + parseFloat(d.value || 0), 0) / n;
      const forecasts = [];
      for (let i = 1; i <= (periods || 30); i++) {
        const forecastDate = new Date();
        forecastDate.setDate(forecastDate.getDate() + i);
        forecasts.push({
          date: forecastDate.toISOString().split('T')[0],
          value: avgValue * (1 + (Math.random() - 0.5) * 0.1),
          confidence: 70
        });
      }
      res.json({ success: true, data: { forecasts, model: 'simple_average' } });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate forecast' });
  }
});

// ==========================================
// STRATEGIC PLANNING - PROCUREMENT
// ==========================================
router.get('/strategic-planning/procurement', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { rows: requests } = await pool.query(`
      SELECT pr.*, br.name as branch_name FROM procurement_requests pr
      LEFT JOIN branches br ON pr.branch_id = br.id
      ORDER BY pr.created_at DESC
    `);
    const { rows: vendors } = await pool.query('SELECT * FROM procurement_vendors WHERE is_active = true');
    const { rows: summary } = await pool.query(`
      SELECT COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
             COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
             COALESCE(SUM(total_amount) FILTER (WHERE status = 'pending'), 0) as pending_amount
      FROM procurement_requests
    `);
    res.json({ success: true, data: { requests, vendors, summary: summary[0] } });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get procurement' });
  }
});

router.post('/strategic-planning/procurement', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { branch_id, category, title, description, items, total_amount, priority, required_date, notes } = req.body;
    const requestNumber = `PR-${Date.now().toString(36).toUpperCase()}`;
    const { rows } = await pool.query(`
      INSERT INTO procurement_requests (request_number, branch_id, category, title, description, items, total_amount, priority, required_date, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending') RETURNING *
    `, [requestNumber, branch_id, category, title, description, JSON.stringify(items || []), total_amount || 0, priority || 'medium', required_date, notes]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create procurement request' });
  }
});

// Update procurement request
router.put('/strategic-planning/procurement/:id', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { category, title, description, items, total_amount, priority, required_date, notes, status } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (category !== undefined) { updates.push(`category = $${paramCount++}`); values.push(category); }
    if (title !== undefined) { updates.push(`title = $${paramCount++}`); values.push(title); }
    if (description !== undefined) { updates.push(`description = $${paramCount++}`); values.push(description); }
    if (items !== undefined) { updates.push(`items = $${paramCount++}`); values.push(JSON.stringify(items)); }
    if (total_amount !== undefined) { updates.push(`total_amount = $${paramCount++}`); values.push(total_amount); }
    if (priority !== undefined) { updates.push(`priority = $${paramCount++}`); values.push(priority); }
    if (required_date !== undefined) { updates.push(`required_date = $${paramCount++}`); values.push(required_date); }
    if (notes !== undefined) { updates.push(`notes = $${paramCount++}`); values.push(notes); }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
      if (status === 'approved') {
        updates.push(`approved_at = NOW()`);
      }
    }
    updates.push(`updated_at = NOW()`);

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE procurement_requests SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Procurement request not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update procurement request' });
  }
});

// Delete procurement request
router.delete('/strategic-planning/procurement/:id', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query('DELETE FROM procurement_requests WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Procurement request not found' });
    }
    res.json({ success: true, message: 'Procurement request deleted' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete procurement request' });
  }
});

// Get vendors
router.get('/strategic-planning/vendors', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM procurement_vendors WHERE is_active = true ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get vendors' });
  }
});

// Create vendor
router.post('/strategic-planning/vendors', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { name, contact_person, email, phone, address, category, payment_terms, notes } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO procurement_vendors (name, contact_person, email, phone, address, category, payment_terms, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [name, contact_person, email, phone, address, category, payment_terms, notes]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create vendor' });
  }
});

// ==========================================
// ANALYTICS - REPORTS
// ==========================================
router.get('/analytics/reports', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { rows: reports } = await pool.query(`
      SELECT ar.*, br.name as branch_name FROM analytics_reports ar
      LEFT JOIN branches br ON ar.branch_id = br.id
      ORDER BY ar.generated_at DESC LIMIT 100
    `);
    res.json({ success: true, data: { reports, report_types: ['financial', 'operational', 'sales', 'inventory', 'staff'] } });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get reports' });
  }
});

router.post('/analytics/reports', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { report_name, report_type, branch_id, date_from, date_to } = req.body;

    // Generate report data based on type
    let reportData: any = {};

    if (report_type === 'financial') {
      const { rows: revenue } = await pool.query(`
        SELECT COALESCE(SUM(total_amount), 0) as total_revenue, COUNT(*) as total_orders,
               COALESCE(AVG(total_amount), 0) as avg_order_value
        FROM restaurant_orders 
        WHERE created_at >= $1 AND created_at <= $2 ${branch_id ? 'AND branch_id = $3' : ''}
      `, branch_id ? [date_from, date_to, branch_id] : [date_from, date_to]);
      reportData = { ...revenue[0] };
    } else if (report_type === 'sales') {
      const { rows: dailySales } = await pool.query(`
        SELECT DATE(created_at) as date, COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders
        FROM restaurant_orders 
        WHERE created_at >= $1 AND created_at <= $2 ${branch_id ? 'AND branch_id = $3' : ''}
        GROUP BY DATE(created_at) ORDER BY date
      `, branch_id ? [date_from, date_to, branch_id] : [date_from, date_to]);
      reportData = { daily_sales: dailySales };
    } else if (report_type === 'inventory') {
      const { rows: inventory } = await pool.query(`
        SELECT * FROM branch_inventory ${branch_id ? 'WHERE branch_id = $1' : ''} ORDER BY item_name
      `, branch_id ? [branch_id] : []);
      reportData = { inventory };
    } else if (report_type === 'staff') {
      const { rows: staff } = await pool.query(`
        SELECT sp.*, br.name as branch_name FROM staff_profiles sp
        LEFT JOIN branches br ON sp.branch_id = br.id
        ${branch_id ? 'WHERE sp.branch_id = $1' : ''} ORDER BY sp.full_name
      `, branch_id ? [branch_id] : []);
      reportData = { staff };
    }

    const { rows } = await pool.query(`
      INSERT INTO analytics_reports (report_name, report_type, branch_id, date_from, date_to, data)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [report_name, report_type, branch_id || null, date_from, date_to, JSON.stringify(reportData)]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create report' });
  }
});

// Delete report
router.delete('/analytics/reports/:id', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query('DELETE FROM analytics_reports WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    res.json({ success: true, message: 'Report deleted' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete report' });
  }
});

// Download report as CSV
router.get('/analytics/reports/:id/download', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM analytics_reports WHERE id = $1', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const report = rows[0];
    const data = typeof report.data === 'string' ? JSON.parse(report.data) : report.data;

    // Convert to CSV
    let csv = '';
    if (data.daily_sales) {
      csv = 'Date,Revenue,Orders\n';
      data.daily_sales.forEach((row: any) => {
        csv += `${row.date},${row.revenue},${row.orders}\n`;
      });
    } else if (data.inventory) {
      csv = 'Item Name,Quantity,Unit,Reorder Level\n';
      data.inventory.forEach((row: any) => {
        csv += `${row.item_name},${row.quantity},${row.unit},${row.reorder_level}\n`;
      });
    } else if (data.staff) {
      csv = 'Name,Email,Role,Branch\n';
      data.staff.forEach((row: any) => {
        csv += `${row.full_name},${row.email},${row.role},${row.branch_name}\n`;
      });
    } else {
      csv = Object.entries(data).map(([key, value]) => `${key},${value}`).join('\n');
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${report.report_name}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to download report' });
  }
});

// Generate PDF report via Python microservice
router.post('/analytics/reports/generate-pdf', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { report_type, filters, branch_id, date_from, date_to } = req.body;

    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
    const response = await fetch(`${pythonServiceUrl}/api/reports/generate/branded-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportType: report_type,
        filters: { ...filters, branch_id, date_from, date_to },
        useRealData: true
      })
    });

    if (response.ok) {
      const pdfBuffer = await response.arrayBuffer();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="FG_${report_type}_${new Date().toISOString().split('T')[0]}.pdf"`);
      res.send(Buffer.from(pdfBuffer));
    } else {
      res.status(500).json({ success: false, message: 'PDF generation service unavailable' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate PDF report' });
  }
});

// Generate Excel report via Python microservice
router.post('/analytics/reports/generate-excel', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { report_type, filters, branch_id, date_from, date_to } = req.body;

    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
    const response = await fetch(`${pythonServiceUrl}/api/reports/generate/excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportType: report_type,
        filters: { ...filters, branch_id, date_from, date_to }
      })
    });

    if (response.ok) {
      const excelBuffer = await response.arrayBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="FG_${report_type}_${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.send(Buffer.from(excelBuffer));
    } else {
      res.status(500).json({ success: false, message: 'Excel generation service unavailable' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate Excel report' });
  }
});

// ==========================================
// ANALYTICS - TRENDS
// ==========================================
router.get('/analytics/trends', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { rows: revenueTrend } = await pool.query(`
      SELECT DATE(created_at) as date, COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders
      FROM restaurant_orders WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at) ORDER BY date DESC
    `);
    const totalRevenue = revenueTrend.reduce((sum: number, r: any) => sum + parseFloat(r.revenue || 0), 0);
    const totalOrders = revenueTrend.reduce((sum: number, r: any) => sum + parseInt(r.orders || 0), 0);
    res.json({ success: true, data: { revenue_trend: revenueTrend, summary: { total_revenue: totalRevenue, total_orders: totalOrders } } });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get trends' });
  }
});

// ==========================================
// ANALYTICS - EXECUTIVE
// ==========================================
router.get('/analytics/executive', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { rows: branches } = await pool.query('SELECT * FROM branches ORDER BY name');
    const { rows: revenueData } = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) as total_revenue, COUNT(*) as total_orders
      FROM restaurant_orders WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    `);
    const { rows: staffData } = await pool.query('SELECT COUNT(*) as count FROM staff_profiles');
    const { rows: kpis } = await pool.query('SELECT * FROM kpi_definitions WHERE is_active = true');

    const branchData = await Promise.all(branches.map(async (branch: any) => {
      const { rows } = await pool.query(`
        SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders
        FROM restaurant_orders WHERE branch_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      `, [branch.id]);
      return { branch_id: branch.id, branch_name: branch.name, revenue: parseFloat(rows[0]?.revenue || 0), orders: parseInt(rows[0]?.orders || 0) };
    }));

    res.json({
      success: true,
      data: {
        total_revenue: parseFloat(revenueData[0]?.total_revenue || 0),
        total_orders: parseInt(revenueData[0]?.total_orders || 0),
        staff_count: parseInt(staffData[0]?.count || 0),
        branches: branchData,
        kpis
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get executive data' });
  }
});

// ==========================================
// REPORTS - PERFORMANCE EXPORT
// ==========================================
router.post('/reports/performance', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { format = 'pdf', period = 'week' } = req.query;
    const performanceData = req.body;

    // Forward to Python microservice for report generation
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
    const reportType = 'branch_performance';

    const filters = {
      period: period as string,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0]
    };

    const endpoint = format === 'excel'
      ? `${pythonServiceUrl}/api/reports/generate/excel`
      : `${pythonServiceUrl}/api/reports/generate/branded-pdf`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportType,
        filters,
        useRealData: false, // Use the data passed from frontend
        data: performanceData
      })
    });

    if (!response.ok) {
      throw new Error(`Python service returned ${response.status}`);
    }

    const contentType = format === 'excel'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/pdf';

    const filename = format === 'excel'
      ? `FG_Branch_Performance_${new Date().toISOString().split('T')[0]}.xlsx`
      : `FG_Branch_Performance_${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe the response from Python service
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('Error generating performance report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ==========================================
// STRATEGIC PLANNING - BUDGETS
// ==========================================
router.get('/planning/budgets', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    // Placeholder for budget management
    res.json({
      success: true,
      message: 'Budget data retrieved successfully (Placeholder)',
      data: []
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get budgets' });
  }
});

// ==========================================
// FINANCES - REPORTS
// ==========================================
router.get('/finances/reports', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    // Placeholder for financial reports
    res.json({
      success: true,
      message: 'Financial reports retrieved successfully (Placeholder)',
      data: []
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to get financial reports' });
  }
});

export default router;
