const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const file = '20260626_kitchen_pos_consumption_and_alerts.sql';
const filePath = path.join(__dirname, '../database/migrations', file);
const sql = fs.readFileSync(filePath, 'utf8');

async function run() {
  console.log(`Running migration: ${file}`);
  
  // Try parameter name p_sql
  console.log('Trying with p_sql...');
  let res = await supabase.rpc('exec_sql', { p_sql: sql });
  console.log('p_sql result:', res.data, res.error);
}

run();
