/**
 * API Routes Extractor Script
 * Scans all route files and extracts all API endpoints
 * Run with: node scripts/extract-api-routes.js
 */

const fs = require('fs');
const path = require('path');

const ROUTES = [];
const ROUTE_DIR = path.join(__dirname, '../src/routes');

function extractRoutesFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const fileRoutes = [];
  
  let currentPath = '';
  let currentMiddleware = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Extract router.use with path
    const routerUseMatch = line.match(/router\.use\(['"]([^'"]+)['"],\s*(\w+)?/);
    if (routerUseMatch) {
      currentPath = routerUseMatch[1];
      if (routerUseMatch[2]) {
        currentMiddleware.push(routerUseMatch[2]);
      }
    }
    
    // Extract route definitions
    const routeMatch = line.match(/router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"],\s*(\w+)/);
    if (routeMatch) {
      const method = routeMatch[1].toUpperCase();
      const endpoint = routeMatch[2];
      const handler = routeMatch[3];
      
      fileRoutes.push({
        method,
        path: currentPath + endpoint,
        handler,
        file: path.basename(filePath)
      });
    }
    
    // Extract nested router paths
    const nestedMatch = line.match(/router\.use\(['"]([^'"]+)['"],\s*(\w+\.routes)/);
    if (nestedMatch) {
      currentPath = nestedMatch[1];
    }
  }
  
  return fileRoutes;
}

function scanDirectory(dir, basePath = '') {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      scanDirectory(filePath, basePath + '/' + file);
    } else if (file.endsWith('.routes.ts') || file.endsWith('.route.ts')) {
      const routes = extractRoutesFromFile(filePath);
      ROUTES.push(...routes);
    }
  });
}

console.log('🔍 Scanning route files...\n');

// Scan main routes directory
if (fs.existsSync(ROUTE_DIR)) {
  scanDirectory(ROUTE_DIR);
}

// Also scan subdirectories
const subdirs = ['storekeeping', 'bar', 'kitchen', 'housekeeping'];
subdirs.forEach(subdir => {
  const subdirPath = path.join(ROUTE_DIR, subdir);
  if (fs.existsSync(subdirPath)) {
    scanDirectory(subdirPath);
  }
});

// Group routes by file
const routesByFile = {};
ROUTES.forEach(route => {
  if (!routesByFile[route.file]) {
    routesByFile[route.file] = [];
  }
  routesByFile[route.file].push(route);
});

// Sort routes alphabetically
const sortedFiles = Object.keys(routesByFile).sort();

console.log('='.repeat(80));
console.log('API ROUTES DOCUMENTATION');
console.log('='.repeat(80));
console.log(`Total Routes Found: ${ROUTES.length}\n`);

sortedFiles.forEach(file => {
  console.log(`\n📄 ${file}`);
  console.log('-'.repeat(80));
  routesByFile[file].forEach(route => {
    console.log(`  ${route.method.padEnd(6)} ${route.path.padEnd(50)} → ${route.handler}`);
  });
});

// Save to JSON
const output = {
  totalRoutes: ROUTES.length,
  routesByFile,
  allRoutes: ROUTES.sort((a, b) => a.path.localeCompare(b.path))
};

fs.writeFileSync(
  path.join(__dirname, '../api-routes.json'),
  JSON.stringify(output, null, 2)
);

console.log('\n' + '='.repeat(80));
console.log(`📄 Routes saved to: backend/api-routes.json`);
console.log('='.repeat(80));
