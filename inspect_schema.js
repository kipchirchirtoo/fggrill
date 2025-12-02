const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function inspect() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'room_types';
    `);
    console.log('room_types columns:', res.rows);
    
    const res2 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'rooms';
    `);
    console.log('rooms columns:', res2.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

inspect();
