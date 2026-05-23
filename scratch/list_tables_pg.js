const { Pool } = require('pg');
require('dotenv').config({ path: '/home/allansamuel/Desktop/fggrill/backend/.env' });

const pool = new Pool({
  connectionString: process.env.SUPABASE_PROJECT_URL ? 
    process.env.SUPABASE_PROJECT_URL.replace('https://', 'postgres://postgres:').replace('.supabase.co', ':6543/postgres') : 
    undefined, // We'll just read from backend/.env
});

// Since the supabase url is https://[ref].supabase.co, we can't easily guess the DB password unless it's in the env.
// Let's check backend/src/db.ts to see how it connects.
