const http = require('http');
const https = require('https');

const data = JSON.stringify({
    confirmationNumber: 'TEST1234',
    guestName: 'Allan Too',
    email: 'test@famousgatehotels.com',
    checkInDate: '2026-04-01',
    checkOutDate: '2026-04-05',
    roomType: 'Deluxe Room',
    guests: 1,
    totalAmount: 50000
});

const req = https.request('https://services.hirall.com/api/reports/generate/branded-pdf', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
}, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        if (res.statusCode !== 200) {
            console.log('Body:', body.substring(0, 500));
        } else {
            console.log('Got PDF! Length:', body.length);
        }
    });
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
