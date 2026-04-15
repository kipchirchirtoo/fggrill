#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Results storage
const results = {
  schema: { tables: {}, totalTables: 0 },
  apiCalls: [],
  supabaseQueries: [],
  zodSchemas: [],
  typeDefinitions: [],
  errors: {
    critical: [],
    high: [],
    medium: [],
    low: []
  },
  stats: {
    filesScanned: 0,
    filesSkipped: 0,
    queriesFound: 0,
    fetchCallsFound: 0,
    zodSchemasFound: 0,
    typeDefsFound: 0
  }
};

// ============================================
// MODULE A: Schema Extractor
// ============================================

function extractSchemaFromMigrations() {
  console.log(`${colors.blue}📊 Extracting schema from migration files...${colors.reset}`);
  
  const migrationsDir = path.join(projectRoot, 'backend/supabase/migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.log(`${colors.yellow}⚠ Migrations directory not found${colors.reset}`);
    return;
  }

  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${migrationFiles.length} migration files`);

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Extract CREATE TABLE statements
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\);/gi;
    let match;
    
    while ((match = createTableRegex.exec(content)) !== null) {
      const tableName = match[1];
      const tableBody = match[2];
      
      if (!results.schema.tables[tableName]) {
        results.schema.tables[tableName] = {
          name: tableName,
          columns: {},
          source: file
        };
        results.schema.totalTables++;
      }
      
      // Extract columns
      const columnLines = tableBody.split(',').map(l => l.trim());
      
      for (const line of columnLines) {
        // Skip constraints
        if (line.match(/^(CONSTRAINT|UNIQUE|PRIMARY|FOREIGN|CHECK)/i)) continue;
        
        // Parse column definition
        const colMatch = line.match(/^(\w+)\s+([\w\s()]+?)(?:\s+(NOT\s+NULL|NULL|DEFAULT|REFERENCES|PRIMARY|UNIQUE).*)?$/i);
        
        if (colMatch) {
          const colName = colMatch[1];
          const colType = colMatch[2].trim();
          const constraints = colMatch[3] || '';
          
          results.schema.tables[tableName].columns[colName] = {
            name: colName,
            type: colType,
            nullable: !constraints.includes('NOT NULL'),
            hasDefault: constraints.includes('DEFAULT'),
            isPrimaryKey: constraints.includes('PRIMARY KEY')
          };
        }
      }
    }
    
    // Extract ALTER TABLE ADD COLUMN statements
    const alterTableRegex = /ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+([\w\s()]+?)(?:\s+(NOT\s+NULL|NULL|DEFAULT|REFERENCES).*)?;/gi;
    
    while ((match = alterTableRegex.exec(content)) !== null) {
      const tableName = match[1];
      const colName = match[2];
      const colType = match[3].trim();
      const constraints = match[4] || '';
      
      if (!results.schema.tables[tableName]) {
        results.schema.tables[tableName] = {
          name: tableName,
          columns: {},
          source: file
        };
      }
      
      results.schema.tables[tableName].columns[colName] = {
        name: colName,
        type: colType,
        nullable: !constraints.includes('NOT NULL'),
        hasDefault: constraints.includes('DEFAULT'),
        isPrimaryKey: false
      };
    }
  }

  console.log(`${colors.green}✓ Extracted ${results.schema.totalTables} tables${colors.reset}`);
}

// ============================================
// MODULE B: API Call Extractor
// ============================================

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(projectRoot, filePath);
    
    results.stats.filesScanned++;
    
    // Extract Supabase queries
    extractSupabaseQueries(content, relativePath);
    
    // Extract fetch/axios calls
    extractFetchCalls(content, relativePath);
    
    // Extract Zod schemas
    extractZodSchemas(content, relativePath);
    
    // Extract TypeScript types
    extractTypeDefinitions(content, relativePath);
    
  } catch (err) {
    results.stats.filesSkipped++;
  }
}

function extractSupabaseQueries(content, filePath) {
  // Pattern: supabase.from('table_name')
  const fromRegex = /supabase\.from\(['"](\w+)['"]\)/g;
  let match;
  
  while ((match = fromRegex.exec(content)) !== null) {
    const tableName = match[1];
    const lineNumber = content.substring(0, match.index).split('\n').length;
    
    // Get the full query context (next 200 chars)
    const context = content.substring(match.index, match.index + 200);
    
    // Determine operation type
    let operation = 'select';
    if (context.includes('.insert(')) operation = 'insert';
    else if (context.includes('.update(')) operation = 'update';
    else if (context.includes('.delete(')) operation = 'delete';
    else if (context.includes('.upsert(')) operation = 'upsert';
    
    // Extract payload for insert/update
    let payload = null;
    if (operation === 'insert' || operation === 'update' || operation === 'upsert') {
      const payloadMatch = context.match(/\.(insert|update|upsert)\s*\(\s*(\{[\s\S]*?\}|\[[\s\S]*?\])/);
      if (payloadMatch) {
        payload = payloadMatch[2];
      }
    }
    
    // Check for branch_id filter
    const hasBranchFilter = context.includes('.eq(\'branch_id\'') || context.includes('.eq("branch_id"');
    
    // Check for error handling
    const hasErrorCheck = content.substring(match.index - 100, match.index + 300).includes('error');
    
    results.supabaseQueries.push({
      tableName,
      operation,
      filePath,
      lineNumber,
      payload,
      hasBranchFilter,
      hasErrorCheck,
      context: context.substring(0, 100)
    });
    
    results.stats.queriesFound++;
  }
}

function extractFetchCalls(content, filePath) {
  // Pattern: fetch('/api/...', { method: 'POST', body: ... })
  const fetchRegex = /fetch\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{([^}]+)\}/g;
  let match;
  
  while ((match = fetchRegex.exec(content)) !== null) {
    const url = match[1];
    const options = match[2];
    const lineNumber = content.substring(0, match.index).split('\n').length;
    
    const methodMatch = options.match(/method\s*:\s*['"](\w+)['"]/);
    const method = methodMatch ? methodMatch[1] : 'GET';
    
    // Check for Authorization header
    const hasAuthHeader = options.includes('Authorization') || options.includes('getHeaders');
    
    results.apiCalls.push({
      type: 'fetch',
      url,
      method,
      filePath,
      lineNumber,
      hasAuthHeader
    });
    
    results.stats.fetchCallsFound++;
  }
  
  // Pattern: axios.post/put/patch
  const axiosRegex = /axios\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  
  while ((match = axiosRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const url = match[2];
    const lineNumber = content.substring(0, match.index).split('\n').length;
    
    results.apiCalls.push({
      type: 'axios',
      url,
      method,
      filePath,
      lineNumber
    });
    
    results.stats.fetchCallsFound++;
  }
}

function extractZodSchemas(content, filePath) {
  // Pattern: z.object({ field: z.type() })
  const zodRegex = /const\s+(\w+)\s*=\s*z\.object\s*\(\s*\{([^}]+)\}/g;
  let match;
  
  while ((match = zodRegex.exec(content)) !== null) {
    const schemaName = match[1];
    const fields = match[2];
    const lineNumber = content.substring(0, match.index).split('\n').length;
    
    // Extract field names
    const fieldMatches = fields.matchAll(/(\w+)\s*:/g);
    const fieldNames = Array.from(fieldMatches).map(m => m[1]);
    
    results.zodSchemas.push({
      name: schemaName,
      fields: fieldNames,
      filePath,
      lineNumber
    });
    
    results.stats.zodSchemasFound++;
  }
}

function extractTypeDefinitions(content, filePath) {
  // Pattern: interface TableName { ... } or type TableName = { ... }
  const typeRegex = /(interface|type)\s+(\w+)\s*(?:=\s*)?\{([^}]+)\}/g;
  let match;
  
  while ((match = typeRegex.exec(content)) !== null) {
    const typeName = match[2];
    const fields = match[3];
    const lineNumber = content.substring(0, match.index).split('\n').length;
    
    // Extract field names
    const fieldMatches = fields.matchAll(/(\w+)\s*[?:]?\s*:/g);
    const fieldNames = Array.from(fieldMatches).map(m => m[1]);
    
    results.typeDefinitions.push({
      name: typeName,
      fields: fieldNames,
      filePath,
      lineNumber
    });
    
    results.stats.typeDefsFound++;
  }
}

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip node_modules, .next, .git, dist
    if (entry.name === 'node_modules' || entry.name === '.next' || 
        entry.name === '.git' || entry.name === 'dist') {
      continue;
    }
    
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js'))) {
      scanFile(fullPath);
    }
  }
}

// ============================================
// MODULE C: Cross-Reference Engine
// ============================================

const BRANCH_SCOPED_TABLES = [
  'staff_profiles', 'staff_schedules', 'staff_leave', 'staff_payroll', 'staff_performance',
  'bookings', 'restaurant_orders', 'bar_orders', 'finance_transactions', 'expenses',
  'hk_tasks', 'staff_attendance', 'simple_items', 'cashier_transactions',
  'rooms', 'inventory_items', 'menu_items', 'shifts', 'store_items'
];

function crossReference() {
  console.log(`\n${colors.blue}🔍 Cross-referencing API calls against schema...${colors.reset}`);
  
  // Check each Supabase query
  for (const query of results.supabaseQueries) {
    const table = results.schema.tables[query.tableName];
    
    // CHECK 1: Table doesn't exist
    if (!table) {
      results.errors.critical.push({
        id: 'TABLE_NOT_EXIST',
        severity: 'CRITICAL',
        description: `Query references table "${query.tableName}" which does not exist in schema`,
        filePath: query.filePath,
        lineNumber: query.lineNumber,
        tableName: query.tableName,
        fix: `Check table name spelling or create the table in migrations`
      });
      continue;
    }
    
    // CHECK 2: Missing branch_id filter on branch-scoped tables
    if (BRANCH_SCOPED_TABLES.includes(query.tableName) && 
        query.operation === 'select' && 
        !query.hasBranchFilter) {
      results.errors.high.push({
        id: 'MISSING_BRANCH_SCOPE',
        severity: 'HIGH',
        description: `SELECT on branch-scoped table "${query.tableName}" missing .eq('branch_id', ...) filter`,
        filePath: query.filePath,
        lineNumber: query.lineNumber,
        tableName: query.tableName,
        fix: `Add .eq('branch_id', userBranchId) to the query`
      });
    }
    
    // CHECK 3: No error handling
    if (!query.hasErrorCheck) {
      results.errors.high.push({
        id: 'NO_ERROR_CHECK',
        severity: 'HIGH',
        description: `Supabase query without error handling`,
        filePath: query.filePath,
        lineNumber: query.lineNumber,
        tableName: query.tableName,
        fix: `Destructure { data, error } and check if (error) before using data`
      });
    }
    
    // CHECK 4: Payload field validation (for insert/update)
    if (query.payload && table) {
      const payloadFields = extractFieldsFromPayload(query.payload);
      
      for (const field of payloadFields) {
        if (!table.columns[field]) {
          results.errors.critical.push({
            id: 'COL_NOT_EXIST',
            severity: 'CRITICAL',
            description: `Payload contains field "${field}" which does not exist in table "${query.tableName}"`,
            filePath: query.filePath,
            lineNumber: query.lineNumber,
            tableName: query.tableName,
            field: field,
            availableColumns: Object.keys(table.columns).join(', '),
            fix: `Remove "${field}" from payload or add column to table schema`
          });
        }
      }
      
      // CHECK 5: Missing required fields (for insert)
      if (query.operation === 'insert') {
        const requiredColumns = Object.values(table.columns)
          .filter(col => !col.nullable && !col.hasDefault && 
                        col.name !== 'id' && col.name !== 'created_at' && col.name !== 'updated_at')
          .map(col => col.name);
        
        const missingRequired = requiredColumns.filter(col => !payloadFields.includes(col));
        
        if (missingRequired.length > 0) {
          results.errors.critical.push({
            id: 'MISSING_REQUIRED',
            severity: 'CRITICAL',
            description: `INSERT missing required columns: ${missingRequired.join(', ')}`,
            filePath: query.filePath,
            lineNumber: query.lineNumber,
            tableName: query.tableName,
            missingFields: missingRequired,
            fix: `Add these required fields to the insert payload: ${missingRequired.join(', ')}`
          });
        }
      }
    }
  }
  
  // CHECK 6: getSession() usage
  for (const query of results.supabaseQueries) {
    const fileContent = fs.readFileSync(path.join(projectRoot, query.filePath), 'utf8');
    if (fileContent.includes('.auth.getSession()')) {
      results.errors.critical.push({
        id: 'INSECURE_GETSESSION',
        severity: 'CRITICAL',
        description: `Using getSession() instead of getUser() - security vulnerability`,
        filePath: query.filePath,
        lineNumber: query.lineNumber,
        fix: `Replace .auth.getSession() with .auth.getUser()`
      });
    }
  }
  
  // CHECK 7: Missing auth headers on API calls
  for (const call of results.apiCalls) {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(call.method) && !call.hasAuthHeader) {
      results.errors.high.push({
        id: 'MISSING_AUTH_HEADER',
        severity: 'HIGH',
        description: `${call.method} request to ${call.url} missing Authorization header`,
        filePath: call.filePath,
        lineNumber: call.lineNumber,
        fix: `Add Authorization: Bearer \${token} header to the request`
      });
    }
  }
}

function extractFieldsFromPayload(payload) {
  // Simple extraction of field names from object literal
  const fields = [];
  const fieldRegex = /(\w+)\s*:/g;
  let match;
  
  while ((match = fieldRegex.exec(payload)) !== null) {
    fields.push(match[1]);
  }
  
  return fields;
}

// ============================================
// MODULE D: Report Generator
// ============================================

function generateReport() {
  console.log(`\n${colors.bold}╔══════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}║     FAMOUSGATES SCHEMA AUDIT REPORT                  ║${colors.reset}`);
  console.log(`${colors.bold}║     Generated: ${new Date().toISOString().substring(0, 19).replace('T', ' ')}                   ║${colors.reset}`);
  console.log(`${colors.bold}╚══════════════════════════════════════════════════════╝${colors.reset}\n`);
  
  console.log(`Tables found in schema: ${results.schema.totalTables}`);
  console.log(`Files scanned: ${results.stats.filesScanned}`);
  console.log(`Supabase queries found: ${results.stats.queriesFound}`);
  console.log(`Fetch/Axios calls found: ${results.stats.fetchCallsFound}`);
  console.log(`Zod schemas found: ${results.stats.zodSchemasFound}`);
  console.log(`TypeScript types found: ${results.stats.typeDefsFound}`);
  
  // Critical errors
  if (results.errors.critical.length > 0) {
    console.log(`\n${colors.red}${colors.bold}═══════════════════════════════════${colors.reset}`);
    console.log(`${colors.red}${colors.bold}🔴 CRITICAL ERRORS (fix immediately)${colors.reset}`);
    console.log(`${colors.red}${colors.bold}═══════════════════════════════════${colors.reset}\n`);
    
    results.errors.critical.slice(0, 20).forEach((err, idx) => {
      console.log(`${colors.red}[${err.id}] ${err.filePath}:${err.lineNumber}${colors.reset}`);
      console.log(`  ${err.description}`);
      if (err.tableName) console.log(`  Table: ${err.tableName}`);
      if (err.field) console.log(`  Field: ${err.field}`);
      if (err.availableColumns) console.log(`  Available: ${err.availableColumns}`);
      console.log(`  ${colors.green}FIX: ${err.fix}${colors.reset}\n`);
    });
    
    if (results.errors.critical.length > 20) {
      console.log(`${colors.yellow}... and ${results.errors.critical.length - 20} more critical errors${colors.reset}\n`);
    }
  }
  
  // High severity errors
  if (results.errors.high.length > 0) {
    console.log(`${colors.yellow}${colors.bold}═══════════════════════════════════${colors.reset}`);
    console.log(`${colors.yellow}${colors.bold}🟠 HIGH SEVERITY ERRORS${colors.reset}`);
    console.log(`${colors.yellow}${colors.bold}═══════════════════════════════════${colors.reset}\n`);
    
    results.errors.high.slice(0, 15).forEach((err, idx) => {
      console.log(`${colors.yellow}[${err.id}] ${err.filePath}:${err.lineNumber}${colors.reset}`);
      console.log(`  ${err.description}`);
      if (err.tableName) console.log(`  Table: ${err.tableName}`);
      console.log(`  ${colors.green}FIX: ${err.fix}${colors.reset}\n`);
    });
    
    if (results.errors.high.length > 15) {
      console.log(`${colors.yellow}... and ${results.errors.high.length - 15} more high severity errors${colors.reset}\n`);
    }
  }
  
  // Summary
  console.log(`${colors.bold}═══════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}📊 SUMMARY${colors.reset}`);
  console.log(`${colors.bold}═══════════════════════════════════${colors.reset}`);
  console.log(`${colors.red}CRITICAL:  ${results.errors.critical.length} errors${colors.reset}`);
  console.log(`${colors.yellow}HIGH:      ${results.errors.high.length} errors${colors.reset}`);
  console.log(`${colors.blue}MEDIUM:    ${results.errors.medium.length} errors${colors.reset}`);
  console.log(`${colors.bold}TOTAL:     ${results.errors.critical.length + results.errors.high.length + results.errors.medium.length} errors${colors.reset}\n`);
  
  // Write markdown report
  writeMarkdownReport();
  
  // Write JSON report
  writeJSONReport();
}

function writeMarkdownReport() {
  let md = `# FamousGates Schema Audit Report\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += `## Summary\n\n`;
  md += `- **Tables in schema:** ${results.schema.totalTables}\n`;
  md += `- **Files scanned:** ${results.stats.filesScanned}\n`;
  md += `- **Supabase queries found:** ${results.stats.queriesFound}\n`;
  md += `- **API calls found:** ${results.stats.fetchCallsFound}\n`;
  md += `- **Zod schemas found:** ${results.stats.zodSchemasFound}\n`;
  md += `- **TypeScript types found:** ${results.stats.typeDefsFound}\n\n`;
  
  md += `## Error Summary\n\n`;
  md += `| Severity | Count |\n`;
  md += `|----------|-------|\n`;
  md += `| 🔴 CRITICAL | ${results.errors.critical.length} |\n`;
  md += `| 🟠 HIGH | ${results.errors.high.length} |\n`;
  md += `| 🟡 MEDIUM | ${results.errors.medium.length} |\n`;
  md += `| **TOTAL** | **${results.errors.critical.length + results.errors.high.length + results.errors.medium.length}** |\n\n`;
  
  if (results.errors.critical.length > 0) {
    md += `## 🔴 Critical Errors\n\n`;
    results.errors.critical.forEach((err, idx) => {
      md += `### ${idx + 1}. [${err.id}] ${err.filePath}:${err.lineNumber}\n\n`;
      md += `**Description:** ${err.description}\n\n`;
      if (err.tableName) md += `**Table:** ${err.tableName}\n\n`;
      if (err.field) md += `**Field:** ${err.field}\n\n`;
      if (err.availableColumns) md += `**Available Columns:** ${err.availableColumns}\n\n`;
      md += `**Fix:** ${err.fix}\n\n`;
      md += `---\n\n`;
    });
  }
  
  if (results.errors.high.length > 0) {
    md += `## 🟠 High Severity Errors\n\n`;
    results.errors.high.forEach((err, idx) => {
      md += `### ${idx + 1}. [${err.id}] ${err.filePath}:${err.lineNumber}\n\n`;
      md += `**Description:** ${err.description}\n\n`;
      if (err.tableName) md += `**Table:** ${err.tableName}\n\n`;
      md += `**Fix:** ${err.fix}\n\n`;
      md += `---\n\n`;
    });
  }
  
  fs.writeFileSync(path.join(projectRoot, 'schema-audit-report.md'), md);
  console.log(`${colors.green}✓ Full report written to: schema-audit-report.md${colors.reset}`);
}

function writeJSONReport() {
  fs.writeFileSync(
    path.join(projectRoot, 'schema-audit-report.json'),
    JSON.stringify(results, null, 2)
  );
  console.log(`${colors.green}✓ JSON report written to: schema-audit-report.json${colors.reset}`);
}

// ============================================
// Main Execution
// ============================================

async function main() {
  console.log(`${colors.cyan}${colors.bold}Starting FamousGates Schema Audit...${colors.reset}\n`);
  
  const startTime = Date.now();
  
  // Step 1: Extract schema
  extractSchemaFromMigrations();
  
  // Step 2: Scan all files
  console.log(`\n${colors.blue}📁 Scanning project files...${colors.reset}`);
  scanDirectory(path.join(projectRoot, 'backend'));
  scanDirectory(path.join(projectRoot, 'frontend'));
  
  console.log(`${colors.green}✓ Scanned ${results.stats.filesScanned} files${colors.reset}`);
  
  // Step 3: Cross-reference
  crossReference();
  
  // Step 4: Generate report
  generateReport();
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n${colors.cyan}Audit completed in ${duration}s${colors.reset}\n`);
  
  // Exit with error code if critical errors found
  if (results.errors.critical.length > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
