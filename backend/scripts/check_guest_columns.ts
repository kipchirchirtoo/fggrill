
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking guests table schema...');
  
  // Method 1: Try to select specific columns to see which one works
  const { data: data1, error: error1 } = await supabase
    .from('guests')
    .select('is_vip')
    .limit(1);
    
  if (!error1) {
    console.log('Column "is_vip" EXISTS.');
  } else {
    console.log('Column "is_vip" query error:', error1.message);
  }

  const { data: data2, error: error2 } = await supabase
    .from('guests')
    .select('vip_status')
    .limit(1);
    
  if (!error2) {
    console.log('Column "vip_status" EXISTS.');
  } else {
    console.log('Column "vip_status" query error:', error2.message);
  }
}

checkSchema();
