import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', 'build', 'dist', '.dart_tool'].includes(entry.name)) {
        walk(full, predicate, out);
      }
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function resolveRouteImport(fromFile, importPath) {
  const base = path.resolve(path.dirname(fromFile), importPath);
  const candidates = [
    `${base}.ts`,
    path.join(base, 'index.ts'),
  ];
  return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

function extractDefaultRouteImports(file) {
  const content = read(file);
  const imports = new Map();
  const importRe = /import\s+([A-Za-z0-9_]+)\s+from\s+['"`]([^'"`]+)['"`]/g;
  let importMatch;
  while ((importMatch = importRe.exec(content))) {
    const imported = resolveRouteImport(file, importMatch[2]);
    if (imported && imported.startsWith(path.join(root, 'backend/src/routes'))) {
      imports.set(importMatch[1], imported);
    }
  }
  return imports;
}

function extractBackendMounts() {
  const indexFile = path.join(root, 'backend/src/routes/index.ts');
  const content = read(indexFile);
  const imports = extractDefaultRouteImports(indexFile);
  const mounts = [];
  const re = /router\.use\(\s*['"`]([^'"`]+)['"`]\s*,\s*([A-Za-z0-9_]+)/g;
  let match;
  while ((match = re.exec(content))) {
    mounts.push({
      path: `/api${match[1]}`,
      router: match[2],
      file: imports.has(match[2]) ? path.relative(root, imports.get(match[2])) : null,
    });
  }
  return mounts;
}

function extractBackendRootRoutes() {
  const indexFile = path.join(root, 'backend/src/routes/index.ts');
  const content = read(indexFile);
  const routes = [];
  const re = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = re.exec(content))) {
    routes.push({
      method: match[1].toUpperCase(),
      path: `/api${match[2]}`,
      file: 'backend/src/routes/index.ts',
    });
  }
  return routes;
}

function extractBackendRoutes() {
  const files = walk(
    path.join(root, 'backend/src/routes'),
    file => file.endsWith('.ts'),
  );
  const routes = [];
  const directRe = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  const chainedRe = /router\s*\.\s*route\(\s*['"`]([^'"`]+)['"`]\s*\)((?:\s*\.\s*(?:get|post|put|patch|delete)\s*\([^;]+)+)/g;
  const methodRe = /\.(get|post|put|patch|delete)\s*\(/g;
  for (const file of files) {
    const content = read(file);
    let match;
    while ((match = directRe.exec(content))) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file: path.relative(root, file),
      });
    }
    while ((match = chainedRe.exec(content))) {
      const routePath = match[1];
      const chain = match[2];
      let methodMatch;
      while ((methodMatch = methodRe.exec(chain))) {
        routes.push({
          method: methodMatch[1].toUpperCase(),
          path: routePath,
          file: path.relative(root, file),
        });
      }
    }
  }
  return routes;
}

function extractFlutterEndpoints() {
  const files = walk(
    path.join(root, 'famous_gates_app/lib'),
    file => file.endsWith('.dart'),
  );
  const endpoints = [];
  const patterns = [
    /\.(?:get|post|put|patch|delete|getRaw|postRaw|putRaw|patchRaw|deleteRaw)\(\s*['"`](\/[^'"`]+)['"`]/g,
    /endpoint:\s*['"`](\/[^'"`]+)['"`]/g,
    /submitAction\(\s*['"`](?:GET|POST|PUT|PATCH|DELETE)['"`]\s*,\s*['"`](\/[^'"`]+)['"`]/g,
  ];
  for (const file of files) {
    const content = read(file);
    for (const re of patterns) {
      let match;
      while ((match = re.exec(content))) {
        const lineStart = content.lastIndexOf('\n', match.index) + 1;
        const receiver = content.slice(lineStart, match.index);
        endpoints.push({
          endpoint: match[1],
          client: receiver.includes('_pythonDio') ? 'python' : 'node',
          file: path.relative(root, file),
        });
      }
    }
  }
  return endpoints;
}

function summarizeByPrefix(items, field) {
  const counts = new Map();
  for (const item of items) {
    let value = item[field] || '';
    value = value.split('?')[0].replace(/^\/api(?=\/)/, '');
    const parts = value.split('/').filter(Boolean);
    const prefix = parts.length ? `/${parts[0]}` : '/';
    counts.set(prefix, (counts.get(prefix) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([prefix, count]) => ({ prefix, count }))
    .sort((a, b) => b.count - a.count || a.prefix.localeCompare(b.prefix));
}

const backendMounts = extractBackendMounts();
const backendRootRoutes = extractBackendRootRoutes();
const backendRoutes = extractBackendRoutes();
const flutterEndpoints = extractFlutterEndpoints();

function cleanRoutePath(value) {
  return String(value || '')
    .split('?')[0]
    .replace(/^\/api(?=\/)/, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '') || '/';
}

function joinRoutePath(prefix, route) {
  const cleanPrefix = cleanRoutePath(prefix);
  const cleanRoute = cleanRoutePath(route);
  if (cleanRoute === '/') return cleanPrefix;
  if (cleanPrefix === '/') return cleanRoute;
  return `${cleanPrefix}${cleanRoute.startsWith('/') ? '' : '/'}${cleanRoute}`;
}

function routeToRegExp(routePath) {
  const escaped = cleanRoutePath(routePath)
    .split('/')
    .filter(Boolean)
    .map(segment => {
      if (
        segment.startsWith(':') ||
        segment.startsWith('$') ||
        segment.includes('${') ||
        segment === '*'
      ) {
        return '[^/]+';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return new RegExp(`^/${escaped}$`);
}

function isRouteWildcard(segment) {
  return (
    segment.startsWith(':') ||
    segment.startsWith('$') ||
    segment.includes('${') ||
    segment === '*'
  );
}

function routeMatchesEndpoint(routePath, endpointPath) {
  const routeSegments = cleanRoutePath(routePath).split('/').filter(Boolean);
  const endpointSegments = cleanRoutePath(endpointPath).split('/').filter(Boolean);
  if (routeSegments.length !== endpointSegments.length) return false;
  return routeSegments.every((segment, index) => {
    const endpointSegment = endpointSegments[index];
    return (
      segment === endpointSegment ||
      isRouteWildcard(segment) ||
      isRouteWildcard(endpointSegment)
    );
  });
}

function buildMountedBackendRoutes() {
  const byFile = new Map();
  for (const route of backendRoutes) {
    if (!byFile.has(route.file)) byFile.set(route.file, []);
    byFile.get(route.file).push(route);
  }

  const buildFromFile = (file, mountPath, ancestry = []) => {
    const absFile = path.isAbsolute(file) ? file : path.join(root, file);
    const relFile = path.relative(root, absFile);
    if (ancestry.includes(absFile)) return [];

    const content = read(absFile);
    const imports = extractDefaultRouteImports(absFile);
    const routes = [];

    for (const route of byFile.get(relFile) || []) {
      routes.push({
        method: route.method,
        path: joinRoutePath(mountPath, route.path),
        file: route.file,
        mount: cleanRoutePath(mountPath),
      });
    }

    const childMountRe = /router\.use\(\s*['"`]([^'"`]+)['"`]\s*,\s*([A-Za-z0-9_]+)/g;
    let childMatch;
    while ((childMatch = childMountRe.exec(content))) {
      const childFile = imports.get(childMatch[2]);
      if (!childFile) continue;
      routes.push(...buildFromFile(
        childFile,
        joinRoutePath(mountPath, childMatch[1]),
        [...ancestry, absFile],
      ));
    }

    return routes;
  };

  const mounted = [];
  mounted.push(...buildFromFile('backend/src/routes/index.ts', '/api'));

  return mounted;
}

function findUnmatchedFlutterEndpoints(mountedRoutes, endpoints) {
  const routePatterns = mountedRoutes.map(route => ({
    ...route,
    regex: routeToRegExp(route.path),
  }));
  const unmatched = [];
  const seen = new Set();

  for (const endpoint of endpoints.filter(endpoint => endpoint.client !== 'python')) {
    const pathOnly = cleanRoutePath(endpoint.endpoint);
    if (
      routePatterns.some(route =>
        route.regex.test(pathOnly) || routeMatchesEndpoint(route.path, pathOnly),
      )
    ) continue;
    const key = `${pathOnly}|${endpoint.file}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unmatched.push({ endpoint: pathOnly, file: endpoint.file });
  }

  return unmatched.sort((a, b) =>
    a.endpoint.localeCompare(b.endpoint) || a.file.localeCompare(b.file),
  );
}

const mountedBackendRoutes = buildMountedBackendRoutes();
const unmatchedFlutterEndpoints = findUnmatchedFlutterEndpoints(
  mountedBackendRoutes,
  flutterEndpoints,
);

const mountedPrefixes = new Set([
  ...backendMounts.map(m => m.path.replace(/^\/api/, '')),
  ...backendRootRoutes.map(r => r.path.replace(/^\/api/, '')),
]);
const flutterUnknownPrefixes = summarizeByPrefix(flutterEndpoints, 'endpoint')
  .filter(row => !mountedPrefixes.has(row.prefix));

const output = {
  generated_at: new Date().toISOString(),
  backend: {
    mount_count: backendMounts.length,
    root_route_count: backendRootRoutes.length,
    route_count: backendRoutes.length,
    mounted_route_count: mountedBackendRoutes.length,
    mounts: backendMounts,
    root_routes: backendRootRoutes,
    mounted_routes_sample: mountedBackendRoutes.slice(0, 250),
    routes_by_prefix: summarizeByPrefix(backendRoutes, 'path'),
  },
  flutter: {
    endpoint_count: flutterEndpoints.length,
    endpoints_by_prefix: summarizeByPrefix(flutterEndpoints, 'endpoint'),
    unknown_prefixes_against_backend_mounts: flutterUnknownPrefixes,
    unmatched_endpoints_against_backend_routes: unmatchedFlutterEndpoints,
  },
};

const outDir = path.join(root, 'docs/system-audit/generated');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'api-contract-inventory.json');
fs.writeFileSync(outFile, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${path.relative(root, outFile)}`);
console.log(`Backend mounts: ${backendMounts.length}`);
console.log(`Backend route declarations: ${backendRoutes.length}`);
console.log(`Mounted backend route patterns: ${mountedBackendRoutes.length}`);
console.log(`Flutter endpoint references: ${flutterEndpoints.length}`);
if (flutterUnknownPrefixes.length) {
  console.log('Unknown Flutter prefixes:');
  for (const row of flutterUnknownPrefixes) {
    console.log(`  ${row.prefix}: ${row.count}`);
  }
}
if (unmatchedFlutterEndpoints.length) {
  console.log(`Unmatched Flutter endpoint patterns: ${unmatchedFlutterEndpoints.length}`);
  for (const row of unmatchedFlutterEndpoints.slice(0, 30)) {
    console.log(`  ${row.endpoint} (${row.file})`);
  }
}
