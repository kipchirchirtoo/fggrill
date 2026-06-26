require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL }); 
  
  try {
    await client.connect();
    console.log('Connected to DB!');
    
    const branchId = 2; // Bomet Town

    const rawItems = [
      { sku: 'BEEF-MBUZI', name: 'BEEF/ MBUZI', unit: 'kg' },
      { sku: 'BEEF', name: 'BEEF', unit: 'kg' },
      { sku: 'MINCED-MEAT', name: 'MINCED MEAT', unit: 'kg' },
      { sku: 'EXE-FLOUR', name: 'EXE FLOUR', unit: 'kg' },
      { sku: 'MILK', name: 'MILK', unit: 'liters' },
      { sku: 'AJAB-FLOUR', name: 'AJAB FLOUR', unit: 'kg' },
      { sku: 'FULL-CHICKEN', name: 'FULL CHICKEN', unit: 'pieces' },
      { sku: 'POTATOES', name: 'POTATOES', unit: 'kg' },
      { sku: 'RICE', name: 'RICE', unit: 'kg' }
    ];

    for (const item of rawItems) {
      console.log(`Checking kitchen_stock for ${item.name}...`);
      const res = await client.query('SELECT id, current_balance FROM kitchen_stock WHERE branch_id = $1 AND item_name = $2', [branchId, item.name]);

      if (res.rows.length === 0) {
        console.log(`Inserting ${item.name} into kitchen_stock...`);
        try {
          await client.query(`
            INSERT INTO kitchen_stock (branch_id, item_sku, item_name, category, unit, current_balance)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [branchId, item.sku, item.name, 'Food Control Parent', item.unit, 50]);
          console.log(`Successfully added ${item.name} to stock.`);
        } catch (e) {
          console.error(`Failed to insert ${item.name}:`, e.message);
        }
      } else {
        console.log(`${item.name} is already in stock.`);
        if (Number(res.rows[0].current_balance) <= 0) {
           console.log(`Updating ${item.name} current_balance...`);
           await client.query('UPDATE kitchen_stock SET current_balance = 50 WHERE id = $1', [res.rows[0].id]);
        }
      }
    }

    try {
        await client.query("NOTIFY pgrst, 'reload schema'");
        console.log("PostgREST schema cache reload triggered.");
    } catch (e) {
        console.error("Failed to reload schema cache:", e.message);
    }

    console.log('Stock update complete.');
  } catch (e) {
    console.error('Connection/Execution Error:', e);
  } finally {
    await client.end();
  }
}

run();
