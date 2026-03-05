async function testPOCreation() {
    try {
        // Get token from login
        const loginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'superadmin@famousgate.com',
                password: 'superadmin123'
            })
        });

        const loginData = await loginRes.json();
        console.log('Login response:', loginData);

        if (!loginData.token) {
            console.error('No token received');
            return;
        }

        const token = loginData.token;

        // Get a supplier UUID
        const suppliersRes = await fetch('http://localhost:5000/api/store/suppliers', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const suppliersData = await suppliersRes.json();
        console.log('\nSuppliers:', suppliersData.data?.slice(0, 2));

        const supplier_id = suppliersData.data?.[0]?.id;
        if (!supplier_id) {
            console.error('No suppliers found');
            return;
        }

        // Get an item UUID
        const itemsRes = await fetch('http://localhost:5000/api/store/items', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const itemsData = await itemsRes.json();
        console.log('\nItems:', itemsData.data?.slice(0, 2));

        const item_id = itemsData.data?.[0]?.id;
        if (!item_id) {
            console.error('No items found');
            return;
        }

        // Create PO
        const payload = {
            supplier_id: supplier_id,
            expected_delivery_date: '2024-12-31',
            special_instructions: 'Test order',
            items: [{
                item_id: item_id,
                quantity: 10,
                unit_price: 100,
                vat_rate: 16
            }]
        };

        console.log('\n=== CREATING PURCHASE ORDER ===');
        console.log('Payload:', JSON.stringify(payload, null, 2));

        const response = await fetch('http://localhost:5000/api/procurement/purchase-orders', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        console.log('\nResponse status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        const responseText = await response.text();
        console.log('\nResponse body:', responseText);

        if (response.ok) {
            console.log('\n✅ SUCCESS - Purchase order created');
        } else {
            console.log('\n❌ FAILED - Check backend terminal for error details');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testPOCreation();
