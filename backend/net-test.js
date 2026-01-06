const https = require('https');
https.get('https://google.com', (res) => {
    console.log('Status Code:', res.statusCode);
    process.exit(0);
}).on('error', (e) => {
    console.error(e);
    process.exit(1);
});
