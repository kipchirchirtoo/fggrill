require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.SUPABASE_PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Please provide a file path');
    process.exit(1);
  }

  console.log(`Applying migration: ${filePath}...`);
  const sql = fs.readFileSync(filePath, 'utf8');
  
  // Split SQL by semicolon but handle cases where semicolon is inside a function/string
  // For simplicity, we'll try running the whole block or splitting by common patterns
  // But Supabase JS often prefers running blocks
  
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    if (error.message.includes('exec_sql')) {
        console.log('exec_sql function not found, trying fallback...');
        // Fallback: This is tricky with supabase-js as it doesn't have a direct "query" method for arbitrary SQL
        // Usually, the migrate.js uses pg or something similar if it's running locally
    }
    console.error('Error:', error);
  } else {
    console.log('Success!');
  }
}

run();
