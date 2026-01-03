
const fetch = require('node-fetch');

async function checkBranches() {
    try {
        console.log('Testing branches endpoint...');
        // We need a token for this endpoint as it is protected
        // But for now let's just see if it returns 401 (which means route exists) or 404
        const response = await fetch('http://localhost:5000/api/system/branches');
        console.log('Status:', response.status);

        if (response.status === 401) {
            console.log('Success: Got 401 Unauthorized (route exists)');
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

checkBranches();
