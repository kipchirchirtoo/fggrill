const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function checkTriggers() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    // Check for triggers that might reference branch_id
    const result = await client.query(`
      SELECT 
        trigger_name,
        event_object_table,
        action_statement
      FROM information_schema.triggers
      WHERE action_statement LIKE '%branch_id%'
      ORDER BY event_object_table, trigger_name
    `);
    
    console.log('Triggers referencing branch_id:');
    result.rows.forEach(row => {
      console.log(`\nTable: ${row.event_object_table}`);
      console.log(`Trigger: ${row.trigger_name}`);
      console.log(`Action: ${row.action_statement.substring(0, 200)}...`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTriggers();
