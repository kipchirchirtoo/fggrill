
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL is not defined in .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function seedCentralOps() {
    const client = await pool.connect();

    try {
        console.log('🌱 Starting Central Operations Seeding...');
        await client.query('BEGIN');

        // 1. Create Tables if they don't exist
        await client.query(`
      CREATE TABLE IF NOT EXISTS vendor_performance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID, 
        vendor_name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        on_time_delivery_rate DECIMAL(5,2) DEFAULT 0,
        quality_rating DECIMAL(3,2) DEFAULT 0,
        cost_variance DECIMAL(10,2) DEFAULT 0,
        response_time_hours DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS procurement_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number VARCHAR(50) UNIQUE NOT NULL,
        branch_id INTEGER,
        supplier_id UUID,
        order_date DATE NOT NULL DEFAULT CURRENT_DATE,
        expected_delivery_date DATE,
        total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        currency VARCHAR(3) DEFAULT 'KES',
        status VARCHAR(50) DEFAULT 'draft',
        payment_status VARCHAR(50) DEFAULT 'unpaid',
        items JSONB DEFAULT '[]',
        notes TEXT,
        created_by UUID,
        approved_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // 2. Seed Suppliers
        const { rows: existingSuppliers } = await client.query("SELECT * FROM information_schema.tables WHERE table_name = 'suppliers'");
        if (existingSuppliers.length > 0) {
            const { rows: suppliers } = await client.query('SELECT * FROM suppliers LIMIT 1');
            if (suppliers.length === 0) {
                const id = `SUP-2025-001`;
                // Check columns first to avoid errors if schema differs
                const { rows: columns } = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'suppliers'");
                const colNames = columns.map((c: any) => c.column_name);

                if (colNames.includes('contact_person')) {
                    await client.query(`
                    INSERT INTO suppliers (id, name, contact_person, email, phone, category, status, rating)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (id) DO NOTHING
                 `, [id, 'Fresh Farms Ltd', 'John Farmer', 'supply@freshfarms.com', '0700000000', 'Food', 'active', 5]);
                }
            }
        }

        // 3. Seed Vendor Performance
        console.log('Seeding Vendor Performance...');
        await client.query('DELETE FROM vendor_performance');

        const vendors = [
            { name: 'Fresh Farms Ltd', category: 'Food', quality: 4.8, delivery: 98 },
            { name: 'Clean Supplies Co', category: 'Supplies', quality: 4.5, delivery: 95 },
            { name: 'Meat Masters', category: 'Food', quality: 4.9, delivery: 92 },
            { name: 'BevDistributors', category: 'Beverages', quality: 4.2, delivery: 88 },
        ];

        for (const v of vendors) {
            await client.query(`
        INSERT INTO vendor_performance (
          vendor_id, vendor_name, category, period_start, period_end, 
          on_time_delivery_rate, quality_rating, response_time_hours
        ) VALUES (
          $1, $2, $3, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE,
          $4, $5, $6
        )
      `, [uuidv4(), v.name, v.category, v.delivery, v.quality, Math.floor(Math.random() * 24) + 1]);
        }

        // 4. Seed Budgets
        console.log('Seeding Budgets...');
        const { rows: budgetsTable } = await client.query("SELECT * FROM information_schema.tables WHERE table_name = 'budgets'");
        if (budgetsTable.length > 0) {
            const { rows: budgetCount } = await client.query('SELECT COUNT(*) FROM budgets');
            if (parseInt(budgetCount[0].count) === 0) {
                const categories = ['Marketing', 'Operations', 'Maintenance', 'Staffing', 'Inventory'];
                const branches = [1, 2, 3, 4];

                for (const branchId of branches) {
                    for (const cat of categories) {
                        const allocated = Math.floor(Math.random() * 500000) + 100000;
                        const spent = Math.floor(Math.random() * allocated);

                        await client.query(`
                        INSERT INTO budgets (
                            branch_id, fiscal_year, fiscal_month, category, name, 
                            allocated_amount, spent_amount, status, description
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, 'approved', $8
                        )
                    `, [
                            branchId,
                            2025,
                            1,
                            cat,
                            `${cat} Budget Q1`,
                            allocated,
                            spent,
                            `Monthly ${cat} allocation`
                        ]);
                    }
                }
            }
        }

        // 5. Seed Forecasts
        console.log('Skipping Forecasts seeding due to constraint issues...');
        /*
        const { rows: forecastsTable } = await client.query("SELECT * FROM information_schema.tables WHERE table_name = 'forecasts'");
        if (forecastsTable.length > 0) {
            const { rows: forecastCount } = await client.query('SELECT COUNT(*) FROM forecasts');
            if (parseInt(forecastCount[0].count) === 0) {
                const metrics = ['Revenue', 'Footfall', 'Inventory Usage'];

                for (const metric of metrics) {
                    await client.query(`
                    INSERT INTO forecasts (
                        branch_id, forecast_type, metric_name, forecast_date, 
                        forecast_value, confidence_level, model_used, notes
                    ) VALUES (
                        1, 'MONTHLY', $1, CURRENT_DATE + INTERVAL '1 month',
                        $2, 85, 'linear_regression', 'Based on historical trends'
                    )
                `, [metric, Math.floor(Math.random() * 1000000) + 50000]);
                }
            }
        }
        */

        // 6. Seed Procurement Orders
        console.log('Seeding Procurement Orders...');
        await client.query('DELETE FROM procurement_orders');

        await client.query(`
        INSERT INTO procurement_orders (
            order_number, branch_id, total_amount, status, items
        ) VALUES (
            'PO-2025-001', 1, 150000, 'pending_approval', 
            '[{"item": "Tomatoes", "qty": 100, "price": 50}, {"item": "Onions", "qty": 200, "price": 40}]'::jsonb
        )
    `);

        await client.query(`
        INSERT INTO procurement_orders (
            order_number, branch_id, total_amount, status, items
        ) VALUES (
            'PO-2025-002', 2, 75000, 'approved', 
            '[{"item": "Cleaning Supplies", "qty": 50, "price": 1500}]'::jsonb
        )
    `);

        // 7. Seed Stock Requests
        console.log('Seeding Stock Requests...');
        const { rows: requestsTable } = await client.query("SELECT * FROM information_schema.tables WHERE table_name = 'stock_requests'");
        if (requestsTable.length > 0) {
            const { rows: requestCount } = await client.query('SELECT COUNT(*) FROM stock_requests');
            if (parseInt(requestCount[0].count) === 0) {
                const { rows: items } = await client.query('SELECT sku FROM simple_items LIMIT 1');
                const itemSku = items.length > 0 ? items[0].sku : 'ITEM-001';

                // Fetch a valid user ID
                const { rows: users } = await client.query('SELECT id FROM users LIMIT 1');
                const userId = users.length > 0 ? users[0].id : null;

                if (userId) {
                    const { rows: req } = await client.query(`
                    INSERT INTO stock_requests (
                        request_number, requesting_branch_id, request_type, priority, reason, status, requested_by
                    ) VALUES (
                        'REQ-2025-001', 1, 'REPLENISHMENT', 'HIGH', 'Low stock on essentials', 'PENDING', $1
                    ) RETURNING id
                `, [userId]);

                    await client.query(`
                    INSERT INTO stock_request_items (
                        request_id, item_sku, requested_quantity, status
                    ) VALUES (
                        $1, $2, 50, 'PENDING'
                    )
                `, [req[0].id, itemSku]);
                } else {
                    console.warn('⚠️ No users found to assign to stock request. Skipping stock request seeding.');
                }
            }
        }

        await client.query('COMMIT');
        console.log('✅ Central Operations Seeding Completed Successfully!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error seeding Central Operations:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
}

seedCentralOps();
