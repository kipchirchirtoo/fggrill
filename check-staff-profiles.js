const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await client.connect();
  
  const exists = await client.query(`
    SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'staff_profiles')
  `);
  
  console.log('staff_profiles table exists:', exists.rows[0].exists);
  
  if (exists.rows[0].exists) {
    const columns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'staff_profiles' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nColumns:');
    columns.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    
    // Check foreign keys
    const fks = await client.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'staff_profiles'
    `);
    
    console.log('\nForeign Keys:');
    fks.rows.forEach(row => {
      console.log(`  ${row.column_name} -> ${row.foreign_table_name}(${row.foreign_column_name})`);
    });
  }
  
  await client.end();
})();
