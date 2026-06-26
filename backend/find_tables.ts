import { supabase } from './src/config/supabase';
const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const parsedUrl = new URL(process.env.DATABASE_URL.replace(':6543', ':5432'));
  const client = new Client({ connectionString: parsedUrl.toString() });
  await client.connect();
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%kitchen%' OR table_name ILIKE '%food%'");
  console.log(res.rows);
  
  // also let's look at food controls column names if they exist
  const fcCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'kitchen_food_controls' OR table_name = 'food_controls'");
  console.log('Columns:', fcCols.rows);
  
  await client.end();
}

run();
