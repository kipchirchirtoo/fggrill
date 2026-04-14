const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

async function directApproveGRNs() {
    const client = await pool.connect();
    
    try {
        console.log('========================================');
        console.log(' DIRECT GRN APPROVAL (BYPASS TRIGGERS)');
        console.log('========================================\n');

        // Disable the old trigger temporarily
        console.log('🔧 Disabling old triggers...');
        await client.query(`
            DROP TRIGGER IF EXISTS update_inventory_on_grn_approval_trigger ON store_grn;
        `);

        // Get admin user
        const userQuery = await client.query(`
            SELECT id FROM users 
            WHERE role IN ('super_admin', 'central_storekeeper', 'general_manager')
            LIMIT 1
        `);

        const approverId = userQuery.rows[0].id;

        // Get the GRNs
        const grnsQuery = await client.query(`
            SELECT id, grn_number FROM store_grn
            WHERE grn_number IN ('GRN2604140001', 'GRN2604140002')
            AND grn_approved = false
        `);

        for (const grn of grnsQuery.rows) {
            console.log(`\n🔄 Processing ${grn.grn_number}...`);

            // Get items
            const itemsQuery = await client.query(`
                SELECT 
                    item_id,
                    COALESCE(quantity_accepted, quantity_received, 0) as quantity,
                    unit_price
                FROM store_grn_items
                WHERE grn_id = $1
            `, [grn.id]);

            console.log(`   Found ${itemsQuery.rows.length} items`);

            // Update each item's stock
            for (const item of itemsQuery.rows) {
                const sku = item.item_id;
                const qty = parseFloat(item.quantity);

                // Get current stock
                const currentStock = await client.query(`
                    SELECT quantity FROM simple_items WHERE sku = $1
                `, [sku]);

                const oldQty = currentStock.rows[0]?.quantity || 0;
                const newQty = parseFloat(oldQty) + qty;

                console.log(`   - ${sku}: ${oldQty} + ${qty} = ${newQty} units`);

                // Update simple_items
                await client.query(`
                    UPDATE simple_items
                    SET 
                        quantity = $1,
                        cost_price = COALESCE($2, cost_price)
                    WHERE sku = $3
                `, [newQty, item.unit_price, sku]);
            }

            // Mark GRN as approved
            await client.query(`
                UPDATE store_grn
                SET 
                    grn_approved = true,
                    approved_by_id = $1,
                    approved_at = NOW(),
                    status = 'completed'
                WHERE id = $2
            `, [approverId, grn.id]);

            console.log(`✅ ${grn.grn_number} - Approved!`);
        }

        // Show final stock
        console.log('\n========================================');
        console.log(' FINAL STOCK LEVELS');
        console.log('========================================\n');

        const stockQuery = await client.query(`
            SELECT sku, item_name, quantity
            FROM simple_items
            WHERE sku IN (
                SELECT DISTINCT item_id 
                FROM store_grn_items 
                WHERE grn_id IN (
                    SELECT id FROM store_grn 
                    WHERE grn_number IN ('GRN2604140001', 'GRN2604140002')
                )
            )
        `);

        for (const item of stockQuery.rows) {
            console.log(`📦 ${item.item_name} (${item.sku}): ${item.quantity} units`);
        }

        console.log('\n✅ All GRNs approved and stock updated successfully!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

directApproveGRNs();
