const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrationAndDebug() {
  const client = new Client({
    connectionString: "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    // 1. Run the migration
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '64_branch_store_suppliers.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Applying migration...');
    await client.query(migrationSql);
    console.log('Migration applied successfully.');

    // 2. Debug suppliers
    console.log('\n--- Current store_suppliers content ---');
    const res = await client.query(`
      SELECT s.id, s.name, s.supplier_code, s.branch_id, b.name as branch_name, s.created_by_id, u.first_name, u.last_name, s.status 
      FROM store_suppliers s
      LEFT JOIN branches b ON s.branch_id = b.id
      LEFT JOIN users u ON s.created_by_id = u.id
      ORDER BY s.name
    `);
    
    if (res.rows.length === 0) {
      console.log('No suppliers found.');
    } else {
      console.table(res.rows.map(r => ({
        ID: r.id.substring(0, 8) + '...',
        Name: r.name,
        Code: r.supplier_code,
        Branch: r.branch_name || 'GLOBAL (NULL)',
        AddedBy: r.first_name ? `${r.first_name} ${r.last_name}` : 'Unknown',
        Status: r.status
      })));
    }

    // 3. Optional: List all branches for context
    const branchesRes = await client.query('SELECT id, name FROM branches');
    console.log('\n--- Available Branches ---');
    console.table(branchesRes.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

runMigrationAndDebug();
