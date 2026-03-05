const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCreatePO() {
    try {
        console.log('Step 1: Generate PO number...');
        const { data: po_number, error: numberError } = await supabase.rpc('generate_po_number');
        
        if (numberError) {
            console.error('❌ Error generating PO number:', numberError);
            return;
        }
        console.log('✓ PO number generated:', po_number);

        console.log('\nStep 2: Calculate totals...');
        const items = [
            { item_id: 1, quantity: 10, unit_price: 100, vat_rate: 16 }
        ];
        
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const tax_amount = items.reduce((sum, item) => 
            sum + (item.quantity * item.unit_price * ((item.vat_rate || 0) / 100)), 0);
        const total_amount = subtotal + tax_amount;
        
        console.log('Subtotal:', subtotal);
        console.log('Tax:', tax_amount);
        console.log('Total:', total_amount);

        console.log('\nStep 3: Create purchase order...');
        const poData = {
            po_number,
            supplier_id: 1,
            created_by_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
            po_date: new Date().toISOString().split('T')[0],
            expected_delivery_date: '2024-12-31',
            special_instructions: 'Test order',
            subtotal,
            tax_amount,
            total_amount,
            status: 'draft'
        };

        console.log('PO Data:', JSON.stringify(poData, null, 2));

        const { data: newPO, error: poError } = await supabase
            .from('store_purchase_orders')
            .insert(poData)
            .select()
            .single();

        if (poError) {
            console.error('❌ Error creating PO:', poError);
            console.error('Full error:', JSON.stringify(poError, null, 2));
            return;
        }

        console.log('✓ PO created successfully:', newPO);

        console.log('\nStep 4: Insert PO items...');
        const poItems = items.map(item => ({
            po_id: newPO.id,
            item_id: item.item_id,
            quantity_ordered: item.quantity,
            quantity_pending: item.quantity,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price * (1 + (item.vat_rate || 0) / 100),
            tax_amount: (item.quantity * item.unit_price) * ((item.vat_rate || 0) / 100)
        }));

        console.log('PO Items:', JSON.stringify(poItems, null, 2));

        const { error: itemsError } = await supabase
            .from('store_po_items')
            .insert(poItems);

        if (itemsError) {
            console.error('❌ Error inserting items:', itemsError);
            console.error('Full error:', JSON.stringify(itemsError, null, 2));
            return;
        }

        console.log('✓ Items inserted successfully');
        console.log('\n✅ COMPLETE SUCCESS! PO created with ID:', newPO.id);

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

testCreatePO();
