#!/usr/bin/env node

/**
 * Multi-Branch Architecture Migration Master Script
 * 
 * This script orchestrates the complete migration to multi-branch architecture:
 * 1. Run database schema enhancements for multi-branch support
 * 2. Add branch_id column to all relevant tables
 * 3. Migrate users to consolidated roles
 * 4. Set up branch access permissions
 */

const { execSync } = require('child_process');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const readline = require('readline');

// Load environment variables
dotenv.config();

// Import migration modules
const addBranchIdToTables = require('./backend/scripts/add_branch_id_to_tables');
const migrateUserRoles = require('./backend/scripts/migrate_user_roles');

// Create log directory if it doesn't exist
const logDir = path.resolve(__dirname, './logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Create master log file with timestamp
const logFilePath = path.join(logDir, `master_migration_${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  logStream.write(formattedMessage + '\n');
}

// Create interactive prompt
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function runMigrationWithConfirmation(step, fn) {
  log(`\n====== Step ${step.number}: ${step.name} ======`);
  log(`Description: ${step.description}`);
  
  const answer = await prompt(`Run this step? (yes/no/skip) `);
  
  if (answer.toLowerCase() === 'skip') {
    log(`Skipping step ${step.number}...`);
    return { success: true, skipped: true };
  }
  
  if (answer.toLowerCase() !== 'yes') {
    log(`Aborted step ${step.number}...`);
    return { success: false, aborted: true };
  }
  
  log(`Starting step ${step.number}...`);
  try {
    const result = await fn();
    log(`Step ${step.number} ${result.success ? 'succeeded' : 'failed'}`);
    return result;
  } catch (error) {
    log(`Step ${step.number} failed with error: ${error.message}`);
    console.error(`Error details for step ${step.number}:`, error);
    return { success: false, error: error.message };
  }
}

async function runMigrationProcess() {
  log('====== Starting Migration to Multi-Branch Architecture ======');
  log(`Date: ${new Date().toISOString()}`);

  const steps = [
    {
      number: 1,
      name: 'Run Schema Enhancements',
      description: 'Apply SQL migrations for multi-branch architecture',
      action: async () => {
        try {
          log('Running SQL schema enhancement migration...');
          execSync('node run_branch_migration.js', { stdio: 'inherit' });
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    },
    {
      number: 2,
      name: 'Add Branch ID to Tables',
      description: 'Add branch_id column to all relevant tables and set up foreign key constraints',
      action: async () => {
        return await addBranchIdToTables.updateAllTables();
      }
    },
    {
      number: 3,
      name: 'Migrate User Roles',
      description: 'Update users to the new consolidated roles and set up branch access permissions',
      action: async () => {
        return await migrateUserRoles.executeAllMigrations();
      }
    },
    {
      number: 4,
      name: 'Update Frontend Configuration',
      description: 'Update frontend environment variables for multi-branch support',
      action: async () => {
        try {
          log('Updating frontend environment variables...');
          
          // Check if .env.local exists
          const envPath = path.join(__dirname, 'frontend', '.env.local');
          let envContent = '';
          
          if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
          }
          
          // Add or update the multi-branch feature flag
          if (!envContent.includes('NEXT_PUBLIC_ENABLE_MULTI_BRANCH')) {
            envContent += '\n# Multi-branch feature flag\nNEXT_PUBLIC_ENABLE_MULTI_BRANCH=true\n';
          } else {
            envContent = envContent.replace(
              /NEXT_PUBLIC_ENABLE_MULTI_BRANCH=(true|false)/,
              'NEXT_PUBLIC_ENABLE_MULTI_BRANCH=true'
            );
          }
          
          fs.writeFileSync(envPath, envContent);
          log('Frontend environment updated successfully.');
          
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    }
  ];

  let allSuccessful = true;
  let stepResults = [];

  for (const step of steps) {
    const result = await runMigrationWithConfirmation(step, step.action);
    stepResults.push({ step, result });
    
    if (!result.success && !result.skipped && !result.aborted) {
      allSuccessful = false;
      const continueAfterFail = await prompt('Step failed. Continue with next step? (yes/no) ');
      if (continueAfterFail.toLowerCase() !== 'yes') {
        log('Migration aborted due to step failure.');
        break;
      }
    }
  }

  // Close readline interface
  rl.close();

  // Log final summary
  log('\n====== Migration Summary ======');
  for (const { step, result } of stepResults) {
    const status = result.skipped ? 'SKIPPED' : 
                  result.aborted ? 'ABORTED' :
                  result.success ? 'SUCCESS' : 'FAILED';
    log(`Step ${step.number}: ${step.name} - ${status}`);
  }
  
  log(`\nOverall migration ${allSuccessful ? 'SUCCESSFUL' : 'COMPLETED WITH ERRORS'}`);
  log(`Check the log file for details: ${logFilePath}`);
  
  return {
    success: allSuccessful,
    steps: stepResults
  };
}

// Run the migration process when executed directly
if (require.main === module) {
  runMigrationProcess()
    .then(result => {
      if (result.success) {
        log('Migration process completed successfully!');
      } else {
        log('Migration process completed with errors. Check logs for details.');
      }
      logStream.end();
    })
    .catch(err => {
      log(`Fatal error in migration process: ${err.message}`);
      console.error('Error details:', err);
      logStream.end();
      process.exit(1);
    });
}

module.exports = {
  runMigrationProcess
};
