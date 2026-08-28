const fs = require('fs');
console.log('Reading .env...');
const envContent = fs.readFileSync('.env', 'utf8');
console.log('Read', envContent.length, 'chars');
const oldUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL_OLD='));
console.log('oldUrl line found:', !!oldUrl);
if (oldUrl) {
  const url = oldUrl.substring('DATABASE_URL_OLD='.length).trim();
  console.log('URL starts with:', url.substring(0, 20));
}
