
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://utsvlihpudfraxzcmtle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedData() {
    console.log('--- Starting Data Seeding ---');

    // 1. Get a valid Branch
    const { data: branches, error: branchError } = await supabase
        .from('branches')
        .select('id')
        .limit(1);

    if (branchError || !branches || branches.length === 0) {
        console.error('Error fetching branches or no branches found:', branchError);
        return;
    }
    const branchId = branches[0].id;
    console.log(`Using Branch ID: ${branchId}`);

    // 2. Get valid Store Items
    const { data: items, error: itemError } = await supabase
        .from('store_items')
        .select('id, name')
        .limit(5);

    if (itemError || !items || items.length === 0) {
        console.error('Error fetching store items:', itemError);
    }
    const itemIds = items ? items.map(i => i.id) : [];
    console.log(`Found ${itemIds.length} store items.`);

    // 3. Seed Restaurant Orders
    const orders = [];
    for (let i = 0; i < 5; i++) {
        orders.push({
            branch_id: branchId,
            total_amount: Math.floor(Math.random() * 5000) + 500,
            status: 'completed',
            created_at: new Date().toISOString() // Today
        });
    }
    const { error: orderError } = await supabase.from('restaurant_orders').insert(orders);
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    if (orderError) console.error('Error seeding restaurant_orders:', orderError.message);
    else console.log('Seeded 5 restaurant_orders.');

    // 4. Seed Audit Logs
    const logs = [];
    const actions = ['DELETE_ORDER', 'VOID_ITEM', 'OVERRIDE_PRICE', 'MANUAL_DISCOUNT'];
    for (let i = 0; i < 5; i++) {
        logs.push({
            action: actions[Math.floor(Math.random() * actions.length)],
            entity_type: 'restaurant_orders',
            entity_id: 'fake-uuid-123', // Placeholder
            branch_id: branchId,
            details: { reason: 'Test audit log' },
            action_timestamp: new Date().toISOString() // Note: check field name (created_at vs action_timestamp)
        });
    }
    // Check if table uses created_at or action_timestamp. Assuming action_timestamp based on previous controller files.
    // Actually, let's try action_timestamp first.
    const { error: logError } = await supabase.from('audit_logs').insert(logs);
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    if (logError) {
        console.error('Error seeding audit_logs (trying created_at instead):', logError.message);
        // Fallback if needed, but 'store_procurement_audit_logs' used action_timestamp. 
        // 'audit_logs' might use created_at.
    } else {
        console.log('Seeded 5 audit_logs.');
    }

    // 5. Seed Store Stock Movements
    if (itemIds.length > 0) {
        const movements = [];
        for (let i = 0; i < 5; i++) {
            movements.push({
                item_id: itemIds[0], // Use first item
                branch_id: branchId,
                quantity: Math.floor(Math.random() * 10) + 1,
                movement_type: 'USAGE',
                created_at: new Date().toISOString()
            });
        }
        const { error: moveError } = await supabase.from('store_stock_movements').insert(movements);
        if (error) {
          console.error('Database error:', error);
          throw error;
        }
        if (moveError) console.error('Error seeding store_stock_movements:', moveError.message);
        else console.log('Seeded 5 store_stock_movements.');
    }

    // 6. Seed Store Inventory (if possible)
    if (itemIds.length > 0) {
        console.log('Attempting to seed store_inventory...');
        // store_inventory might be a view. If so, we need to insert into movements or grn logic to affect it.
        // Or it might be a real table.
        const inventory = [{
            item_id: itemIds[0],
            branch_id: branchId,
            quantity: 100,
            last_updated: new Date().toISOString()
        }];
        const { error: invError } = await supabase.from('store_inventory').insert(inventory);
        if (error) {
          console.error('Database error:', error);
          throw error;
        }
        if (invError) console.error('Error seeding store_inventory (likely a view or restricted):', invError.message);
        else console.log('Seeded 1 store_inventory record.');
    }

    console.log('--- Data Seeding Complete ---');
}

seedData();
