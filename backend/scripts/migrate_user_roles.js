/**
 * User Role Migration Script
 * 
 * This script migrates users from the old role structure to the new consolidated roles.
 * It updates the users table and creates user_branch_access entries.
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

// Migration mapping
const roleMigrations = [
  {
    id: 1,
    old_role: 'branch_manager',
    new_role: 'branch_operations_manager',
    description: 'Consolidate Branch Manager into Branch Operations Manager role',
  },
  {
    id: 2,
    old_role: 'branch_storekeeper',
    new_role: 'branch_operations_manager',
    description: 'Consolidate Branch Storekeeper into Branch Operations Manager role',
  },
  {
    id: 3,
    old_role: 'central_storekeeper',
    new_role: 'central_operations_manager',
    description: 'Consolidate Central Storekeeper into Central Operations Manager role',
  },
  {
    id: 4,
    old_role: 'general_manager',
    new_role: 'central_operations_manager',
    description: 'Consolidate General Manager into Central Operations Manager role',
  },
  {
    id: 5,
    old_role: 'housekeeping',
    new_role: 'facilities_manager',
    description: 'Consolidate Housekeeping into Facilities Manager role',
  },
  {
    id: 6,
    old_role: 'housekeeping_supervisor',
    new_role: 'facilities_manager',
    description: 'Consolidate Housekeeping Supervisor into Facilities Manager role',
  },
  {
    id: 7,
    old_role: 'maintenance',
    new_role: 'facilities_manager',
    description: 'Consolidate Maintenance into Facilities Manager role',
  }
];

// Create migration log directory if it doesn't exist
const migrationLogDir = path.resolve(__dirname, '../logs/migrations');
if (!fs.existsSync(migrationLogDir)) {
  fs.mkdirSync(migrationLogDir, { recursive: true });
}

// Create log file with timestamp
const logFilePath = path.join(migrationLogDir, `role_migration_${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  logStream.write(formattedMessage + '\n');
}

async function executeMigration(migrationId) {
  const client = await pool.connect();
  try {
    const migration = roleMigrations.find(m => m.id === migrationId);
    if (!migration) {
      throw new Error(`Migration with ID ${migrationId} not found`);
    }

    log(`Starting migration #${migrationId}: ${migration.description}`);

    // Begin transaction
    await client.query('BEGIN');

    // Insert migration record
    const migrationInsert = await client.query(
      `INSERT INTO role_migrations (
        old_role, new_role, description, status, affected_users, is_reversible, created_at
      ) VALUES ($1, $2, $3, $4, 0, $5, NOW()) RETURNING id`,
      [migration.old_role, migration.new_role, migration.description, 'in_progress', true]
    );

    const dbMigrationId = migrationInsert.rows[0].id;
    log(`Created migration record with ID ${dbMigrationId}`);

    // Find affected users
    const usersResult = await client.query(
      `SELECT id, email, role, branch_id FROM users WHERE role = $1`,
      [migration.old_role]
    );

    const affectedUsers = usersResult.rows;
    log(`Found ${affectedUsers.length} users with role "${migration.old_role}"`);

    // Update affected users count in migration record
    await client.query(
      `UPDATE role_migrations SET affected_users = $1 WHERE id = $2`,
      [affectedUsers.length, dbMigrationId]
    );

    // Process each user
    for (const user of affectedUsers) {
      log(`Processing user ${user.email} (${user.id})`);

      // Update user role
      await client.query(
        `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`,
        [migration.new_role, user.id]
      );

      // Create user_branch_access record if it doesn't exist
      if (user.branch_id) {
        const accessExists = await client.query(
          `SELECT 1 FROM user_branch_access WHERE user_id = $1 AND branch_id = $2`,
          [user.id, user.branch_id]
        );

        if (accessExists.rows.length === 0) {
          await client.query(
            `INSERT INTO user_branch_access (user_id, branch_id, is_primary, access_level, created_at)
            VALUES ($1, $2, TRUE, 'full', NOW())`,
            [user.id, user.branch_id]
          );
          log(`Created branch access record for user ${user.email} to branch ${user.branch_id}`);
        }
      }

      // Log user migration
      await client.query(
        `INSERT INTO user_role_changes (user_id, old_role, new_role, changed_by, migration_id, created_at)
        VALUES ($1, $2, $3, 'system', $4, NOW())`,
        [user.id, migration.old_role, migration.new_role, dbMigrationId]
      );
    }

    // Update migration status to completed
    await client.query(
      `UPDATE role_migrations SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [dbMigrationId]
    );

    // Commit transaction
    await client.query('COMMIT');
    log(`Migration #${migrationId} completed successfully!`);
    return { success: true, affectedUsers: affectedUsers.length };

  } catch (error) {
    await client.query('ROLLBACK');
    log(`Error in migration #${migrationId}: ${error.message}`);
    console.error('Migration error details:', error);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

async function executeAllMigrations() {
  log('====== Starting User Role Migration Process ======');

  // First, create tables if they don't exist
  await createMigrationTables();

  // Then run each migration in sequence
  let allSuccessful = true;
  let totalMigrated = 0;

  for (const migration of roleMigrations) {
    const result = await executeMigration(migration.id);
    if (!result.success) {
      allSuccessful = false;
      log(`Migration #${migration.id} failed, continuing with next migration...`);
    } else {
      totalMigrated += result.affectedUsers;
    }
  }

  log(`====== Migration Process Completed ======`);
  log(`Total users migrated: ${totalMigrated}`);
  log(`All migrations successful: ${allSuccessful}`);

  // Close log stream and DB pool
  logStream.end();
  await pool.end();

  return { success: allSuccessful, totalMigrated };
}

async function createMigrationTables() {
  const client = await pool.connect();
  try {
    log('Creating migration tables if they don\'t exist...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_migrations (
        id SERIAL PRIMARY KEY,
        old_role VARCHAR(50) NOT NULL,
        new_role VARCHAR(50) NOT NULL,
        description TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        affected_users INT NOT NULL DEFAULT 0,
        is_reversible BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_role_changes (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        old_role VARCHAR(50) NOT NULL,
        new_role VARCHAR(50) NOT NULL,
        changed_by VARCHAR(100) NOT NULL,
        migration_id INT REFERENCES role_migrations(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    log('Migration tables created successfully.');
  } catch (error) {
    log(`Error creating migration tables: ${error.message}`);
    console.error('Table creation error details:', error);
  } finally {
    client.release();
  }
}

// Execute migrations when script is run directly
if (require.main === module) {
  executeAllMigrations()
    .then(result => {
      if (result.success) {
        console.log(`Migration completed successfully. Migrated ${result.totalMigrated} users.`);
        process.exit(0);
      } else {
        console.error('Some migrations failed. Check the logs for details.');
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Fatal migration error:', err);
      process.exit(1);
    });
}

module.exports = {
  executeMigration,
  executeAllMigrations
};
