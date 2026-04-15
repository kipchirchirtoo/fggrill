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
 * Add error handling to multi-line Supabase queries
 */
function addErrorHandlingAdvanced(content, filePath) {
  let modified = false;
  let newContent = content;
  
  // Pattern 1: Multi-line insert/update/delete without assignment
  // await supabase.from('table').insert({
  //   field: value
  // });
  const multiLinePattern = /(\s*)(await\s+supabase\.(?:from\([^)]+\)|auth|rpc\([^)]+\)|storage)\.(?:insert|update|upsert|delete)\([^;]*?\);)/gs;
  
  const matches = [...content.matchAll(multiLinePattern)];
  
  for (const match of matches) {
    const indent = match[1];
    const fullQuery = match[2];
    
    // Check if already has error handling nearby
    const startIndex = match.index;
    const beforeContext = content.substring(Math.max(0, startIndex - 200), startIndex);
    const afterContext = content.substring(startIndex, startIndex + fullQuery.length + 200);
    
    if (afterContext.includes('if (error)') || afterContext.includes('if(error)') ||
        beforeContext.includes('const { error }') || beforeContext.includes('const {error}')) {
      continue; // Already has error handling
    }
    
    // Replace await with const { error } = await
    const newQuery = fullQuery.replace(/^await\s+/, 'const { error } = await ');
    const errorCheck = `\n${indent}if (error) {\n${indent}  console.error('Database error:', error);\n${indent}  throw error;\n${indent}}`;
    
    newContent = newContent.replace(fullQuery, newQuery + errorCheck);
    modified = true;
    stats.queriesFixed++;
  }
  
  // Pattern 2: Multi-line queries with assignment but no error destructuring
  // const result = await supabase.from('table').insert({
  //   field: value
  // });
  const assignmentPattern = /(const|let|var)\s+(\w+)\s*=\s*(await\s+supabase\.(?:from\([^)]+\)|auth|rpc\([^)]+\)|storage)[^;]*?;)/gs;
  
  const assignmentMatches = [...newContent.matchAll(assignmentPattern)];
  
  for (const match of assignmentMatches) {
    const varName = match[2];
    const fullStatement = match[0];
    const startIndex = match.index;
    
    // Check if already has error handling
    const afterContext = newContent.substring(startIndex, startIndex + fullStatement.length + 200);
    
    if (afterContext.includes('if (error)') || afterContext.includes('if(error)') ||
        afterContext.includes(`if (${varName}.error)`) || afterContext.includes(`if(${varName}.error)`)) {
      continue;
    }
    
    // Add error check after the statement
    const indent = match[0].match(/^\s*/)[0];
    const errorCheck = `\n${indent}if (${varName}.error) {\n${indent}  console.error('Database error:', ${varName}.error);\n${indent}  throw ${varName}.error;\n${indent}}`;
    
    newContent = newContent.replace(fullStatement, fullStatement + errorCheck);
    modified = true;
    stats.queriesFixed++;
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
    if (!content.includes('supabase.from(') && !content.includes('supabase.auth') && 
        !content.includes('supabase.rpc(') && !content.includes('supabase.storage')) {
      return;
    }
    
    const result = addErrorHandlingAdvanced(content, filePath);
    
    if (result.modified) {
      // Create backup
      fs.writeFileSync(filePath + '.backup2', content);
      
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
        entry.name === '.git' || entry.name === 'dist' || entry.name === '.backup' || entry.name === '.backup2') {
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
  console.log(`${colors.cyan}${colors.bold}║   FIXING REMAINING MULTI-LINE QUERIES               ║${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}║   Advanced Pattern Matching                        ║${colors.reset}`);
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
  console.log(`   1. Run: node scripts/schema-audit.mjs`);
  console.log(`   2. Verify errors reduced significantly`);
  console.log(`   3. Test the application`);
  console.log(`   4. If issues, restore from .backup2 files\n`);
}

main().catch(console.error);
