const { Client } = require('pg');
require('dotenv').config();

async function seedDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('🌱 Starting database seed...');

    // 1. Create sample suppliers
    console.log('Creating suppliers...');
    const suppliers = await client.query(`
      INSERT INTO suppliers (name, contact_person, email, phone, address, payment_terms, credit_limit, tax_id, status)
      VALUES 
        ('Fresh Foods Ltd', 'John Kamau', 'john@freshfoods.ke', '+254700123456', 'Nairobi, Kenya', 'net_30', 500000, 'P051234567A', 'active'),
        ('Quality Supplies Co', 'Mary Wanjiru', 'mary@qualitysupplies.ke', '+254700234567', 'Mombasa, Kenya', 'net_15', 300000, 'P051234568B', 'active'),
        ('Hotel Essentials', 'Peter Odhiambo', 'peter@essentials.ke', '+254700345678', 'Kisumu, Kenya', 'immediate', 200000, 'P051234569C', 'active')
      RETURNING id
    `);
    console.log(`✅ Created ${suppliers.rows.length} suppliers`);

    // 2. Create sample inventory items
    console.log('Creating inventory items...');
    const items = await client.query(`
      INSERT INTO inventory_items (
        name, description, category, subcategory, unit, minimum_stock, 
        maximum_stock, reorder_point, unit_cost, supplier_id, is_active
      )
      VALUES 
        ('Rice - Basmati', 'Premium Basmati Rice 5kg', 'Food & Beverage', 'Kitchen Supplies', 'kg', 50, 500, 100, 250, ${suppliers.rows[0].id}, true),
        ('Cooking Oil', 'Refined Vegetable Oil 5L', 'Food & Beverage', 'Kitchen Supplies', 'litres', 20, 200, 50, 800, ${suppliers.rows[0].id}, true),
        ('Toilet Paper', 'Premium 2-ply Toilet Tissue', 'Housekeeping', 'Guest Amenities', 'rolls', 100, 1000, 200, 50, ${suppliers.rows[1].id}, true),
        ('Bath Towels', 'White Cotton Bath Towels', 'Housekeeping', 'Towels & Robes', 'pieces', 50, 300, 80, 350, ${suppliers.rows[1].id}, true),
        ('Laundry Detergent', 'Industrial Strength 5L', 'Housekeeping', 'Cleaning Supplies', 'litres', 10, 100, 20, 1200, ${suppliers.rows[2].id}, true),
        ('Hand Soap', 'Antibacterial Liquid Soap', 'Housekeeping', 'Guest Amenities', 'bottles', 30, 200, 60, 150, ${suppliers.rows[2].id}, true),
        ('Orange Juice', 'Fresh Orange Juice 1L', 'Food & Beverage', 'Bar Stock-Non-alcoholic', 'litres', 20, 150, 40, 180, ${suppliers.rows[0].id}, true),
        ('Coffee Beans', 'Arabica Coffee Beans 1kg', 'Food & Beverage', 'Restaurant Items', 'kg', 10, 80, 20, 1500, ${suppliers.rows[0].id}, true)
      RETURNING id
    `);
    console.log(`✅ Created ${items.rows.length} inventory items`);

    // 3. Add stock to branches
    console.log('Adding branch inventory...');
    for (const item of items.rows) {
      await client.query(`
        INSERT INTO branch_inventory (branch, item_id, quantity)
        VALUES 
          ('Bomet', $1, ${Math.floor(Math.random() * 100) + 50}),
          ('Kericho', $1, ${Math.floor(Math.random() * 80) + 30}),
          ('Kapsoit', $1, ${Math.floor(Math.random() * 60) + 20})
      `, [item.id]);
    }
    console.log('✅ Added branch inventory');

    // 4. Create a sample user if needed (for requisitions/POs)
    let userId;
    const userCheck = await client.query(`SELECT id FROM users LIMIT 1`);
    if (userCheck.rows.length > 0) {
      userId = userCheck.rows[0].id;
      console.log(`✅ Using existing user: ${userId}`);
    } else {
      console.log('⚠️  No users found. Please create a user first to see requisitions/POs.');
    }

    // 5. Create sample requisitions (if user exists)
    if (userId) {
      console.log('Creating requisitions...');
      const req = await client.query(`
        INSERT INTO requisitions (requisition_number, department, branch, status, priority, notes, created_by)
        VALUES 
          ('REQ-202411-0001', 'Housekeeping', 'Bomet', 'pending_approval', 'high', 'Urgent restocking needed', $1),
          ('REQ-202411-0002', 'Restaurant', 'Kericho', 'approved', 'medium', 'Weekly supplies', $1),
          ('REQ-202411-0003', 'Administration', 'Kapsoit', 'draft', 'low', 'Office supplies', $1)
        RETURNING id
      `, [userId]);
      
      // Add items to requisitions
      await client.query(`
        INSERT INTO requisition_items (requisition_id, item_id, quantity)
        VALUES 
          ($1, ${items.rows[2].id}, 50),
          ($1, ${items.rows[3].id}, 20),
          ($2, ${items.rows[0].id}, 100),
          ($2, ${items.rows[6].id}, 30)
      `, [req.rows[0].id, req.rows[1].id]);
      console.log(`✅ Created ${req.rows.length} requisitions`);

      // 6. Create sample purchase orders
      console.log('Creating purchase orders...');
      const po = await client.query(`
        INSERT INTO purchase_orders (po_number, supplier_id, branch, status, total_amount, notes, created_by)
        VALUES 
          ('PO-202411-0001', ${suppliers.rows[0].id}, 'Bomet', 'approved', 45000, 'Monthly food supplies', $1),
          ('PO-202411-0002', ${suppliers.rows[1].id}, 'Kericho', 'draft', 28000, 'Housekeeping stock', $1),
          ('PO-202411-0003', ${suppliers.rows[2].id}, 'Kapsoit', 'pending', 15000, 'Cleaning supplies', $1)
        RETURNING id
      `, [userId]);

      // Add items to POs
      await client.query(`
        INSERT INTO purchase_order_items (po_id, item_id, quantity, unit_price, total_price)
        VALUES 
          ($1, ${items.rows[0].id}, 100, 250, 25000),
          ($1, ${items.rows[1].id}, 25, 800, 20000),
          ($2, ${items.rows[2].id}, 200, 50, 10000),
          ($2, ${items.rows[3].id}, 50, 350, 17500)
      `, [po.rows[0].id, po.rows[1].id]);
      console.log(`✅ Created ${po.rows.length} purchase orders`);
    }

    console.log('\n✨ Database seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - ${suppliers.rows.length} Suppliers`);
    console.log(`   - ${items.rows.length} Inventory Items`);
    console.log(`   - Stock added to 3 branches`);
    if (userId) {
      console.log(`   - 3 Requisitions`);
      console.log(`   - 3 Purchase Orders`);
    }
    console.log('\n🚀 Refresh your frontend to see the data!');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

seedDatabase();
