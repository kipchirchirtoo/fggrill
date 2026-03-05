require('dotenv').config();

async function testPOCreation() {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    
    // First, login to get a token
    console.log('Logging in...');
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            pin: '1234', // Use a valid branch accountant PIN
            role: 'branch_accountant'
        })
    });
    
    const loginData = await loginRes.json();
    console.log('Login response:', loginData);
    
    if (!loginData.success) {
        console.error('Login failed');
        return;
    }
    
    const token = loginData.token;
    
    // Get suppliers and items first
    console.log('\nFetching suppliers...');
    const suppliersRes = await fetch(`${API_URL}/api/store/suppliers`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const suppliersData = await suppliersRes.json();
    console.log('Suppliers:', suppliersData);
    
    console.log('\nFetching items...');
    const itemsRes = await fetch(`${API_URL}/api/store/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const itemsData = await itemsRes.json();
    console.log('Items:', itemsData);
    
    if (!suppliersData.data || suppliersData.data.length === 0) {
        console.error('No suppliers found');
        return;
    }
    
    if (!itemsData.data || itemsData.data.length === 0) {
        console.error('No items found');
        return;
    }
    
    const supplier = suppliersData.data[0];
    const item = itemsData.data[0];
    
    // Now try to create a PO
    console.log('\nCreating purchase order...');
    const payload = {
        supplier_id: supplier.id,
        expected_delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        special_instructions: 'Test PO from diagnostic script',
        items: [{
            item_id: item.id,
            quantity: 10,
            unit_price: 100,
            vat_rate: 16
        }]
    };
    
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    const poRes = await fetch(`${API_URL}/api/procurement/purchase-orders`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    
    console.log('\nResponse status:', poRes.status);
    console.log('Response headers:', Object.fromEntries(poRes.headers.entries()));
    
    const poData = await poRes.json();
    console.log('Response body:', JSON.stringify(poData, null, 2));
}

testPOCreation().catch(console.error);
