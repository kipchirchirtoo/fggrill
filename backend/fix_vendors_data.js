const { Client } = require('pg');

async function fixVendors() {
  const client = new Client({
    connectionString: "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    // 1. Assign specified vendors to Branch 1 (Kyong) and set status to active
    const res = await client.query(`
      UPDATE store_suppliers 
      SET branch_id = 1, status = 'active'
      WHERE name IN ('Mahi Meera', 'Shree Ram Investments', 'UDV')
      RETURNING id, name, branch_id, status
    `);

    console.log('Vendors updated successfully:');
    console.table(res.rows);

    // 2. Also fix statuses for other vendors if they are NULL
    const statusFixRes = await client.query(`
      UPDATE store_suppliers 
      SET status = 'active'
      WHERE status IS NULL
    `);
    console.log(`Updated ${statusFixRes.rowCount} other vendors with NULL status.`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

fixVendors();
