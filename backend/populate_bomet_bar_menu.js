const { Client } = require('pg');

const barMenuItems = [
  // SOFT DRINKS
  { name: 'SODA 500ML', category: 'Soft Drinks', price: 100, unit: 'ml' },
  { name: 'H20 1L', category: 'Soft Drinks', price: 100, unit: 'ml' },
  { name: 'ALVARO CAN', category: 'Soft Drinks', price: 200, unit: 'can' },
  { name: 'DELMONTE', category: 'Soft Drinks', price: 350, unit: 'ml' },
  { name: 'LEMONADE', category: 'Soft Drinks', price: 100, unit: 'ml' },
  
  // BEERS
  { name: 'T. LARGER', category: 'Beers', price: 250, unit: 'bottle' },
  { name: 'T. CIDER', category: 'Beers', price: 300, unit: 'bottle' },
  { name: 'T. LITE', category: 'Beers', price: 250, unit: 'bottle' },
  { name: 'T. MALT', category: 'Beers', price: 250, unit: 'bottle' },
  { name: 'GUINESS', category: 'Beers', price: 300, unit: 'bottle' },
  { name: 'BALOZI', category: 'Beers', price: 250, unit: 'bottle' },
  { name: 'BLACK ICE', category: 'Beers', price: 250, unit: 'bottle' },
  { name: 'SNAPP', category: 'Beers', price: 250, unit: 'bottle' },
  { name: 'PLISNER', category: 'Beers', price: 250, unit: 'bottle' },
  { name: 'MANYATTA', category: 'Beers', price: 300, unit: 'bottle' },
  { name: 'DESPARADO', category: 'Beers', price: 350, unit: 'bottle' },
  { name: 'HUNTERS BEER', category: 'Beers', price: 300, unit: 'bottle' },
  { name: 'WHITE CAP', category: 'Beers', price: 250, unit: 'bottle' },
  
  // CANNED BEERS
  { name: 'GUINESS CAN', category: 'Canned Beers', price: 300, unit: 'can' },
  { name: 'T. CAN', category: 'Canned Beers', price: 300, unit: 'can' },
  { name: 'W. CAP CAN', category: 'Canned Beers', price: 270, unit: 'can' },
  { name: 'BLACK ICE CAN', category: 'Canned Beers', price: 250, unit: 'can' },
  { name: 'GUARANA', category: 'Canned Beers', price: 250, unit: 'can' },
  { name: 'T. LITE CAN', category: 'Canned Beers', price: 300, unit: 'can' },
  { name: 'T. CIDER CAN', category: 'Canned Beers', price: 300, unit: 'can' },
  { name: 'MANYATTA CAN', category: 'Canned Beers', price: 300, unit: 'can' },
  { name: 'SNAPP CAN', category: 'Canned Beers', price: 300, unit: 'can' },
  { name: 'GUARANA PUNCH', category: 'Canned Beers', price: 250, unit: 'can' },
  { name: 'S/RASPBERRY TWIST', category: 'Canned Beers', price: 250, unit: 'can' },
  { name: 'Gordons can', category: 'Canned Beers', price: 250, unit: 'can' },
  { name: 'FAXE CAN', category: 'Canned Beers', price: 300, unit: 'can' },
  { name: 'BALOZI CAN', category: 'Canned Beers', price: 400, unit: 'can' },
  
  // SPIRITS
  { name: 'KC 1/4', category: 'Spirits', price: 500, unit: 'bottle' },
  { name: 'KC 1/2', category: 'Spirits', price: 700, unit: 'bottle' },
  { name: 'KC 3/4', category: 'Spirits', price: 1300, unit: 'bottle' },
  { name: 'VODKA 1/4', category: 'Spirits', price: 600, unit: 'bottle' },
  { name: 'VODKA 1/2', category: 'Spirits', price: 800, unit: 'bottle' },
  { name: 'VODKAA 3/4', category: 'Spirits', price: 1700, unit: 'bottle' },
  { name: 'RICHOT 1/4', category: 'Spirits', price: 600, unit: 'bottle' },
  { name: 'RICHOT 1/2', category: 'Spirits', price: 800, unit: 'bottle' },
  { name: 'RICHOT 3/4', category: 'Spirits', price: 1700, unit: 'bottle' },
  { name: 'GILBEYS 1/4', category: 'Spirits', price: 600, unit: 'bottle' },
  { name: 'GILBEYS 1/2', category: 'Spirits', price: 850, unit: 'bottle' },
  { name: 'GILBEYS 3/4', category: 'Spirits', price: 1700, unit: 'bottle' },
  { name: 'VICEROY 1/4', category: 'Spirits', price: 650, unit: 'bottle' },
  { name: 'VICEROY 1/2', category: 'Spirits', price: 900, unit: 'bottle' },
  { name: 'VICEROY 3/4', category: 'Spirits', price: 1800, unit: 'bottle' },
  
  // WHISKY
  { name: 'B/WHISKY 3/4', category: 'Whisky', price: 1300, unit: 'bottle' },
  { name: 'B/CREAM 750ML', category: 'Whisky', price: 1500, unit: 'bottle' },
  { name: 'ALL SEASONS 3/4', category: 'Whisky', price: 1500, unit: 'bottle' },
  { name: 'VAT 69 1/2', category: 'Whisky', price: 1100, unit: 'bottle' },
  { name: 'VAT69 3/4', category: 'Whisky', price: 1900, unit: 'bottle' },
  { name: 'BOND 7 1/4', category: 'Whisky', price: 600, unit: 'bottle' },
  { name: 'BOND 7 1/2', category: 'Whisky', price: 800, unit: 'bottle' },
  { name: 'BOND 7 3/4', category: 'Whisky', price: 1700, unit: 'bottle' },
  { name: 'GRANTS 3/4', category: 'Whisky', price: 2500, unit: 'bottle' },
  { name: 'GRANTS 1L', category: 'Whisky', price: 3000, unit: 'bottle' },
  { name: 'RED LABEL 1/4', category: 'Whisky', price: 1000, unit: 'bottle' },
  { name: 'RED LABEL 1/2', category: 'Whisky', price: 1300, unit: 'bottle' },
  { name: 'RED LABEL 3/4', category: 'Whisky', price: 2500, unit: 'bottle' },
  { name: 'RED LABEL 1L', category: 'Whisky', price: 3000, unit: 'bottle' },
  { name: 'BLACK LABEL 1/2', category: 'Whisky', price: 2100, unit: 'bottle' },
  { name: 'BLACK LABEL 3/4', category: 'Whisky', price: 4000, unit: 'bottle' },
  { name: 'BLACK LABEL 1L', category: 'Whisky', price: 5000, unit: 'bottle' },
  { name: 'J W BLONDE', category: 'Whisky', price: 3000, unit: 'bottle' },
  { name: 'HUNTERS 3/4', category: 'Whisky', price: 1300, unit: 'bottle' },
  { name: 'HUNTERS 1/4', category: 'Whisky', price: 500, unit: 'bottle' },
  { name: 'HUNTERS 1/2', category: 'Whisky', price: 700, unit: 'bottle' },
  { name: 'B $ W 1/2', category: 'Whisky', price: 800, unit: 'bottle' },
  { name: 'B $ W 3/4', category: 'Whisky', price: 1500, unit: 'bottle' },
  { name: 'SAVANNA', category: 'Whisky', price: 350, unit: 'bottle' },
  { name: 'TANG 10', category: 'Whisky', price: 6000, unit: 'bottle' },
  { name: 'GORDONS 1/2', category: 'Whisky', price: 1200, unit: 'bottle' },
  { name: 'JD 3/4', category: 'Whisky', price: 4000, unit: 'bottle' },
  { name: 'JD 1L', category: 'Whisky', price: 5000, unit: 'bottle' },
  { name: 'JD 1/2', category: 'Whisky', price: 2400, unit: 'bottle' },
  { name: 'JAMESON 1L', category: 'Whisky', price: 4000, unit: 'bottle' },
  { name: 'JAMESON 3/4', category: 'Whisky', price: 3200, unit: 'bottle' },
  { name: 'JAMESON 1/2', category: 'Whisky', price: 1600, unit: 'bottle' },
  { name: 'C/MORGAN 1/4', category: 'Whisky', price: 500, unit: 'bottle' },
  { name: 'C/MORGAN 3/4', category: 'Whisky', price: 1300, unit: 'bottle' },
  { name: 'C/MORGAN 3/4 MELON', category: 'Whisky', price: 1500, unit: 'bottle' },
  { name: 'FAMOUS GROUSE', category: 'Whisky', price: 2500, unit: 'bottle' },
  { name: 'WILLIAM LAWSONS 1/2', category: 'Whisky', price: 1000, unit: 'bottle' },
  { name: 'WILLIAM LAWSONS 3/4', category: 'Whisky', price: 2100, unit: 'bottle' },
  { name: 'WILLIAM LAWSONS1ltr', category: 'Whisky', price: 3000, unit: 'bottle' },
  { name: 'V $ A 1/4', category: 'Whisky', price: 400, unit: 'bottle' },
  { name: 'V & A 3/4', category: 'Whisky', price: 1200, unit: 'bottle' },
  { name: 'GORDONS 3/4', category: 'Whisky', price: 2500, unit: 'bottle' },
  
  // WINES
  { name: 'CELLAR CASK', category: 'Wines', price: 1400, unit: 'bottle' },
  { name: 'HEINEKEN', category: 'Wines', price: 350, unit: 'bottle' },
  { name: '4TH STREET', category: 'Wines', price: 1300, unit: 'bottle' },
  { name: 'CASABUENA', category: 'Wines', price: 1100, unit: 'bottle' },
  { name: 'CAPRICE', category: 'Wines', price: 1100, unit: 'bottle' },
  { name: 'FOUR COUSINS', category: 'Wines', price: 1200, unit: 'bottle' },
  { name: 'KINGFISHER', category: 'Wines', price: 300, unit: 'bottle' },
  { name: 'AMARULA 1/2', category: 'Wines', price: 1600, unit: 'bottle' },
  { name: 'AMARULA 3/4', category: 'Wines', price: 2500, unit: 'bottle' },
  { name: 'BAILEYS 1/2', category: 'Wines', price: 1600, unit: 'bottle' },
  { name: 'BAILEYS 3/4', category: 'Wines', price: 2800, unit: 'bottle' },
  { name: 'ASCONI', category: 'Wines', price: 2000, unit: 'bottle' },
  { name: 'DROTDY', category: 'Wines', price: 1300, unit: 'bottle' },
  { name: 'ROBERTSON', category: 'Wines', price: 2000, unit: 'bottle' },
  
  // COGNAC
  { name: 'HENNESY 750ML', category: 'Cognac', price: 6500, unit: 'bottle' },
  { name: 'DOUBLE BLACK 1L', category: 'Cognac', price: 7500, unit: 'bottle' },
  { name: 'MARTEL VS', category: 'Cognac', price: 8500, unit: 'bottle' },
  { name: 'MARTEL VSOP', category: 'Cognac', price: 13000, unit: 'bottle' },
  { name: 'SINGLETONE 12YRS', category: 'Cognac', price: 6000, unit: 'bottle' },
  
  // ENERGY DRINKS
  { name: 'REDBULL', category: 'Energy Drinks', price: 300, unit: 'can' },
  { name: 'MONSTER', category: 'Energy Drinks', price: 350, unit: 'can' },
  
  // OTHERS
  { name: 'CAMINO', category: 'Others', price: 4000, unit: 'bottle' },
  { name: 'JAGERMEISTER', category: 'Others', price: 4000, unit: 'bottle' },
  { name: 'SHERIDANS', category: 'Others', price: 6000, unit: 'bottle' },
  { name: 'BULLET BOURBON', category: 'Others', price: 5000, unit: 'bottle' },
  { name: 'TRUST CLASSIC', category: 'Others', price: 50, unit: 'bottle' },
  { name: 'TRUST STUDDED', category: 'Others', price: 100, unit: 'bottle' },
  { name: 'POOL TOKENS', category: 'Others', price: 50, unit: 'token' }
];

function generateSKU(name, category) {
  const categoryPrefix = category.substring(0, 3).toUpperCase();
  const nameClean = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase();
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `FGH-BAR-${categoryPrefix}-${nameClean}-${random}`;
}

async function run() {
  const client = new Client({ 
    connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' 
  });
  
  await client.connect();

  try {
    await client.query('BEGIN');
    
    // Find Bomet Town branch
    let branchRes = await client.query("SELECT id FROM branches WHERE name ILIKE '%BOMET%'");
    let branchId;
    
    if (branchRes.rows.length === 0) {
      console.log('Bomet Town branch not found. Creating it...');
      const iRes = await client.query(
        "INSERT INTO branches (name, code, location, is_main_branch, status) VALUES ($1, $2, $3, $4, $5) RETURNING id", 
        ['BOMET TOWN', 'BTN', 'Bomet', false, 'active']
      );
      branchId = iRes.rows[0].id;
    } else {
      branchId = branchRes.rows[0].id;
      console.log(`Found Bomet Town branch with ID: ${branchId}`);
    }

    let insertedCount = 0;
    let skippedCount = 0;

    for (const item of barMenuItems) {
      const sku = generateSKU(item.name, item.category);
      
      // Check if item already exists for this branch
      const existingRes = await client.query(
        "SELECT sku FROM simple_items WHERE sku = $1 OR (item_name = $2 AND category = $3 AND branch_id = $4)",
        [sku, item.name, item.category, branchId]
      );

      if (existingRes.rows.length > 0) {
        console.log(`Skipping existing item: ${item.name}`);
        skippedCount++;
        continue;
      }

      try {
        await client.query(
          `INSERT INTO simple_items (sku, item_name, description, category, store_type, cost_price, retail_price, unit_of_measure, is_active, branch_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            sku,
            item.name,
            `${item.category} - ${item.name}`,
            item.category,
            'bar_store',
            0, // cost price set to 0
            item.price,
            item.unit,
            true,
            branchId
          ]
        );

        // Add to branch_stock for Bomet Town
        await client.query(
          `INSERT INTO branch_stock (branch_id, item_sku, quantity, updated_at) 
           VALUES ($1, $2, 0, NOW()) 
           ON CONFLICT (branch_id, item_sku) DO UPDATE SET updated_at = NOW()`,
          [branchId, sku]
        );

        insertedCount++;
        console.log(`Inserted: ${item.name} (${sku})`);
      } catch (err) {
        console.error(`Failed to insert ${item.name}:`, err.message);
      }
    }

    await client.query('COMMIT');
    console.log(`\n=== SUMMARY ===`);
    console.log(`Branch ID: ${branchId}`);
    console.log(`Inserted: ${insertedCount} items`);
    console.log(`Skipped: ${skippedCount} items (already exist)`);
    console.log(`Total items in menu: ${barMenuItems.length}`);

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e.message);
    throw e;
  } finally {
    await client.end();
  }
}

run();
