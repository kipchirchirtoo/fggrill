const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// Get Purchase Order Details
router.get('/purchase-orders/:id', authenticate, authorize(['super_admin', 'manager', 'storekeeper']), async (req, res) => {
  try {
    // Fetch PO details with supplier info
    const poResult = await pool.query(
      `SELECT po.*, s.name as supplier_name, s.email as supplier_email, 
              s.phone as supplier_phone, s.address as supplier_address
       FROM purchase_orders po
       JOIN suppliers s ON po.supplier_id = s.id
       WHERE po.id = $1`,
      [req.params.id]
    );

    if (poResult.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    // Fetch PO items
    const itemsResult = await pool.query(
      `SELECT poi.*, i.name as item_name, i.unit
       FROM purchase_order_items poi
       JOIN inventory_items i ON poi.item_id = i.id
       WHERE poi.po_id = $1`,
      [req.params.id]
    );

    const po = poResult.rows[0];
    po.items = itemsResult.rows;

    res.json(po);
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

// Purchase Orders
router.post('/purchase-orders', authenticate, authorize(['super_admin', 'manager', 'storekeeper']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { branch, supplier_id, items, notes } = req.body;
    const poNumber = await client.query('SELECT generate_po_number()');
    
    const poResult = await client.query(
      `INSERT INTO purchase_orders (po_number, supplier_id, branch, notes, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [poNumber.rows[0].generate_po_number, supplier_id, branch, notes, req.user.id]
    );

    const poId = poResult.rows[0].id;
    let totalAmount = 0;

    for (const item of items) {
      const totalPrice = item.quantity * item.unit_price;
      totalAmount += totalPrice;

      await client.query(
        `INSERT INTO purchase_order_items (po_id, item_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [poId, item.item_id, item.quantity, item.unit_price, totalPrice]
      );
    }

    await client.query(
      'UPDATE purchase_orders SET total_amount = $1 WHERE id = $2',
      [totalAmount, poId]
    );

    await client.query('COMMIT');
    res.status(201).json({ id: poId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating purchase order:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  } finally {
    client.release();
  }
});

// Requisitions
router.post('/requisitions', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { department, branch, items, notes, priority } = req.body;
    const reqNumber = await client.query('SELECT generate_requisition_number()');
    
    const reqResult = await client.query(
      `INSERT INTO requisitions (requisition_number, department, branch, notes, priority, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [reqNumber.rows[0].generate_requisition_number, department, branch, notes, priority, req.user.id]
    );

    const reqId = reqResult.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO requisition_items (requisition_id, item_id, quantity)
         VALUES ($1, $2, $3)`,
        [reqId, item.item_id, item.quantity]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ id: reqId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating requisition:', error);
    res.status(500).json({ error: 'Failed to create requisition' });
  } finally {
    client.release();
  }
});

// Approve Purchase Order
router.post('/purchase-orders/:id/approve', authenticate, authorize(['super_admin', 'manager']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(
      'SELECT process_purchase_order_approval($1, $2)',
      [req.params.id, req.user.id]
    );

    await client.query('COMMIT');
    res.status(200).json({ message: 'Purchase order approved successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error approving purchase order:', error);
    res.status(500).json({ error: 'Failed to approve purchase order' });
  } finally {
    client.release();
  }
});

// Receive Purchase Order
router.post('/purchase-orders/:id/receive', authenticate, authorize(['super_admin', 'manager', 'storekeeper']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(
      'SELECT process_purchase_order_receiving($1, $2)',
      [req.params.id, JSON.stringify(req.body.items)]
    );

    await client.query('COMMIT');
    res.status(200).json({ message: 'Purchase order received successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error receiving purchase order:', error);
    res.status(500).json({ error: 'Failed to receive purchase order' });
  } finally {
    client.release();
  }
});

// Approve Requisition
router.post('/requisitions/:id/approve', authenticate, authorize(['super_admin', 'manager', 'storekeeper']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(
      'SELECT process_requisition_approval($1, $2)',
      [req.params.id, req.user.id]
    );

    await client.query('COMMIT');
    res.status(200).json({ message: 'Requisition approved successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error approving requisition:', error);
    res.status(500).json({ error: 'Failed to approve requisition' });
  } finally {
    client.release();
  }
});

// Fulfill Requisition
router.post('/requisitions/:id/fulfill', authenticate, authorize(['super_admin', 'manager', 'storekeeper']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(
      'SELECT process_requisition_fulfillment($1, $2)',
      [req.params.id, JSON.stringify(req.body.items)]
    );

    await client.query('COMMIT');
    res.status(200).json({ message: 'Requisition fulfilled successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error fulfilling requisition:', error);
    res.status(500).json({ error: 'Failed to fulfill requisition' });
  } finally {
    client.release();
  }
});

// Get Inventory Alerts
router.get('/inventory/alerts', authenticate, authorize(['super_admin', 'manager', 'storekeeper']), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM v_inventory_alerts');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching inventory alerts:', error);
    res.status(500).json({ error: 'Failed to fetch inventory alerts' });
  }
});

// Get Purchase Order Summary
router.get('/purchase-orders/summary', authenticate, authorize(['super_admin', 'manager', 'storekeeper']), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM v_purchase_order_summary');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching PO summary:', error);
    res.status(500).json({ error: 'Failed to fetch PO summary' });
  }
});

// Get Requisition Summary
router.get('/requisitions/summary', authenticate, authorize(['super_admin', 'manager', 'storekeeper']), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM v_requisition_summary');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching requisition summary:', error);
    res.status(500).json({ error: 'Failed to fetch requisition summary' });
  }
});

// Get Supplier Performance
router.get('/suppliers/performance', authenticate, authorize(['super_admin', 'manager']), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM v_supplier_performance');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching supplier performance:', error);
    res.status(500).json({ error: 'Failed to fetch supplier performance' });
  }
});


// Get Supplier Details
router.get('/suppliers/:id', authenticate, authorize(['super_admin', 'manager', 'storekeeper']), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({ error: 'Failed to fetch supplier details' });
  }
});

// Get Specific Supplier Performance
router.get('/suppliers/:id/performance', authenticate, authorize(['super_admin', 'manager', 'storekeeper']), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM v_supplier_performance WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      // Return zeroed stats if no performance data exists yet
      return res.json({
        total_orders: 0,
        avg_delivery_days: 0,
        total_received_amount: 0,
        cancelled_orders: 0
      });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching supplier performance:', error);
    res.status(500).json({ error: 'Failed to fetch supplier performance' });
  }
});

// Get Supplier Order History
router.get('/suppliers/:id/orders', authenticate, authorize(['super_admin', 'manager', 'storekeeper']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, po_number, branch, status, total_amount, created_at 
       FROM purchase_orders 
       WHERE supplier_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching supplier orders:', error);
    res.status(500).json({ error: 'Failed to fetch supplier orders' });
  }
});

module.exports = router;
