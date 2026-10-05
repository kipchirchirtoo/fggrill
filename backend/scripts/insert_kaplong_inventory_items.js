const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const itemsToRegister = [
  { sku: 'FGB-KPL-AMARULA-1L', name: 'AMARULA 1L', category: 'LIQUEURS', unit: 'bottle', cost: 4125 },
  { sku: 'FGB-KPL-AMARULA-750ML', name: 'AMARULA 750ML', category: 'LIQUEURS', unit: 'bottle', cost: 2250 },
  { sku: 'FGB-KPL-BAILEYS', name: 'BAILEYS', category: 'LIQUEURS', unit: 'bottle', cost: 1350 },
  { sku: 'FGB-KPL-BALANTINES-750ML', name: 'BALANTINES 750ML', category: 'WHISKY', unit: 'bottle', cost: 2250 },
  { sku: 'FGB-KPL-BLACK---WHITE-1-LTR', name: 'BLACK & WHITE 1 LTR', category: 'WHISKY', unit: 'bottle', cost: 1650 },
  { sku: 'FGB-KPL-CAPRICE', name: 'CAPRICE', category: 'WINES', unit: 'bottle', cost: 975 },
  { sku: 'FGB-KPL-CAPTAIN-MORGAN-1-4', name: 'CAPTAIN MORGAN 1/4', category: 'SPIRITS', unit: 'bottle', cost: 375 },
  { sku: 'FGB-KPL-CASABUENA', name: 'CASABUENA', category: 'WINES', unit: 'bottle', cost: 900 },
  { sku: 'FGB-KPL-CHAMDOR', name: 'CHAMDOR', category: 'WINES', unit: 'bottle', cost: 1050 },
  { sku: 'FGB-KPL-DASANI-1-LTR', name: 'DASANI 1 LTR', category: 'SOFT DRINKS', unit: 'bottle', cost: 75 },
  { sku: 'FGH-SOFT-DRINKS-003-1', name: 'DASANI 500ML.', category: 'SOFT DRINKS', unit: 'bottle', cost: 38 },
  { sku: 'FGB-KPL-DROSDTY-HOF', name: 'DROSDTY HOF', category: 'WINES', unit: 'bottle', cost: 900 },
  { sku: 'FGB-KPL-FAMOUS-GROUSE', name: 'FAMOUS GROUSE', category: 'WHISKY', unit: 'bottle', cost: 1875 },
  { sku: 'FGB-KPL-FRESH-COCKTAIL-MANGO', name: 'FRESH COCKTAIL/MANGO', category: 'SOFT DRINKS', unit: 'pcs', cost: 113 },
  { sku: 'FGB-KPL-GILBEYS-1-2', name: 'GILBEYS 1/2', category: 'GIN', unit: 'bottle', cost: 638 },
  { sku: 'FGB-KPL-GILBEYS-1-4', name: 'GILBEYS 1/4', category: 'GIN', unit: 'bottle', cost: 488 },
  { sku: 'FGB-KPL-GLENFIDICH-12YRS', name: 'GLENFIDICH 12YRS', category: 'WHISKY', unit: 'bottle', cost: 6375 },
  { sku: 'FGB-KPL-GLENFIDICH-15YRS', name: 'GLENFIDICH 15YRS', category: 'WHISKY', unit: 'bottle', cost: 9000 },
  { sku: 'FGB-KPL-GLENFIDICH-18YRS', name: 'GLENFIDICH 18YRS', category: 'WHISKY', unit: 'bottle', cost: 13125 },
  { sku: 'FGB-KPL-GOLD-RESERVE', name: 'GOLD RESERVE', category: 'WHISKY', unit: 'bottle', cost: 7125 },
  { sku: 'FGB-KPL-GORDONS-GIN-350ML', name: 'GORDONS GIN 350ML', category: 'GIN', unit: 'bottle', cost: 900 },
  { sku: 'FGB-KPL-GORDONS-GIN-750ML', name: 'GORDONS GIN 750ML', category: 'GIN', unit: 'bottle', cost: 1875 },
  { sku: 'FGB-KPL-GRANTS-1-LTR', name: 'GRANTS 1 LTR', category: 'WHISKY', unit: 'bottle', cost: 2400 },
  { sku: 'FGB-KPL-GREEN-LABEL', name: 'GREEN LABEL', category: 'WHISKY', unit: 'bottle', cost: 9000 },
  { sku: 'FGH-BEERS-004-1', name: 'GUARANA', category: 'BEERS', unit: 'can', cost: 175.96 },
  { sku: 'FGB-KPL-HENNESY-1-LTR', name: 'HENNESY 1 LTR', category: 'COGNAC', unit: 'bottle', cost: 10125 },
  { sku: 'FGB-KPL-HENNESY-750ML', name: 'HENNESY 750ML', category: 'COGNAC', unit: 'bottle', cost: 5625 },
  { sku: 'FGB-KPL-HUNTERS-1-2', name: 'HUNTERS 1/2', category: 'SPIRITS', unit: 'bottle', cost: 525 },
  { sku: 'FGB-KPL-HUNTERS-1-4', name: 'HUNTERS 1/4', category: 'SPIRITS', unit: 'bottle', cost: 375 },
  { sku: 'FGB-KPL-HUNTERS-750ML', name: 'HUNTERS 750ML', category: 'SPIRITS', unit: 'bottle', cost: 975 },
  { sku: 'FGB-KPL-J-W-BLACK-250ML', name: 'J.W BLACK 250ML', category: 'WHISKY', unit: 'bottle', cost: 975 },
  { sku: 'FGB-KPL-J-W-BLACK-375ML', name: 'J.W BLACK 375ML', category: 'WHISKY', unit: 'bottle', cost: 1650 },
  { sku: 'FGB-KPL-J-W-RED-375ML', name: 'J.W RED 375ML', category: 'WHISKY', unit: 'bottle', cost: 1275 },
  { sku: 'FGB-KPL-JARGERMASTER-750-ML', name: 'JARGERMASTER 750 ML', category: 'SPIRITS', unit: 'bottle', cost: 3375 },
  { sku: 'FGB-KPL-KERINGET-1-LTR', name: 'KERINGET 1 LTR', category: 'SOFT DRINKS', unit: 'bottle', cost: 113 },
  { sku: 'FGB-KPL-KERINGET-500ML', name: 'KERINGET 500ML', category: 'SOFT DRINKS', unit: 'bottle', cost: 53 },
  { sku: 'FGB-KPL-LEMON--B-', name: 'LEMON (B)', category: 'SOFT DRINKS', unit: 'pcs', cost: 15 },
  { sku: 'FGB-KPL-SHERIDANS-1-LTR', name: 'SHERIDANS 1 LTR', category: 'LIQUEURS', unit: 'bottle', cost: 5250 },
  { sku: 'FGB-KPL-SINGLETON-12YRS', name: 'SINGLETON 12YRS', category: 'WHISKY', unit: 'bottle', cost: 4875 },
  { sku: 'FGB-KPL-SINGLETON-15YRS', name: 'SINGLETON 15YRS', category: 'WHISKY', unit: 'bottle', cost: 5850 },
  { sku: 'FGB-KPL-SODA-500ML-TAKE-AWAY', name: 'SODA 500ML TAKE AWAY', category: 'SOFT DRINKS', unit: 'bottle', cost: 75 },
  { sku: 'FGB-KPL-SODA-TAKEAWAY', name: 'SODA TAKEAWAY', category: 'SOFT DRINKS', unit: 'bottle', cost: 75 },
  { sku: 'FGB-KPL-TONIC-SODA-CAN', name: 'TONIC SODA CAN', category: 'SOFT DRINKS', unit: 'can', cost: 113 },
  { sku: 'FGB-KPL-VAT-69-1-2', name: 'VAT 69 1/2', category: 'WHISKY', unit: 'bottle', cost: 750 },
  { sku: 'FGB-KPL-VICEROY-1-2', name: 'VICEROY 1/2', category: 'SPIRITS', unit: 'bottle', cost: 675 },
  { sku: 'FGB-KPL-VICEROY-1-4', name: 'VICEROY 1/4', category: 'SPIRITS', unit: 'bottle', cost: 488 },
  { sku: 'FGB-KPL-VODKA-1-2', name: 'VODKA 1/2', category: 'VODKA', unit: 'bottle', cost: 638 },
  { sku: 'FGB-KPL-VODKA-1-4', name: 'VODKA 1/4', category: 'VODKA', unit: 'bottle', cost: 488 },
  { sku: 'FGB-KPL-WHITE-CAP-CRISP-', name: 'WHITE CAP CRISP[', category: 'BEERS', unit: 'bottle', cost: 188 },
  { sku: 'FGB-KPL-WILLIAM-LAWSONS-1LTR', name: 'WILLIAM LAWSONS 1LTR', category: 'WHISKY', unit: 'bottle', cost: 2250 }
];

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Inserting missing items into inventory_items...');
    let inserted = 0;
    for (const item of itemsToRegister) {
      const check = await client.query('SELECT id FROM inventory_items WHERE sku = $1', [item.sku]);
      if (check.rows.length === 0) {
        await client.query(`
          INSERT INTO inventory_items (
            sku, item_name, description, category, unit, default_unit_cost, store_type, is_active, reorder_level
          ) VALUES ($1, $2, $2, $3, $4, $5, 'bar_store', true, 10)
        `, [item.sku, item.name, item.category, item.unit, item.cost]);
        inserted++;
      }
    }
    console.log(`Inserted ${inserted} items into inventory_items.`);

    await client.query('COMMIT');
    console.log('Successfully committed inventory_items inserts.');

  } catch(e) {
    await client.query('ROLLBACK');
    console.error('Error during insert:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
