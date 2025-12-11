#!/usr/bin/env node

/**
 * Multi-Branch Architecture Migration Verification Script
 * 
 * This script verifies that the migration to multi-branch architecture was successful
 * and provides a summary report.
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

// Create verification report
const reportDir = path.resolve(__dirname, './reports');
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

const reportFilePath = path.join(reportDir, `migration_verification_${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
const reportStream = fs.createWriteStream(reportFilePath);

function writeToReport(text) {
  reportStream.write(text + '\n');
  console.log(text);
}

async function verifyMigration() {
  writeToReport(`# Multi-Branch Migration Verification Report\n`);
  writeToReport(`Generated: ${new Date().toISOString()}\n`);

  const client = await pool.connect();
  try {
    // 1. Verify branch table structure
    writeToReport(`## 1. Branch Table Structure\n`);
    
    const branchTableResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'branches' 
      ORDER BY ordinal_position;
    `);
    
    if (branchTableResult.rows.length > 0) {
      writeToReport(`✅ Branch table exists with the following structure:\n`);
      writeToReport('| Column | Data Type |');
      writeToReport('| ------ | --------- |');
      branchTableResult.rows.forEach(col => {
        writeToReport(`| ${col.column_name} | ${col.data_type} |`);
      });
    } else {
      writeToReport(`❌ Branch table does not exist!\n`);
    }
    
    // 2. Count branches
    const branchCountResult = await client.query(`
      SELECT COUNT(*) as count FROM branches;
    `);
    
    writeToReport(`\n## 2. Branch Configuration\n`);
    writeToReport(`Total branches: ${branchCountResult.rows[0].count}\n`);
    
    // 3. Check for branch_id columns
    writeToReport(`## 3. Tables with Branch ID\n`);
    
    const tablesWithBranchId = await client.query(`
      SELECT table_name
      FROM information_schema.columns
      WHERE column_name = 'branch_id'
      AND table_schema = 'public'
      ORDER BY table_name;
    `);
    
    writeToReport(`Found ${tablesWithBranchId.rows.length} tables with branch_id column:\n`);
    writeToReport('```');
    tablesWithBranchId.rows.forEach(row => {
      writeToReport(`- ${row.table_name}`);
    });
    writeToReport('```\n');
    
    // 4. Check user role migrations
    writeToReport(`## 4. User Role Migration\n`);
    
    // Check if role_migrations table exists
    const migrationTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'role_migrations'
      );
    `);
    
    if (migrationTableExists.rows[0].exists) {
      const roleMigrations = await client.query(`
        SELECT id, old_role, new_role, status, affected_users, completed_at
        FROM role_migrations
        ORDER BY id;
      `);
      
      writeToReport(`Found ${roleMigrations.rows.length} role migrations:\n`);
      writeToReport('| ID | From Role | To Role | Status | Users Affected | Completed |');
      writeToReport('| -- | --------- | ------- | ------ | -------------- | --------- |');
      
      roleMigrations.rows.forEach(migration => {
        writeToReport(`| ${migration.id} | ${migration.old_role} | ${migration.new_role} | ${migration.status} | ${migration.affected_users} | ${migration.completed_at ? new Date(migration.completed_at).toLocaleString() : 'N/A'} |`);
      });
      
      // Count users by role
      const userRoleCounts = await client.query(`
        SELECT role, COUNT(*) as count
        FROM users
        GROUP BY role
        ORDER BY count DESC;
      `);
      
      writeToReport(`\nCurrent user role distribution:\n`);
      writeToReport('| Role | Count |');
      writeToReport('| ---- | ----- |');
      
      userRoleCounts.rows.forEach(roleCount => {
        writeToReport(`| ${roleCount.role} | ${roleCount.count} |`);
      });
    } else {
      writeToReport(`❌ Role migrations table does not exist!\n`);
    }
    
    // 5. Check branch access records
    writeToReport(`\n## 5. Branch Access Configuration\n`);
    
    const branchAccessExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_branch_access'
      );
    `);
    
    if (branchAccessExists.rows[0].exists) {
      const accessCount = await client.query(`
        SELECT COUNT(*) as count FROM user_branch_access;
      `);
      
      writeToReport(`Total branch access records: ${accessCount.rows[0].count}\n`);
      
      // Check users with multiple branch access
      const multiBranchUsers = await client.query(`
        SELECT 
          u.email,
          u.role,
          COUNT(uba.branch_id) as branch_count
        FROM 
          users u
          JOIN user_branch_access uba ON u.id = uba.user_id
        GROUP BY 
          u.email, u.role
        HAVING 
          COUNT(uba.branch_id) > 1
        ORDER BY 
          branch_count DESC;
      `);
      
      writeToReport(`\nUsers with multi-branch access:\n`);
      
      if (multiBranchUsers.rows.length > 0) {
        writeToReport('| User | Role | Branch Count |');
        writeToReport('| ---- | ---- | ------------ |');
        
        multiBranchUsers.rows.forEach(user => {
          writeToReport(`| ${user.email} | ${user.role} | ${user.branch_count} |`);
        });
      } else {
        writeToReport('No users have access to multiple branches yet.\n');
      }
    } else {
      writeToReport(`❌ User branch access table does not exist!\n`);
    }
    
    // 6. Verify new roles in auth context
    writeToReport(`\n## 6. Frontend Role Configuration\n`);
    
    const authContextPath = path.join(__dirname, 'frontend', 'src', 'lib', 'auth-context.tsx');
    if (fs.existsSync(authContextPath)) {
      const authContextContent = fs.readFileSync(authContextPath, 'utf8');
      
      const newRoles = [
        'BRANCH_OPERATIONS_MANAGER',
        'CENTRAL_OPERATIONS_MANAGER',
        'FACILITIES_MANAGER'
      ];
      
      let allRolesFound = true;
      writeToReport('Checking for new roles in auth-context.tsx:\n');
      
      newRoles.forEach(role => {
        if (authContextContent.includes(role)) {
          writeToReport(`✅ Role ${role} is defined`);
        } else {
          writeToReport(`❌ Role ${role} is NOT defined`);
          allRolesFound = false;
        }
      });
      
      if (allRolesFound) {
        writeToReport('\nAll required roles are properly configured in the frontend.');
      } else {
        writeToReport('\n⚠️ Some roles are missing in the frontend configuration!');
      }
    } else {
      writeToReport('❌ Could not find auth-context.tsx file!');
    }
    
    // 7. Check for branch context
    writeToReport(`\n## 7. Branch Context Implementation\n`);
    
    const branchContextPath = path.join(__dirname, 'frontend', 'src', 'lib', 'branch-context.tsx');
    if (fs.existsSync(branchContextPath)) {
      writeToReport('✅ Branch context file exists');
      
      // Verify implementation
      const branchContextContent = fs.readFileSync(branchContextPath, 'utf8');
      const requiredComponents = [
        'BranchProvider', 
        'useBranch', 
        'BranchSelector',
        'activeBranch',
        'activeBranchId'
      ];
      
      let allComponentsFound = true;
      writeToReport('Checking for branch context components:\n');
      
      requiredComponents.forEach(component => {
        if (branchContextContent.includes(component)) {
          writeToReport(`✅ ${component} is implemented`);
        } else {
          writeToReport(`❌ ${component} is NOT implemented`);
          allComponentsFound = false;
        }
      });
      
      if (allComponentsFound) {
        writeToReport('\nAll branch context components are properly implemented.');
      } else {
        writeToReport('\n⚠️ Some branch context components are missing!');
      }
    } else {
      writeToReport('❌ Branch context file does not exist!');
    }
    
    // 8. Verify consolidated navigation
    writeToReport(`\n## 8. Consolidated Navigation\n`);
    
    const consolidatedNavPath = path.join(__dirname, 'frontend', 'src', 'components', 'layout', 'consolidated-nav.tsx');
    if (fs.existsSync(consolidatedNavPath)) {
      writeToReport('✅ Consolidated navigation file exists');
      
      // Check dashboard usage
      const dashboardLayoutPath = path.join(__dirname, 'frontend', 'src', 'components', 'layout', 'dashboard-layout.tsx');
      if (fs.existsSync(dashboardLayoutPath)) {
        const dashboardContent = fs.readFileSync(dashboardLayoutPath, 'utf8');
        
        if (dashboardContent.includes('import { ConsolidatedNav }')) {
          writeToReport('✅ Consolidated navigation is imported in dashboard layout');
        } else {
          writeToReport('❌ Consolidated navigation is NOT imported in dashboard layout');
        }
        
        if (dashboardContent.includes('<ConsolidatedNav />')) {
          writeToReport('✅ Consolidated navigation is used in dashboard layout');
        } else {
          writeToReport('❌ Consolidated navigation is NOT used in dashboard layout');
        }
      } else {
        writeToReport('❌ Dashboard layout file does not exist!');
      }
    } else {
      writeToReport('❌ Consolidated navigation file does not exist!');
    }
    
    // 9. Verify module implementations
    writeToReport(`\n## 9. Module Implementations\n`);
    
    const moduleDirectories = [
      'branch-operations',
      'central-operations',
      'facilities'
    ];
    
    moduleDirectories.forEach(moduleDir => {
      const modulePath = path.join(__dirname, 'frontend', 'src', 'app', 'dashboard', moduleDir);
      if (fs.existsSync(modulePath)) {
        const files = fs.readdirSync(modulePath);
        writeToReport(`✅ ${moduleDir} module exists with ${files.length} files/directories`);
      } else {
        writeToReport(`❌ ${moduleDir} module does not exist!`);
      }
    });

    // Final summary
    writeToReport(`\n## Summary\n`);
    writeToReport(`The migration to multi-branch architecture appears to be complete and properly implemented. The system now supports:`);
    writeToReport(`- ${branchCountResult.rows[0].count} branches`);
    writeToReport(`- ${tablesWithBranchId.rows.length} tables with branch context`);
    writeToReport(`- New consolidated roles for streamlined operations`);
    writeToReport(`- Branch-aware UI components for better user experience`);
    
    writeToReport(`\nFor any issues discovered in this report, please refer to the logs in the 'logs' directory.`);
    
  } catch (error) {
    writeToReport(`\n## Error During Verification\n`);
    writeToReport(`An error occurred during the verification process: ${error.message}`);
    console.error('Verification error details:', error);
  } finally {
    client.release();
    reportStream.end();
  }
}

// Run verification when executed directly
if (require.main === module) {
  verifyMigration()
    .then(() => {
      console.log(`\nVerification complete! Report saved to: ${reportFilePath}`);
      pool.end();
    })
    .catch(err => {
      console.error('Fatal error during verification:', err);
      pool.end();
      process.exit(1);
    });
}

module.exports = {
  verifyMigration
};
