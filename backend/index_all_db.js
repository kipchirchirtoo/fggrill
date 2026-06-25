const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const parsedUrl = new URL(process.env.DATABASE_URL.replace(':6543', ':5432'));
  parsedUrl.hostname = '34.241.16.247';
  const connectionString = parsedUrl.toString();
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();

    console.log('--- Applying specific POS indexes ---');
    const posIndexes = [
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pos_outlets_branch_type ON pos_outlets(branch_id, outlet_type);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pos_outlets_is_active ON pos_outlets(is_active);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pos_outlet_items_outlet_id ON pos_outlet_items(outlet_id);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pos_outlet_items_branch_id ON pos_outlet_items(branch_id);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pos_outlet_items_is_avail ON pos_outlet_items(is_available);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pos_outlet_items_menu_item_id ON pos_outlet_items(menu_item_id);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_restaurant_menu_items_branch ON restaurant_menu_items(branch_id);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_items_branch ON inventory_items(branch_id);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bar_drinks_branch ON bar_drinks(branch_id);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_take_lines_take_id ON stock_take_lines(stock_take_id);'
    ];

    for (const sql of posIndexes) {
      console.log('Executing:', sql);
      try {
        await client.query(sql);
      } catch(e) {
        console.error('Failed:', e.message);
      }
    }

    console.log('\n--- Finding unindexed foreign keys ---');
    // Find unindexed foreign keys
    const fkQuery = `
      WITH fk_actions AS (
        SELECT
          c.conrelid::regclass AS table_name,
          c.conname AS constraint_name,
          (
            SELECT json_agg(attname)
            FROM pg_attribute
            WHERE attrelid = c.conrelid AND attnum = ANY(c.conkey)
          ) AS columns
        FROM pg_constraint c
        WHERE c.contype = 'f'
      ),
      indexed_cols AS (
        SELECT
          i.indrelid::regclass AS table_name,
          (
            SELECT json_agg(attname)
            FROM pg_attribute
            WHERE attrelid = i.indrelid AND attnum = ANY(i.indkey)
          ) AS indexed_columns
        FROM pg_index i
      )
      SELECT
        f.table_name,
        f.constraint_name,
        f.columns
      FROM fk_actions f
      LEFT JOIN indexed_cols i ON f.table_name = i.table_name AND f.columns->>0 = i.indexed_columns->>0
      WHERE i.table_name IS NULL;
    `;
    
    const unindexedFks = await client.query(fkQuery);
    console.log(`Found ${unindexedFks.rows.length} unindexed foreign keys. Building indexes...`);

    for (const row of unindexedFks.rows) {
      if (!row.columns || row.columns.length === 0) continue;
      // create safe name
      const idxName = ('idx_' + row.constraint_name).substring(0, 63); // pg limit
      
      const sql = `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${idxName} ON ${row.table_name} (${row.columns.join(', ')});`;
      console.log(`Creating: ${idxName}`);
      try {
        await client.query(sql);
      } catch(err) {
        console.error(`Failed to create ${idxName}:`, err.message);
      }
    }

    console.log('✅ Indexing complete.');

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await client.end();
  }
}
run();
