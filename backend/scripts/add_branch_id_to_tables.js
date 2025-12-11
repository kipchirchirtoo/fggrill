/**
 * Add Branch ID to Tables Script
 * 
 * This script adds branch_id column to all relevant tables that should have branch context
 * and creates appropriate foreign key constraints and indexes.
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
});

// Create log directory if it doesn't exist
const logDir = path.resolve(__dirname, '../logs/schema');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Create log file with timestamp
const logFilePath = path.join(logDir, `branch_column_${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  logStream.write(formattedMessage + '\n');
}

// Tables that need branch_id column
const tablesToUpdate = [
  // Core operational tables
  { table: 'rooms', defaultBranchIdStrategy: 'from_user' },
  { table: 'bookings', defaultBranchIdStrategy: 'from_user' },
  { table: 'guests', defaultBranchIdStrategy: 'from_user' },
  { table: 'staff_profiles', defaultBranchIdStrategy: 'from_user' },
  
  // Inventory tables
  { table: 'stock_takes', defaultBranchIdStrategy: 'from_user' },
  { table: 'stock_take_items', defaultBranchIdStrategy: 'from_parent', parentTable: 'stock_takes' },
  { table: 'stock_levels', defaultBranchIdStrategy: 'existing' },
  { table: 'stock_transactions', defaultBranchIdStrategy: 'from_user' },
  { table: 'stock_request_items', defaultBranchIdStrategy: 'from_parent', parentTable: 'stock_requests' },
  
  // Finance tables
  { table: 'invoices', defaultBranchIdStrategy: 'from_user' },
  { table: 'payments', defaultBranchIdStrategy: 'from_user' },
  { table: 'expenses', defaultBranchIdStrategy: 'from_user' },
  
  // Restaurant/Bar tables
  { table: 'orders', defaultBranchIdStrategy: 'from_user' },
  { table: 'order_items', defaultBranchIdStrategy: 'from_parent', parentTable: 'orders' },
  { table: 'tables', defaultBranchIdStrategy: 'from_user' },
  { table: 'menu_items', defaultBranchIdStrategy: 'null_allowed' },
  
  // Maintenance tables
  { table: 'maintenance_work_orders', defaultBranchIdStrategy: 'from_user' },
  { table: 'maintenance_tasks', defaultBranchIdStrategy: 'from_parent', parentTable: 'maintenance_work_orders' },
  { table: 'maintenance_assets', defaultBranchIdStrategy: 'from_user' },
  
  // Housekeeping tables
  { table: 'housekeeping_tasks', defaultBranchIdStrategy: 'from_user' },
  { table: 'room_inspections', defaultBranchIdStrategy: 'from_user' },
  { table: 'lost_found_items', defaultBranchIdStrategy: 'from_user' },
  
  // Report tables
  { table: 'reports', defaultBranchIdStrategy: 'null_allowed' },
  { table: 'report_schedules', defaultBranchIdStrategy: 'null_allowed' }
];

async function tableExists(client, tableName) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    );
  `, [tableName]);
  
  return result.rows[0].exists;
}

async function columnExists(client, tableName, columnName) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1 
      AND column_name = $2
    );
  `, [tableName, columnName]);
  
  return result.rows[0].exists;
}

async function addBranchIdColumn(client, table) {
  try {
    // Check if table exists
    const exists = await tableExists(client, table.table);
    if (!exists) {
      log(`Table ${table.table} does not exist, skipping...`);
      return { success: true, skipped: true };
    }

    // Check if branch_id column already exists
    const hasColumn = await columnExists(client, table.table, 'branch_id');
    if (hasColumn) {
      log(`Table ${table.table} already has branch_id column, skipping...`);
      return { success: true, skipped: true };
    }

    // Add branch_id column
    await client.query(`
      ALTER TABLE ${table.table}
      ADD COLUMN branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;
    `);
    
    log(`Added branch_id column to ${table.table}`);
    
    // Add index for branch_id
    await client.query(`
      CREATE INDEX idx_${table.table}_branch_id ON ${table.table}(branch_id);
    `);
    
    log(`Created index on ${table.table}(branch_id)`);
    
    // Populate branch_id based on strategy
    await populateBranchId(client, table);
    
    return { success: true };
  } catch (error) {
    log(`Error adding branch_id to ${table.table}: ${error.message}`);
    console.error(`Error details for ${table.table}:`, error);
    return { success: false, error: error.message };
  }
}

async function populateBranchId(client, table) {
  log(`Populating branch_id for ${table.table} using ${table.defaultBranchIdStrategy} strategy...`);
  
  switch (table.defaultBranchIdStrategy) {
    case 'from_user':
      await client.query(`
        UPDATE ${table.table} t
        SET branch_id = u.branch_id
        FROM users u
        WHERE t.created_by = u.id AND t.branch_id IS NULL;
      `);
      break;
      
    case 'from_parent':
      if (!table.parentTable) {
        log(`Error: Missing parent table for ${table.table}`);
        break;
      }
      await client.query(`
        UPDATE ${table.table} t
        SET branch_id = p.branch_id
        FROM ${table.parentTable} p
        WHERE t.${table.parentTable.slice(0, -1)}_id = p.id AND t.branch_id IS NULL;
      `);
      break;
      
    case 'existing':
      // Nothing to do, this table already has branch data in another form
      log(`No update needed for ${table.table}, it already has branch context`);
      break;
      
    case 'null_allowed':
      // Nothing to do, null values are allowed for this table
      log(`Leaving branch_id as NULL for ${table.table} as per strategy`);
      break;
      
    default:
      log(`Warning: Unknown branch ID strategy for ${table.table}`);
  }
}

async function updateAllTables() {
  log('====== Starting Branch ID Column Addition ======');
  const client = await pool.connect();
  
  try {
    // Begin transaction
    await client.query('BEGIN');
    
    // Make sure the branches table exists
    const branchesExist = await tableExists(client, 'branches');
    if (!branchesExist) {
      throw new Error('Branches table does not exist! Run the branches migration first.');
    }
    
    // Create a stats object to track progress
    const stats = {
      totalTables: tablesToUpdate.length,
      processed: 0,
      succeeded: 0,
      skipped: 0,
      failed: 0
    };
    
    // Process each table
    for (const table of tablesToUpdate) {
      log(`Processing table ${table.table}...`);
      const result = await addBranchIdColumn(client, table);
      
      stats.processed++;
      if (result.success) {
        if (result.skipped) {
          stats.skipped++;
        } else {
          stats.succeeded++;
        }
      } else {
        stats.failed++;
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Log summary
    log('====== Branch ID Column Addition Complete ======');
    log(`Total tables: ${stats.totalTables}`);
    log(`Processed: ${stats.processed}`);
    log(`Succeeded: ${stats.succeeded}`);
    log(`Skipped: ${stats.skipped}`);
    log(`Failed: ${stats.failed}`);
    
    return { success: stats.failed === 0, stats };
  } catch (error) {
    await client.query('ROLLBACK');
    log(`Fatal error: ${error.message}`);
    console.error('Error details:', error);
    return { success: false, error: error.message };
  } finally {
    client.release();
    logStream.end();
  }
}

// Execute when script is run directly
if (require.main === module) {
  updateAllTables()
    .then(result => {
      if (result.success) {
        console.log('Branch ID column addition completed successfully.');
        process.exit(0);
      } else {
        console.error('Branch ID column addition failed. Check the logs for details.');
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    })
    .finally(() => {
      pool.end();
    });
}

module.exports = {
  updateAllTables
};
