const jwt = require('jsonwebtoken');
require('dotenv').config();

const secret = process.env.SUPABASE_JWT_SECRET;
const anonKey = process.env.SUPABASE_ANON_KEY;

console.log('SUPABASE_JWT_SECRET length:', secret ? secret.length : 'MISSING');
console.log('SUPABASE_ANON_KEY present:', !!anonKey);

if (!secret || !anonKey) {
  console.error('❌ Missing env var(s)');
  process.exit(1);
}

// The anon key is itself a JWT Supabase signed with the project's real JWT
// secret. If our configured SUPABASE_JWT_SECRET can verify it, it's correct.
try {
  const decoded = jwt.verify(anonKey, secret);
  console.log('✅ SUPABASE_JWT_SECRET correctly verifies the anon key. Payload:', decoded);
} catch (e) {
  console.error('❌ SUPABASE_JWT_SECRET does NOT verify the anon key:', e.message);
  // Show what the anon key actually decodes to (without verification) for context
  console.log('Anon key payload (unverified):', jwt.decode(anonKey));
}
