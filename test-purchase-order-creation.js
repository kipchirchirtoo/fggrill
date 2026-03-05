async function testPurchaseOrderCreation() {
    try {
        // First login to get token
        const loginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@famousgate.com',
                password: 'admin123'
            })
        });

        const loginData = await loginRes.json();
        console.log('Login response:', loginData);

        if (!loginData.token) {
            console.error('No token received');
            return;
        }

        const token = loginData.token;

        // Try to create a purchase order
        const poData = {
            supplier_id: 1,
            expected_delivery_date: '2024-12-31',
            special_instructions: 'Test order',
            items: [
                {
                    item_id: 1,
                    quantity: 10,
                    unit_price: 100,
                    vat_rate: 16
                }
            ]
        };

        console.log('\nSending PO data:', JSON.stringify(poData, null, 2));

        const poRes = await fetch('http://localhost:5000/api/procurement/purchase-orders', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(poData)
        });

        console.log('\nResponse status:', poRes.status);
        console.log('Response headers:', Object.fromEntries(poRes.headers.entries()));

        const responseText = await poRes.text();
        console.log('\nResponse body:', responseText);

        try {
            const responseJson = JSON.parse(responseText);
            console.log('\nParsed response:', JSON.stringify(responseJson, null, 2));
        } catch (e) {
            console.log('Could not parse as JSON');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testPurchaseOrderCreation();
