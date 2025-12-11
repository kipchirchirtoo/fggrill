/**
 * Create Demo Users Script
 * 
 * This script creates demo users for the new consolidated roles in the database.
 * Run this script after setting up the database schema.
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// Load environment variables
dotenv.config();

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
});

// Demo users to create
const demoUsers = [
  {
    email: 'branch-ops@famousgate.com',
    password: 'branch123',
    firstName: 'Branch',
    lastName: 'Operations',
    role: 'branch_operations_manager',
    branch_id: 1, // Bomet
    is_central: false,
    account_type: 'BUSINESS'
  },
  {
    email: 'central-ops@famousgate.com',
    password: 'central123',
    firstName: 'Central',
    lastName: 'Operations',
    role: 'central_operations_manager',
    branch_id: null,
    is_central: true,
    account_type: 'BUSINESS'
  },
  {
    email: 'facilities@famousgate.com',
    password: 'facil123',
    firstName: 'Facilities',
    lastName: 'Manager',
    role: 'facilities_manager',
    branch_id: 1, // Bomet
    is_central: false,
    account_type: 'BUSINESS'
  },
];

/**
 * Hash password using bcrypt
 * @param {string} password Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  try {
    // For demo users, we can use a low salt rounds value
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  } catch (error) {
    console.error('Error hashing password:', error);
    throw error;
  }
}

/**
 * Create a user in the database
 * @param {Object} user User data
 * @returns {Promise<Object>} Created user
 */
async function createUser(user, client) {
  try {
    // Check if user already exists
    const existingUser = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [user.email]
    );

    if (existingUser.rows.length > 0) {
      console.log(`User ${user.email} already exists. Updating role to ${user.role}...`);
      
      // Update existing user
      const updatedUser = await client.query(
        `UPDATE users 
         SET first_name = $1, last_name = $2, role = $3, branch_id = $4, is_central = $5, updated_at = NOW()
         WHERE email = $6
         RETURNING *`,
        [user.firstName, user.lastName, user.role, user.branch_id, user.is_central, user.email]
      );
      
      return updatedUser.rows[0];
    }

    // Hash password
    const hashedPassword = await hashPassword(user.password);

    // Check if the table has required columns
    const columnsCheck = await client.query(
      `SELECT 
        COUNT(*) FILTER (WHERE column_name = 'hashed_password') as has_hashed_password,
        COUNT(*) FILTER (WHERE column_name = 'account_type') as has_account_type
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN ('hashed_password', 'account_type')`
    );
    
    const hasHashedPassword = parseInt(columnsCheck.rows[0].has_hashed_password) > 0;
    const hasAccountType = parseInt(columnsCheck.rows[0].has_account_type) > 0;
    
    // Prepare SQL query and parameters based on available columns
    let columns = ['id', 'email', 'first_name', 'last_name', 'role', 'branch_id', 'is_central', 'created_at'];
    let values = [uuidv4(), user.email, user.firstName, user.lastName, user.role, user.branch_id, user.is_central];
    let placeholders = ['$1', '$2', '$3', '$4', '$5', '$6', '$7', 'NOW()'];
    let paramIndex = 8;
    
    if (hasHashedPassword) {
      columns.push('hashed_password');
      values.push(hashedPassword);
      placeholders.push(`$${paramIndex++}`);
    } else {
      columns.push('password');
      values.push(hashedPassword);
      placeholders.push(`$${paramIndex++}`);
    }
    
    if (hasAccountType) {
      columns.push('account_type');
      values.push(user.account_type || 'BUSINESS');
      placeholders.push(`$${paramIndex++}`);
    }
    
    // Construct and execute query
    const query = `
      INSERT INTO users 
      (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;
    
    const result = await client.query(query, values);

    return result.rows[0];
  } catch (error) {
    console.error(`Error creating user ${user.email}:`, error);
    throw error;
  }
}

/**
 * Create branch access for user
 * @param {string} userId User ID
 * @param {number} branchId Branch ID
 * @returns {Promise<Object>} Created branch access
 */
async function createBranchAccess(userId, branchId, isPrimary, client) {
  try {
    if (!branchId) return null;

    // Check if branch access already exists
    const existingAccess = await client.query(
      'SELECT * FROM user_branch_access WHERE user_id = $1 AND branch_id = $2',
      [userId, branchId]
    );

    if (existingAccess.rows.length > 0) {
      console.log(`Branch access for user ${userId} to branch ${branchId} already exists.`);
      return existingAccess.rows[0];
    }

    // Insert branch access
    const result = await client.query(
      `INSERT INTO user_branch_access 
       (user_id, branch_id, is_primary, access_level, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [userId, branchId, isPrimary, 'full']
    );

    return result.rows[0];
  } catch (error) {
    console.error(`Error creating branch access for user ${userId} to branch ${branchId}:`, error);
    return null;
  }
}

/**
 * Main function to create all demo users
 */
async function createDemoUsers() {
  const client = await pool.connect();
  
  try {
    // Begin transaction
    await client.query('BEGIN');
    
    console.log('Creating demo users for consolidated roles...');
    
    // Create each user
    for (const userData of demoUsers) {
      const user = await createUser(userData, client);
      console.log(`Created/updated user: ${user.email} with role: ${user.role}`);
      
      // Create branch access
      if (user.branch_id) {
        await createBranchAccess(user.id, user.branch_id, true, client);
        console.log(`Created branch access for user ${user.email} to branch ${user.branch_id}`);
      }
      
      // For central operations, give access to all branches
      if (user.role === 'central_operations_manager') {
        // Get all branches
        const branches = await client.query('SELECT id FROM branches');
        
        // Create access for each branch
        for (const branch of branches.rows) {
          await createBranchAccess(user.id, branch.id, branch.id === 1, client);
          console.log(`Created branch access for user ${user.email} to branch ${branch.id}`);
        }
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('All demo users created successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating demo users:', error);
  } finally {
    client.release();
    pool.end();
  }
}

// Run the script
createDemoUsers().catch(console.error);
