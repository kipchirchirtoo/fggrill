const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

async function analyzeAndApproveGRNs() {
    const client = await pool.connect();
    
    try {
        console.log('========================================');
        console.log(' ANALYZING GRNs');
        console.log('========================================\n');

        // Get the two GRNs
        const grnsQuery = await client.query(`
            SELECT 
                g.id,
                g.grn_number,
                g.status,
                g.grn_approved,
                g.supplier_id,
                g.total_quantity,
                g.total_value,
                g.grn_date,
                g.created_at,
                s.name as supplier_name
            FROM store_grn g
            LEFT JOIN store_suppliers s ON s.id = g.supplier_id
            WHERE g.grn_number IN ('GRN2604140001', 'GRN2604140002')
            ORDER BY g.grn_number
        `);

        if (grnsQuery.rows.length === 0) {
            console.log('❌ No GRNs found with those numbers');
            return;
        }

        console.log(`Found ${grnsQuery.rows.length} GRNs:\n`);

        for (const grn of grnsQuery.rows) {
            console.log(`📦 ${grn.grn_number}`);
            console.log(`   Status: ${grn.status}`);
            console.log(`   Approved: ${grn.grn_approved ? 'Yes' : 'No'}`);
            console.log(`   Supplier: ${grn.supplier_name || 'Unknown'}`);
            console.log(`   Total Quantity: ${grn.total_quantity || 0}`);
            console.log(`   Total Value: KES ${grn.total_value || 0}`);
            console.log(`   Date: ${grn.grn_date}`);

            // Get items for this GRN
            const itemsQuery = await client.query(`
                SELECT 
                    gi.id,
                    gi.item_id,
                    gi.quantity_received,
                    gi.quantity_accepted,
                    gi.unit_price,
                    si.item_name,
                    si.quantity as current_stock
                FROM store_grn_items gi
                LEFT JOIN simple_items si ON si.sku = gi.item_id
                WHERE gi.grn_id = $1
            `, [grn.id]);

            console.log(`   Items (${itemsQuery.rows.length}):`);
            for (const item of itemsQuery.rows) {
                console.log(`      - ${item.item_name || item.item_id}`);
                console.log(`        Received: ${item.quantity_received}, Accepted: ${item.quantity_accepted || item.quantity_received}`);
                console.log(`        Unit Price: KES ${item.unit_price || 0}`);
                console.log(`        Current Stock: ${item.current_stock || 0}`);
            }
            console.log('');
        }

        console.log('========================================');
        console.log(' APPROVING GRNs');
        console.log('========================================\n');

        // Get a user ID for approval (use the creator or first admin)
        const userQuery = await client.query(`
            SELECT id FROM users 
            WHERE role IN ('super_admin', 'central_storekeeper', 'general_manager')
            LIMIT 1
        `);

        if (userQuery.rows.length === 0) {
            console.log('❌ No admin user found for approval');
            return;
        }

        const approverId = userQuery.rows[0].id;

        // Approve each GRN
        for (const grn of grnsQuery.rows) {
            if (grn.grn_approved) {
                console.log(`⏭️  ${grn.grn_number} - Already approved, skipping`);
                continue;
            }

            console.log(`🔄 Approving ${grn.grn_number}...`);

            try {
                // Call the approval function with explicit UUID casting
                const result = await client.query(`
                    SELECT approve_grn_and_update_all($1::uuid, $2::uuid) as result
                `, [grn.id, approverId]);

                console.log(`✅ ${grn.grn_number} - Approved successfully!`);

                // Show updated stock
                const itemsQuery = await client.query(`
                    SELECT 
                        gi.item_id,
                        si.item_name,
                        si.quantity as new_stock
                    FROM store_grn_items gi
                    LEFT JOIN simple_items si ON si.sku = gi.item_id
                    WHERE gi.grn_id = $1
                `, [grn.id]);

                console.log(`   Updated Stock:`);
                for (const item of itemsQuery.rows) {
                    console.log(`      - ${item.item_name || item.item_id}: ${item.new_stock || 0} units`);
                }
                console.log('');

            } catch (error) {
                console.error(`❌ ${grn.grn_number} - Approval failed:`, error.message);
            }
        }

        console.log('========================================');
        console.log(' SUMMARY');
        console.log('========================================\n');
        console.log('✅ GRNs have been analyzed and approved');
        console.log('✅ Stock quantities have been updated in simple_items table');
        console.log('✅ You can now dispatch these items to branches\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

analyzeAndApproveGRNs();
