
const fetch = require('node-fetch');

async function checkDashboard() {
    try {
        console.log('Testing dashboard endpoint...');
        const response = await fetch('http://localhost:5000/api/central-operations/dashboard');
        console.log('Status:', response.status);

        if (response.status === 401) {
            console.log('Success: Got 401 Unauthorized as expected (server is up and reachable)');
        } else if (response.status === 200) {
            const data = await response.json();
            console.log('Success: Got 200 OK');
            console.log('Data:', JSON.stringify(data, null, 2));
        } else {
            console.log('Response:', await response.text());
        }
    } catch (err) {
        console.error('Request failed:', err.message);
    }
}

checkDashboard();
