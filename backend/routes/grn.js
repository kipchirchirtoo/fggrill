const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// Create Goods Received Note (Process Receiving)
router.post('/', authenticate, authorize(['super_admin', 'manager', 'storekeeper']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { po_id, supplier_invoice_number, delivery_note_number, notes, items } = req.body;
    
    // 1. Generate GRN Number
    const grnNumResult = await client.query('SELECT generate_grn_number()');
    const grnNumber = grnNumResult.rows[0].generate_grn_number;

    // 2. Create GRN Record
    const grnResult = await client.query(
      `INSERT INTO goods_received_notes 
       (grn_number, po_id, supplier_invoice_number, delivery_note_number, notes, received_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [grnNumber, po_id, supplier_invoice_number, delivery_note_number, notes, req.user.id]
    );
    const grnId = grnResult.rows[0].id;

    // 3. Process Items
    for (const item of items) {
      const { 
        po_item_id, item_id, quantity_ordered, quantity_received, 
        quantity_rejected, rejection_reason, batch_number, 
        expiry_date, manufacturing_date, unit_price 
      } = item;

      // Calculate totals
      const acceptedQty = quantity_received - (quantity_rejected || 0);
      const totalPrice = acceptedQty * unit_price;

      // Insert GRN Item
      await client.query(
        `INSERT INTO grn_items 
         (grn_id, po_item_id, item_id, quantity_ordered, quantity_received, 
          quantity_rejected, rejection_reason, batch_number, expiry_date, 
          manufacturing_date, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [grnId, po_item_id, item_id, quantity_ordered, quantity_received, 
         quantity_rejected || 0, rejection_reason, batch_number, expiry_date, 
         manufacturing_date, unit_price, totalPrice]
      );

      // Update PO Item received quantity
      await client.query(
        `UPDATE purchase_order_items 
         SET received_quantity = COALESCE(received_quantity, 0) + $1 
         WHERE id = $2`,
        [acceptedQty, po_item_id]
      );

      // Update Stock (Branch Inventory)
      const poRes = await client.query('SELECT branch FROM purchase_orders WHERE id = $1', [po_id]);
      const branch = poRes.rows[0].branch;

      // Upsert into branch_inventory
      await client.query(
        `INSERT INTO branch_inventory (branch, item_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (branch, item_id) 
         DO UPDATE SET quantity = branch_inventory.quantity + $3, updated_at = NOW()`,
        [branch, item_id, acceptedQty]
      );

      // Create Batch if applicable
      if (batch_number && acceptedQty > 0) {
        await client.query(
          `INSERT INTO inventory_batches 
           (item_id, branch, batch_number, quantity, expiry_date, manufacturing_date, cost_price, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [item_id, branch, batch_number, acceptedQty, expiry_date, manufacturing_date, unit_price, req.user.id]
        );
      }
    }

    // 4. Check if PO is fully received
    const poStatusRes = await client.query(
      `SELECT 
         COUNT(*) as total_items,
         SUM(CASE WHEN received_quantity >= quantity THEN 1 ELSE 0 END) as fully_received_items
       FROM purchase_order_items
       WHERE po_id = $1`,
      [po_id]
    );

    const { total_items, fully_received_items } = poStatusRes.rows[0];
    const newStatus = (total_items == fully_received_items) ? 'received' : 'partially_received';

    await client.query(
      `UPDATE purchase_orders SET status = $1, received_at = NOW() WHERE id = $2`,
      [newStatus, po_id]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'GRN created successfully', id: grnId, grn_number: grnNumber });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating GRN:', error);
    res.status(500).json({ error: 'Failed to create GRN' });
  } finally {
    client.release();
  }
});

// Get GRN Details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const grnRes = await pool.query(
      `SELECT grn.*, po.po_number, s.name as supplier_name, u.email as received_by_email
       FROM goods_received_notes grn
       JOIN purchase_orders po ON grn.po_id = po.id
       JOIN suppliers s ON po.supplier_id = s.id
       JOIN users u ON grn.received_by = u.id
       WHERE grn.id = $1`,
      [req.params.id]
    );

    if (grnRes.rows.length === 0) return res.status(404).json({ error: 'GRN not found' });

    const itemsRes = await pool.query(
      `SELECT gi.*, i.name as item_name, i.item_code, i.unit
       FROM grn_items gi
       JOIN inventory_items i ON gi.item_id = i.id
       WHERE gi.grn_id = $1`,
      [req.params.id]
    );

    const grn = grnRes.rows[0];
    grn.items = itemsRes.rows;
    res.json(grn);

  } catch (error) {
    console.error('Error fetching GRN:', error);
    res.status(500).json({ error: 'Failed to fetch GRN' });
  }
});

module.exports = router;
