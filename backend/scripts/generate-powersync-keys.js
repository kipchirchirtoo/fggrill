/**
 * Generate an RSA key pair for PowerSync RS256/JWKS auth.
 *
 * Run: node scripts/generate-powersync-keys.js
 *
 * Outputs:
 *   - backend/powersync/private.pem
 *   - backend/powersync/public.pem
 *
 * Then add to backend/.env:
 *   POWERSYNC_PRIVATE_KEY_PATH=./powersync/private.pem
 *   POWERSYNC_PUBLIC_KEY_PATH=./powersync/public.pem
 *   POWERSYNC_KEY_ID=powersync-key-1
 *
 * Configure your PowerSync Cloud instance with the JWKS URI:
 *   https://<your-backend>/.well-known/jwks.json
 * or the inline public key.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const powersyncDir = path.resolve(__dirname, '..', 'powersync');
if (!fs.existsSync(powersyncDir)) {
  fs.mkdirSync(powersyncDir, { recursive: true });
}

const privateKeyPath = path.join(powersyncDir, 'private.pem');
const publicKeyPath = path.join(powersyncDir, 'public.pem');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

fs.writeFileSync(privateKeyPath, privateKey);
fs.writeFileSync(publicKeyPath, publicKey);

console.log('PowerSync RSA key pair generated:');
console.log(`  Private key: ${privateKeyPath}`);
console.log(`  Public key:  ${publicKeyPath}`);
console.log('');
console.log('Add these to backend/.env and keep the private key secret.');
