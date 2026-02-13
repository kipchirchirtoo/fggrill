const jwt = require('jsonwebtoken');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const API_URL = 'http://127.0.0.1:5000/api';
const USER_ID = '00286463-c34a-47f6-ab5b-7ca0f6146cca';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Generate token
const token = jwt.sign(
    {
        sub: USER_ID,
        id: USER_ID,
        role: 'cashier',
        branch_id: 2,
        email: 'test@example.com', // Dummy email
        aud: 'authenticated'
    },
    JWT_SECRET,
    { expiresIn: '24h' }
);

const config = {
    headers: { Authorization: `Bearer ${token}` }
};

async function testCloseShift() {
    try {
        console.log('1. Checking for open shift...');
        let shiftId;

        try {
            const shiftsRes = await axios.get(`${API_URL}/cashier/shifts?status=open&cashier_id=${USER_ID}`, config);
            if (shiftsRes.data.data.length > 0) {
                shiftId = shiftsRes.data.data[0].id;
                console.log('Found open shift:', shiftId);
            }
        } catch (e) {
            console.log('Error fetching shifts:', e.message);
        }

        if (!shiftId) {
            console.log('2. Starting new shift...');
            try {
                const startRes = await axios.post(`${API_URL}/cashier/shifts/start`, {
                    opening_float: 1000,
                    notes: 'Test shift'
                }, config);
                shiftId = startRes.data.data.id;
                console.log('Started shift:', shiftId);
            } catch (e) {
                console.error('Failed to start shift:');
                if (e.response) {
                    console.error('Status:', e.response.status);
                    console.error('Data:', JSON.stringify(e.response.data, null, 2));
                } else {
                    console.error('Error Code:', e.code);
                    console.error('Error Message:', e.message);
                }
                return;
            }
        }

        console.log('3. Closing shift with details...');
        const closeData = {
            closing_float: 5000,

            // Required fields usually calculated by frontend
            swimming_pool_revenue: 0,
            pool_token_revenue: 0,
            conference_revenue: 0,
            room_booking_revenue: 0,
            restaurant_revenue: 0,
            bar_revenue: 0,
            other_revenue: 0,

            cash_at_hand: 5000,
            credit_bills_taken: 500,
            credit_bills_count: 1,
            credit_bills_details: [
                { id: '1', staff_id: 'some-staff-id', name: 'John Doe', amount: 500, timestamp: new Date().toISOString() }
            ],
            paid_bills_value: 300,
            paid_bills_count: 1,
            paid_bills_details: [
                { id: '2', name: 'Jane Smith', amount: 300, timestamp: new Date().toISOString() }
            ],
            notes: 'Closing with test script'
        };

        const closeRes = await axios.put(`${API_URL}/cashier/shifts/${shiftId}/close`, closeData, config);

        console.log('Close Response Status:', closeRes.status);
        // console.log('Data:', JSON.stringify(closeRes.data.data, null, 2));

        const updatedShift = closeRes.data.data;

        if (updatedShift.credit_bills_details && updatedShift.credit_bills_details.length > 0) {
            console.log('SUCCESS: Credit bills details saved.');
            console.log('Details:', JSON.stringify(updatedShift.credit_bills_details));
        } else {
            console.log('FAILURE: Credit bills details NOT saved.');
        }

        if (updatedShift.paid_bills_details && updatedShift.paid_bills_details.length > 0) {
            console.log('SUCCESS: Paid bills details saved.');
            console.log('Details:', JSON.stringify(updatedShift.paid_bills_details));
        } else {
            console.log('FAILURE: Paid bills details NOT saved.');
        }

    } catch (err) {
        console.error('Test failed:');
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', JSON.stringify(err.response.data, null, 2));
        } else {
            console.error('Error Code:', err.code);
            console.error('Error Message:', err.message);
        }
    }
}

testCloseShift();
