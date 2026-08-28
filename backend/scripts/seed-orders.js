const { Client } = require('pg');
require('dotenv').config();

async function seedOrders() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🌱 Seeding requisitions and purchase orders...');

    // Get first user (the logged-in admin)
    const user = await client.query(`SELECT id FROM users ORDER BY created_at LIMIT 1`);
    if (!user.rows.length) {
      console.log('❌ No users found! Please register/login first.');
      return;
    }
    const userId = user.rows[0].id;
    console.log(`✅ Using user: ${userId}`);

    // Get suppliers and items
    const suppliers = await client.query(`SELECT id FROM suppliers ORDER BY created_at LIMIT 3`);
    const items = await client.query(`SELECT id FROM inventory_items ORDER BY created_at LIMIT 8`);

    if (!suppliers.rows.length || !items.rows.length) {
      console.log('❌ Run seed.js first to create suppliers and items!');
      return;
    }

    // Create requisitions
    const req = await client.query(`
      INSERT INTO requisitions (requisition_number, department, branch, status, priority, notes, created_by, created_at)
      VALUES 
        ('REQ-202411-0001', 'Housekeeping', 'Bomet', 'pending_approval', 'high', 'Urgent restocking needed', $1, NOW()),
        ('REQ-202411-0002', 'Restaurant', 'Kericho', 'approved', 'medium', 'Weekly supplies', $1, NOW()),
        ('REQ-202411-0003', 'Kitchen', 'Kapsoit', 'draft', 'low', 'Monthly stock', $1, NOW())
      RETURNING id
    `, [userId]);

    // Add items to requisitions
    await client.query(`
      INSERT INTO requisition_items (requisition_id, item_id, quantity)
      VALUES 
        ($1, $4, 50),
        ($1, $5, 20),
        ($2, $6, 100),
        ($2, $7, 30),
        ($3, $8, 15)
    `, [req.rows[0].id, req.rows[1].id, req.rows[2].id, 
        items.rows[2].id, items.rows[3].id, items.rows[0].id, items.rows[6].id, items.rows[4].id]);
    console.log(`✅ Created ${req.rows.length} requisitions`);

    // Create purchase orders
    const po = await client.query(`
      INSERT INTO purchase_orders (
        po_number, supplier_id, branch, status, total_amount, 
        subtotal, tax_rate, tax_amount, notes, created_by, created_at
      )
      VALUES 
        ('PO-202411-0001', $1, 'Bomet', 'approved', 52200, 45000, 16, 7200, 'Monthly food supplies', $4, NOW()),
        ('PO-202411-0002', $2, 'Kericho', 'pending', 32480, 28000, 16, 4480, 'Housekeeping stock', $4, NOW()),
        ('PO-202411-0003', $3, 'Kapsoit', 'draft', 17400, 15000, 16, 2400, 'Cleaning supplies', $4, NOW())
      RETURNING id
    `, [suppliers.rows[0].id, suppliers.rows[1].id, suppliers.rows[2].id, userId]);

    // Add items to POs
    await client.query(`
      INSERT INTO purchase_order_items (po_id, item_id, quantity, unit_price, total_price)
      VALUES 
        ($1, $4, 100, 250, 25000),
        ($1, $5, 25, 800, 20000),
        ($2, $6, 200, 50, 10000),
        ($2, $7, 50, 350, 17500),
        ($3, $8, 10, 1200, 12000)
    `, [po.rows[0].id, po.rows[1].id, po.rows[2].id,
        items.rows[0].id, items.rows[1].id, items.rows[2].id, items.rows[3].id, items.rows[4].id]);
    console.log(`✅ Created ${po.rows.length} purchase orders`);

    console.log('\n✨ Orders seeded successfully!');
    console.log('🚀 Refresh your frontend now!');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

seedOrders();
