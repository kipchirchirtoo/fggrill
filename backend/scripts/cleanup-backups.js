/**
 * Cleanup Backup Files Script
 * Removes .backup and .backup2 files from the codebase
 * Run with: node scripts/cleanup-backups.js
 */

const fs = require('fs');
const path = require('path');

let deletedCount = 0;
let skippedCount = 0;

function cleanDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and .git
      if (file !== 'node_modules' && file !== '.git' && file !== '.next') {
        cleanDirectory(filePath);
      }
    } else if (file.endsWith('.backup') || file.endsWith('.backup2')) {
      try {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`🗑️  Deleted: ${filePath}`);
      } catch (error) {
        console.error(`❌ Failed to delete ${filePath}:`, error.message);
        skippedCount++;
      }
    }
  });
}

console.log('🧹 Starting backup file cleanup...\n');

// Start from backend/src directory
const srcDir = path.join(__dirname, '../src');
if (fs.existsSync(srcDir)) {
  cleanDirectory(srcDir);
}

console.log('\n' + '='.repeat(60));
console.log('CLEANUP SUMMARY');
console.log('='.repeat(60));
console.log(`✅ Deleted: ${deletedCount} backup files`);
console.log(`⚠️  Skipped: ${skippedCount} files (errors)`);
console.log('\nBackup files have been removed from the codebase.');
