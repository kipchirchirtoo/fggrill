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
    
    // Production code would go here
    // This would involve queries to multiple tables to get aggregated data
    
    res.status(200).json({
      success: true,
      message: 'Dashboard data retrieved successfully',
      data: {}
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
router.get('/branches/compare', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { metric = 'revenue', period = 'month' } = req.query;
    
    // Production code would be here
    
    res.status(200).json({
      success: true,
      message: 'Branch comparison data retrieved successfully',
      data: []
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
router.get('/staff/all', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    
    // Production code would be here
    
    res.status(200).json({
      success: true,
      message: 'Staff overview retrieved successfully',
      data: {}
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
router.get('/warehouse/inventory', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { category, search, lowStock } = req.query;
    
    // First, ensure the table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS central_warehouse_inventory (
        sku VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        central_stock INTEGER NOT NULL DEFAULT 0,
        reorder_level INTEGER NOT NULL DEFAULT 0,
        value INTEGER NOT NULL DEFAULT 0,
        branch_allocations JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Build the query with filters
    let query = `
      SELECT * FROM central_warehouse_inventory
      WHERE 1=1
    `;
    
    const queryParams: any[] = [];
    
    if (category && category !== 'all') {
      query += ` AND category = $${queryParams.length + 1}`;
      queryParams.push(category);
    }
    
    if (search) {
      query += ` AND (name ILIKE $${queryParams.length + 1} OR sku ILIKE $${queryParams.length + 1})`;
      queryParams.push(`%${search}%`);
    }
    
    if (lowStock === 'true') {
      query += ` AND central_stock <= reorder_level`;
    }
    
    query += ' ORDER BY category, name';
    
    const { rows } = await pool.query(query, queryParams);
    
    // If we don't have any items and we're in development, create some example items
    if (rows.length === 0 && process.env.NODE_ENV === 'development') {
      
      // Insert some example items
      const exampleItems = [
        {
          sku: 'FG-BV-001',
          name: 'Tusker Lager',
          category: 'beverages',
          unit: 'bottle',
          central_stock: 240,
          reorder_level: 50,
          value: 36000,
          branch_allocations: { '1': 120, '2': 80, '3': 60, '4': 100 }
        },
        {
          sku: 'FG-FD-001',
          name: 'Rice',
          category: 'food',
          unit: 'kg',
          central_stock: 500,
          reorder_level: 100,
          value: 75000,
          branch_allocations: { '1': 150, '2': 120, '3': 100, '4': 180 }
        },
        {
          sku: 'FG-HK-001',
          name: 'Toilet Paper',
          category: 'housekeeping',
          unit: 'roll',
          central_stock: 800,
          reorder_level: 200,
          value: 80000,
          branch_allocations: { '1': 250, '2': 200, '3': 150, '4': 300 }
        }
      ];
      
      for (const item of exampleItems) {
        await pool.query(`
          INSERT INTO central_warehouse_inventory (sku, name, category, unit, central_stock, reorder_level, value, branch_allocations)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (sku) DO NOTHING
        `, [item.sku, item.name, item.category, item.unit, item.central_stock, item.reorder_level, item.value, JSON.stringify(item.branch_allocations)]);
      }
      
      // Query again to get the newly inserted items
      const { rows: newRows } = await pool.query(query, queryParams);
      
      res.status(200).json({
        success: true,
        message: 'Inventory retrieved successfully',
        data: newRows
      });
      return;
    }
    
    res.status(200).json({
      success: true,
      message: 'Inventory retrieved successfully',
      data: rows
    });
  } catch (error) {
    console.error('Error getting central warehouse inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get inventory',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get inventory item by SKU
router.get('/warehouse/inventory/:sku', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { sku } = req.params;
    
    const { rows } = await pool.query(`
      SELECT * FROM central_warehouse_inventory
      WHERE sku = $1
    `, [sku]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Item with SKU ${sku} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Item retrieved successfully',
      data: rows[0]
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
    const { sku, name, category, unit, central_stock, reorder_level, value, branch_allocations } = req.body;
    
    // Validate required fields
    if (!sku || !name || !category || !unit) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: sku, name, category, unit'
      });
    }
    
    // Check if item already exists
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM central_warehouse_inventory WHERE sku = $1',
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
      INSERT INTO central_warehouse_inventory (sku, name, category, unit, central_stock, reorder_level, value, branch_allocations)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      sku,
      name,
      category,
      unit,
      central_stock || 0,
      reorder_level || 0,
      value || 0,
      JSON.stringify(branch_allocations || {})
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
router.put('/warehouse/inventory/:sku', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { sku } = req.params;
    const { name, category, unit, central_stock, reorder_level, value, branch_allocations } = req.body;
    
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
    
    // Update item
    const { rows } = await pool.query(`
      UPDATE central_warehouse_inventory
      SET 
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        unit = COALESCE($3, unit),
        central_stock = COALESCE($4, central_stock),
        reorder_level = COALESCE($5, reorder_level),
        value = COALESCE($6, value),
        branch_allocations = COALESCE($7, branch_allocations),
        updated_at = CURRENT_TIMESTAMP
      WHERE sku = $8
      RETURNING *
    `, [
      name,
      category,
      unit,
      central_stock,
      reorder_level,
      value,
      branch_allocations ? JSON.stringify(branch_allocations) : null,
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
router.get('/warehouse/requests', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { status, branch_id } = req.query;
    
    // First, ensure the table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS warehouse_requests (
        id VARCHAR(50) PRIMARY KEY,
        branch_id INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        priority VARCHAR(20) NOT NULL DEFAULT 'normal',
        requested_by VARCHAR(100) NOT NULL,
        items JSONB NOT NULL DEFAULT '[]',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Build the query with filters
    let query = `
      SELECT r.*, b.name as branch_name
      FROM warehouse_requests r
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE 1=1
    `;
    
    const queryParams: any[] = [];
    
    if (status) {
      query += ` AND r.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }
    
    if (branch_id) {
      query += ` AND r.branch_id = $${queryParams.length + 1}`;
      queryParams.push(branch_id);
    }
    
    query += ' ORDER BY r.created_at DESC';
    
    const { rows } = await pool.query(query, queryParams);
    
    // If we don't have any requests and we're in development, create some example data
    if (rows.length === 0 && process.env.NODE_ENV === 'development') {
      // Insert some example requests
      const exampleRequests = [
        {
          id: 'REQ-2025-001',
          branch_id: 1,
          status: 'pending',
          priority: 'high',
          requested_by: 'John Doe',
          items: [
            { sku: 'FG-BV-001', name: 'Tusker Lager', quantity: 50, unit: 'bottle' },
            { sku: 'FG-FD-001', name: 'Rice', quantity: 25, unit: 'kg' }
          ],
          notes: 'Urgent request for weekend event'
        },
        {
          id: 'REQ-2025-002',
          branch_id: 2,
          status: 'pending',
          priority: 'medium',
          requested_by: 'Jane Smith',
          items: [
            { sku: 'FG-HK-001', name: 'Toilet Paper', quantity: 100, unit: 'roll' }
          ],
          notes: 'Regular weekly replenishment'
        },
        {
          id: 'REQ-2025-003',
          branch_id: 3,
          status: 'approved',
          priority: 'normal',
          requested_by: 'Robert Johnson',
          items: [
            { sku: 'FG-FD-001', name: 'Rice', quantity: 30, unit: 'kg' }
          ],
          notes: ''
        }
      ];
      
      for (const request of exampleRequests) {
        await pool.query(`
          INSERT INTO warehouse_requests (id, branch_id, status, priority, requested_by, items, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO NOTHING
        `, [
          request.id,
          request.branch_id,
          request.status,
          request.priority,
          request.requested_by,
          JSON.stringify(request.items),
          request.notes
        ]);
      }
      
      // Query again to get the newly inserted requests with branch names
      const { rows: newRows } = await pool.query(query, queryParams);
      
      res.status(200).json({
        success: true,
        message: 'Requests retrieved successfully',
        data: newRows
      });
      return;
    }
    
    res.status(200).json({
      success: true,
      message: 'Requests retrieved successfully',
      data: rows
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
      FROM warehouse_requests r
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE r.status = 'pending'
      ORDER BY 
        CASE 
          WHEN r.priority = 'high' THEN 1
          WHEN r.priority = 'medium' THEN 2
          ELSE 3
        END,
        r.created_at ASC
    `);
    
    res.status(200).json({
      success: true,
      message: 'Pending requests retrieved successfully',
      data: rows
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
      SELECT r.*, b.name as branch_name
      FROM warehouse_requests r
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE r.id = $1
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Request with ID ${id} not found`
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Request retrieved successfully',
      data: rows[0]
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
  try {
    const { branch_id, items, priority = 'normal', notes = '' } = req.body;
    
    // Validate required fields
    if (!branch_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: branch_id, items (array)'
      });
    }
    
    // Generate a unique ID
    const date = new Date();
    const year = date.getFullYear();
    const { rows: countRows } = await pool.query(
      "SELECT COUNT(*) FROM warehouse_requests WHERE id LIKE $1",
      [`REQ-${year}-%`]
    );
    const count = parseInt(countRows[0].count) + 1;
    const id = `REQ-${year}-${count.toString().padStart(3, '0')}`;
    
    // Insert new request
    const { rows } = await pool.query(`
      INSERT INTO warehouse_requests (id, branch_id, status, priority, requested_by, items, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      id,
      branch_id,
      'pending',
      priority,
      req.user?.email || 'Unknown',
      JSON.stringify(items),
      notes
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Request created successfully',
      data: rows[0]
    });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Review request (approve/reject)
router.put('/warehouse/requests/:id/review', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'approved' or 'rejected'"
      });
    }
    
    // Check if request exists and is in pending status
    const { rows: existingRows } = await pool.query(
      'SELECT * FROM warehouse_requests WHERE id = $1',
      [id]
    );
    
    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Request with ID ${id} not found`
      });
    }
    
    if (existingRows[0].status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Request has already been ${existingRows[0].status}`
      });
    }
    
    // Update request
    const { rows } = await pool.query(`
      UPDATE warehouse_requests
      SET status = $1, notes = COALESCE($2::text, notes), updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [status, notes || null, id]);
    
    res.status(200).json({
      success: true,
      message: `Request ${status} successfully`,
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
router.get('/warehouse/dispatches', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { status, branch_id } = req.query;
    
    // First, ensure the table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS warehouse_dispatches (
        id VARCHAR(50) PRIMARY KEY,
        branch_id INTEGER NOT NULL,
        request_id VARCHAR(50),
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        dispatched_by VARCHAR(100),
        received_by VARCHAR(100),
        items JSONB NOT NULL DEFAULT '[]',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        dispatched_at TIMESTAMP,
        received_at TIMESTAMP
      )
    `);
    
    // Build the query with filters
    let query = `
      SELECT d.*, b.name as branch_name
      FROM warehouse_dispatches d
      LEFT JOIN branches b ON d.branch_id = b.id
      WHERE 1=1
    `;
    
    const queryParams: any[] = [];
    
    if (status) {
      query += ` AND d.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }
    
    if (branch_id) {
      query += ` AND d.branch_id = $${queryParams.length + 1}`;
      queryParams.push(branch_id);
    }
    
    query += ' ORDER BY d.created_at DESC';
    
    const { rows } = await pool.query(query, queryParams);
    
    // If we don't have any dispatches and we're in development, seed some data
    if (rows.length === 0 && process.env.NODE_ENV === 'development') {
      
      // Insert some example dispatches if we have requests
      const { rows: requestRows } = await pool.query(
        "SELECT * FROM warehouse_requests WHERE status = 'approved' LIMIT 1"
      );
      
      if (requestRows.length > 0) {
        const request = requestRows[0];
        const dispatchId = `DISP-${new Date().getFullYear()}-001`;
        
        // Ensure items is properly stringified for JSONB
        const itemsJson = typeof request.items === 'string' ? request.items : JSON.stringify(request.items);
        
        await pool.query(`
          INSERT INTO warehouse_dispatches (id, branch_id, request_id, status, items)
          VALUES ($1, $2, $3, $4, $5::jsonb)
          ON CONFLICT (id) DO NOTHING
        `, [
          dispatchId,
          request.branch_id,
          request.id,
          'pending',
          itemsJson
        ]);
      } else {
        // Create a default dispatch if no approved requests
        const dispatchId = `DISP-${new Date().getFullYear()}-001`;
        await pool.query(`
          INSERT INTO warehouse_dispatches (id, branch_id, status, items)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO NOTHING
        `, [
          dispatchId,
          1, // Branch ID 1
          'pending',
          JSON.stringify([
            { sku: 'FG-BV-001', name: 'Tusker Lager', quantity: 50, unit: 'bottle' },
            { sku: 'FG-FD-001', name: 'Rice', quantity: 25, unit: 'kg' }
          ])
        ]);
      }
      
      // Query again to get the newly inserted dispatches with branch names
      const { rows: newRows } = await pool.query(query, queryParams);
      
      res.status(200).json({
        success: true,
        message: 'Dispatches retrieved successfully',
        data: newRows
      });
      return;
    }
    
    res.status(200).json({
      success: true,
      message: 'Dispatches retrieved successfully',
      data: rows
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
  try {
    const { request_id, items, notes } = req.body;
    
    // If request_id is provided, get the request details
    if (request_id) {
      const { rows: requestRows } = await pool.query(
        'SELECT * FROM warehouse_requests WHERE id = $1',
        [request_id]
      );
      
      if (requestRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Request with ID ${request_id} not found`
        });
      }
      
      const request = requestRows[0];
      
      if (request.status !== 'approved') {
        return res.status(400).json({
          success: false,
          message: `Request must be approved before creating a dispatch. Current status: ${request.status}`
        });
      }
      
      // Generate a unique ID
      const date = new Date();
      const year = date.getFullYear();
      const { rows: countRows } = await pool.query(
        "SELECT COUNT(*) FROM warehouse_dispatches WHERE id LIKE $1",
        [`DISP-${year}-%`]
      );
      const count = parseInt(countRows[0].count) + 1;
      const id = `DISP-${year}-${count.toString().padStart(3, '0')}`;
      
      // Ensure items is properly stringified for JSONB
      const itemsJson = typeof request.items === 'string' ? request.items : JSON.stringify(request.items);
      
      // Create dispatch from request
      const { rows } = await pool.query(`
        INSERT INTO warehouse_dispatches (id, branch_id, request_id, status, items, notes)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6)
        RETURNING *
      `, [
        id,
        request.branch_id,
        request_id,
        'pending',
        itemsJson,
        notes || ''
      ]);
      
      res.status(201).json({
        success: true,
        message: 'Dispatch created successfully from request',
        data: rows[0]
      });
    }
    // If no request_id, create a direct dispatch
    else {
      const { branch_id } = req.body;
      
      if (!branch_id || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: branch_id, items (array)'
        });
      }
      
      // Generate a unique ID
      const date = new Date();
      const year = date.getFullYear();
      const { rows: countRows } = await pool.query(
        "SELECT COUNT(*) FROM warehouse_dispatches WHERE id LIKE $1",
        [`DISP-${year}-%`]
      );
      const count = parseInt(countRows[0].count) + 1;
      const id = `DISP-${year}-${count.toString().padStart(3, '0')}`;
      
      // Create direct dispatch
      const { rows } = await pool.query(`
        INSERT INTO warehouse_dispatches (id, branch_id, status, items, notes)
        VALUES ($1, $2, $3, $4::jsonb, $5)
        RETURNING *
      `, [
        id,
        branch_id,
        'pending',
        JSON.stringify(items),
        notes || ''
      ]);
      
      res.status(201).json({
        success: true,
        message: 'Direct dispatch created successfully',
        data: rows[0]
      });
    }
  } catch (error) {
    console.error('Error creating dispatch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create dispatch',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Send dispatch (change status to in_transit and deduct from inventory)
router.put('/warehouse/dispatches/:id/dispatch', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Start a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if dispatch exists and is in pending status
      const { rows: dispatchRows } = await client.query(
        'SELECT * FROM warehouse_dispatches WHERE id = $1',
        [id]
      );
      
      if (dispatchRows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: `Dispatch with ID ${id} not found`
        });
      }
      
      const dispatch = dispatchRows[0];
      
      if (dispatch.status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Dispatch has already been ${dispatch.status}`
        });
      }
      
      const items = dispatch.items;
      
      // Check if all items have sufficient stock
      for (const item of items) {
        const { rows: stockRows } = await client.query(
          'SELECT * FROM central_warehouse_inventory WHERE sku = $1',
          [item.sku]
        );
        
        if (stockRows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({
            success: false,
            message: `Item with SKU ${item.sku} not found in inventory`
          });
        }
        
        if (stockRows[0].central_stock < item.quantity) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${item.name} (SKU: ${item.sku}). Available: ${stockRows[0].central_stock}, Required: ${item.quantity}`
          });
        }
      }
      
      // Update inventory - deduct stock
      for (const item of items) {
        await client.query(
          'UPDATE central_warehouse_inventory SET central_stock = central_stock - $1 WHERE sku = $2',
          [item.quantity, item.sku]
        );
      }
      
      // Update dispatch status
      const { rows } = await client.query(`
        UPDATE warehouse_dispatches
        SET status = 'in_transit', dispatched_by = $1, dispatched_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [req.user?.email || 'System', id]);
      
      await client.query('COMMIT');
      
      res.status(200).json({
        success: true,
        message: 'Dispatch sent successfully',
        data: rows[0]
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error dispatching items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to dispatch items',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Receive dispatch at branch
router.put('/warehouse/dispatches/:id/receive', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    // Check if dispatch exists and is in in_transit status
    const { rows: dispatchRows } = await pool.query(
      'SELECT * FROM warehouse_dispatches WHERE id = $1',
      [id]
    );
    
    if (dispatchRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Dispatch with ID ${id} not found`
      });
    }
    
    const dispatch = dispatchRows[0];
    
    if (dispatch.status !== 'in_transit') {
      return res.status(400).json({
        success: false,
        message: `Dispatch must be in_transit to be received. Current status: ${dispatch.status}`
      });
    }
    
    // Update dispatch status
    const { rows } = await pool.query(`
      UPDATE warehouse_dispatches
      SET status = 'delivered', received_by = $1, received_at = CURRENT_TIMESTAMP, notes = CASE WHEN $2 IS NULL THEN notes ELSE $2 END, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [req.user?.email || 'Unknown', notes, id]);
    
    res.status(200).json({
      success: true,
      message: 'Dispatch received successfully',
      data: rows[0]
    });
  } catch (error) {
    console.error('Error receiving dispatch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to receive dispatch',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ==========================================
// BRANCH TRANSFER ENDPOINTS
// ==========================================

// Get all transfers with optional filters
router.get('/warehouse/transfers', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { status, from_branch_id, to_branch_id } = req.query;
    
    // First, ensure the table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS branch_transfers (
        id VARCHAR(50) PRIMARY KEY,
        from_branch_id INTEGER NOT NULL,
        to_branch_id INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        requested_by VARCHAR(100),
        approved_by VARCHAR(100),
        completed_by VARCHAR(100),
        items JSONB NOT NULL DEFAULT '[]',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP,
        shipped_at TIMESTAMP,
        received_at TIMESTAMP
      )
    `);
    
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
    
    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS branch_transfers (
        id VARCHAR(50) PRIMARY KEY,
        from_branch_id INTEGER NOT NULL,
        to_branch_id INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        requested_by VARCHAR(100),
        approved_by VARCHAR(100),
        completed_by VARCHAR(100),
        items JSONB NOT NULL DEFAULT '[]',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP,
        shipped_at TIMESTAMP,
        received_at TIMESTAMP
      )
    `);
    
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
router.get('/warehouse/suppliers', protect, validateCentralOperationsRole, async (req, res) => {
  try {
    const { category, status } = req.query;
    
    // First, ensure the table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        contact_person VARCHAR(100),
        email VARCHAR(100),
        phone VARCHAR(50),
        address TEXT,
        category VARCHAR(100),
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        rating INTEGER DEFAULT 5,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Build the query with filters
    let query = 'SELECT * FROM suppliers WHERE 1=1';
    const queryParams: any[] = [];
    
    if (category) {
      query += ` AND category = $${queryParams.length + 1}`;
      queryParams.push(category);
    }
    
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
    
    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        contact_person VARCHAR(100),
        email VARCHAR(100),
        phone VARCHAR(50),
        address TEXT,
        category VARCHAR(100),
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        rating INTEGER DEFAULT 5,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
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
      } catch (e) {}
      
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
      } catch (e) {}
      
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

export default router;
