#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

let stats = {
  filesScanned: 0,
  filesModified: 0,
  queriesFixed: 0,
  errors: []
};

/**
 * Add error handling to a Supabase query
 */
function addErrorHandling(content, filePath) {
  let modified = false;
  let newContent = content;
  
  // Split into lines for easier processing
  const lines = newContent.split('\n');
  const newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    newLines.push(line);
    
    // Pattern 1: const { data } = await supabase.from('table')...
    // Pattern 2: const { data, count } = await supabase.from('table')...
    // Pattern 3: const result = await supabase.from('table')...
    const supabaseQueryMatch = line.match(/^\s*(const|let|var)\s+(\{[^}]+\}|\w+)\s*=\s*await\s+supabase\.(from|auth|rpc|storage)/);
    
    // Pattern 4: await supabase.from('table').update()... (no assignment)
    // BUT: Skip if line ends with incomplete statement like .insert({ or .update({
    const noAssignmentMatch = line.match(/^\s*await\s+supabase\.(from|auth|rpc|storage)/);
    const isIncomplete = line.trim().endsWith('({') || line.trim().endsWith('(');
    
    if (supabaseQueryMatch) {
      const indent = line.match(/^\s*/)[0];
      const destructure = supabaseQueryMatch[2];
      
      // Check if next few lines already have error handling
      let hasErrorHandling = false;
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j].includes('if (error)') || lines[j].includes('if(error)') || 
            lines[j].includes('if (!error)') || lines[j].includes('if(!error)')) {
          hasErrorHandling = true;
          break;
        }
      }
      
      if (!hasErrorHandling) {
        // Check if destructuring includes 'error'
        if (destructure.includes('error')) {
          // Already destructures error, just add the check
          newLines.push(`${indent}if (error) {`);
          newLines.push(`${indent}  console.error('Database error:', error);`);
          newLines.push(`${indent}  throw error;`);
          newLines.push(`${indent}}`);
          modified = true;
          stats.queriesFixed++;
        } else if (destructure.startsWith('{')) {
          // Destructuring without error - add error to destructure
          const newDestructure = destructure.replace('}', ', error }');
          newLines[newLines.length - 1] = line.replace(destructure, newDestructure);
          newLines.push(`${indent}if (error) {`);
          newLines.push(`${indent}  console.error('Database error:', error);`);
          newLines.push(`${indent}  throw error;`);
          newLines.push(`${indent}}`);
          modified = true;
          stats.queriesFixed++;
        } else {
          // Variable assignment - check .error property
          newLines.push(`${indent}if (${destructure}.error) {`);
          newLines.push(`${indent}  console.error('Database error:', ${destructure}.error);`);
          newLines.push(`${indent}  throw ${destructure}.error;`);
          newLines.push(`${indent}}`);
          modified = true;
          stats.queriesFixed++;
        }
      }
    } else if (noAssignmentMatch && !line.includes('//') && !isIncomplete) {
      // Query without assignment - need to add error handling
      // Skip if it's a multi-line statement (incomplete)
      const indent = line.match(/^\s*/)[0];
      
      // Check if next few lines already have error handling
      let hasErrorHandling = false;
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j].includes('if (error)') || lines[j].includes('if(error)')) {
          hasErrorHandling = true;
          break;
        }
      }
      
      if (!hasErrorHandling) {
        // Replace the line to capture the result
        const newLine = line.replace(/^\s*await\s+/, `${indent}const { error } = await `);
        newLines[newLines.length - 1] = newLine;
        newLines.push(`${indent}if (error) {`);
        newLines.push(`${indent}  console.error('Database error:', error);`);
        newLines.push(`${indent}  throw error;`);
        newLines.push(`${indent}}`);
        modified = true;
        stats.queriesFixed++;
      }
    }
  }
  
  if (modified) {
    newContent = newLines.join('\n');
  }
  
  return { modified, content: newContent };
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    stats.filesScanned++;
    
    // Skip if file doesn't contain supabase queries
    if (!content.includes('supabase.from(')) {
      return;
    }
    
    const result = addErrorHandling(content, filePath);
    
    if (result.modified) {
      // Create backup
      fs.writeFileSync(filePath + '.backup', content);
      
      // Write modified content
      fs.writeFileSync(filePath, result.content);
      
      stats.filesModified++;
      console.log(`${colors.green}✓ Fixed ${filePath}${colors.reset}`);
    }
    
  } catch (error) {
    stats.errors.push({ file: filePath, error: error.message });
    console.error(`${colors.red}✗ Error processing ${filePath}: ${error.message}${colors.reset}`);
  }
}

/**
 * Recursively scan directory
 */
function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip node_modules, .next, .git, dist
    if (entry.name === 'node_modules' || entry.name === '.next' || 
        entry.name === '.git' || entry.name === 'dist' || entry.name === '.backup') {
      continue;
    }
    
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js'))) {
      processFile(fullPath);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log(`${colors.cyan}${colors.bold}╔══════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}║     ADDING ERROR HANDLING TO ALL QUERIES            ║${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}║     Fixing 264 NO_ERROR_CHECK Errors                ║${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}╚══════════════════════════════════════════════════════╝${colors.reset}\n`);
  
  const startTime = Date.now();
  
  console.log(`${colors.blue}📁 Scanning backend directory...${colors.reset}\n`);
  scanDirectory(path.join(projectRoot, 'backend'));
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log(`\n${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}Files scanned: ${stats.filesScanned}${colors.reset}`);
  console.log(`${colors.green}Files modified: ${stats.filesModified}${colors.reset}`);
  console.log(`${colors.green}Queries fixed: ${stats.queriesFixed}${colors.reset}`);
  console.log(`${colors.red}Errors: ${stats.errors.length}${colors.reset}`);
  console.log(`${colors.cyan}Time: ${duration}s${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════${colors.reset}\n`);
  
  if (stats.errors.length > 0) {
    console.log(`${colors.yellow}Errors encountered:${colors.reset}`);
    stats.errors.forEach(e => console.log(`  ${e.file}: ${e.error}`));
  }
  
  console.log(`${colors.yellow}📋 NEXT STEPS:${colors.reset}`);
  console.log(`   1. Review the changes in modified files`);
  console.log(`   2. Run: node scripts/schema-audit.mjs`);
  console.log(`   3. Verify HIGH errors reduced to ~0`);
  console.log(`   4. Test the application`);
  console.log(`   5. If issues, restore from .backup files\n`);
}

main().catch(console.error);
