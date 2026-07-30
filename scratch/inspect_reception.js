const path = require('path');
const backendPath = path.resolve(__dirname, '../backend');
require(path.join(backendPath, 'node_modules/dotenv')).config({ path: path.join(backendPath, '.env') });
const { Pool } = require(path.join(backendPath, 'node_modules/pg'));
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.rvoaowhxyweswwuxbrzm:uj8dR3hPZmhwcEUf@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

const targetTables = [
  'bookings',
  'reservations',
  'rooms',
  'room_types',
  'room_status_history',
  'guests',
  'guest_profiles',
  'guest_documents',
  'guest_messages',
  'guest_preferences',
  'folios',
  'folio_items',
  'folio_payments',
  'folio_transactions',
  'payments',
  'branch_payments',
  'branch_payment_receipts',
  'cashier_shifts',
  'cashier_shift_logs',
  'cashier_transactions',
  'cashier_bills',
  'cashier_logbooks',
  'cashier_logbook_lines',
  'credit_bills',
  'unpaid_bills',
  'void_bills',
  'void_requests',
  'additional_services',
  'service_bookings',
  'booking_status_history',
  'reservation_guests',
  'rate_plans',
  'restaurant_bills',
  'pos_master_bills'
];

async function run() {
  try {
    const dbResults = {};

    for (const table of targetTables) {
      console.log(`Analyzing ${table}...`);
      
      // 1. Column definitions
      const colsRes = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);

      // 2. Foreign keys
      const fkRes = await pool.query(`
        SELECT
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_schema = 'public'
          AND tc.table_name = $1;
      `, [table]);

      // 3. Row count
      let count = 0;
      try {
        const countRes = await pool.query(`SELECT COUNT(*) FROM "${table}"`);
        count = parseInt(countRes.rows[0].count, 10);
      } catch (err) {
        console.error(`Count failed for ${table}:`, err.message);
      }

      dbResults[table] = {
        rowCount: count,
        columns: colsRes.rows,
        foreignKeys: fkRes.rows
      };
    }

    const outputPath = path.join(__dirname, 'reception_db_structure.json');
    fs.writeFileSync(outputPath, JSON.stringify(dbResults, null, 2));
    console.log(`Successfully written ${outputPath}`);
  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    await pool.end();
  }
}

run();
