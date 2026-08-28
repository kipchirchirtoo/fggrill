const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'verify_live_shift_mode.env') });

const supabaseUrl = process.env.SUPABASE_OLD_URL;
const supabaseServiceKey = process.env.SUPABASE_OLD_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('supabase.auth.admin methods:', Object.getOwnPropertyNames(supabase.auth.admin));
console.log('supabase.auth.admin prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(supabase.auth.admin)));
