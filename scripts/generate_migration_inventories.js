#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();

function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, out);
    else if (!predicate || predicate(full)) out.push(full);
  }
  return out.sort();
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function lineForOffset(text, offset) {
  return text.slice(0, offset).split(/\r?\n/).length;
}

function compact(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function md(value) {
  if (!value || (Array.isArray(value) && value.length === 0)) return '-';
  const text = Array.isArray(value) ? value.join('<br>') : String(value);
  return text.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function uniq(items) {
  return [...new Set(items.filter(Boolean))].sort();
}

function matches(text, regex, group = 1) {
  const found = [];
  let match;
  while ((match = regex.exec(text)) !== null) found.push(match[group]);
  return uniq(found);
}

function extractImports(text) {
  return matches(text, /import\s+(?:[^'"]+from\s+)?['"]([^'"]+)['"]/g);
}

function extractHooks(text) {
  const direct = matches(text, /\b(useState|useEffect|useMemo|useCallback|useReducer|useRef|useContext|useRouter|useSearchParams|usePathname)\b/g);
  const custom = matches(text, /\b(use[A-Z][A-Za-z0-9_]*)\s*\(/g);
  return uniq([...direct, ...custom]);
}

function extractApiPaths(text) {
  const stringPaths = matches(text, /[`'"]((?:\/api)?\/[A-Za-z0-9_./:${}?=&%-]+)[`'"]/g);
  return stringPaths.filter((p) =>
    p.startsWith('/api') ||
    p.startsWith('/auth') ||
    p.startsWith('/staff') ||
    p.startsWith('/payroll') ||
    p.startsWith('/auditor') ||
    p.startsWith('/finance') ||
    p.startsWith('/store') ||
    p.startsWith('/storekeeping') ||
    p.startsWith('/inventory') ||
    p.startsWith('/rooms') ||
    p.startsWith('/bookings') ||
    p.startsWith('/guests') ||
    p.startsWith('/bar') ||
    p.startsWith('/kitchen') ||
    p.startsWith('/facilities') ||
    p.startsWith('/communications') ||
    p.startsWith('/communication') ||
    p.startsWith('/reports') ||
    p.startsWith('/cashier') ||
    p.startsWith('/dispatch') ||
    p.startsWith('/procurement') ||
    p.startsWith('/fleet') ||
    p.startsWith('/search') ||
    p.startsWith('/notifications') ||
    p.startsWith('/suppliers') ||
    p.startsWith('/maintenance') ||
    p.startsWith('/housekeeping') ||
    p.startsWith('/reservations')
  );
}

function extractComponents(text) {
  return uniq(matches(text, /<([A-Z][A-Za-z0-9_.]*)\b/g).slice(0, 80));
}

function extractExports(text) {
  return uniq([
    ...matches(text, /export\s+(?:default\s+)?function\s+([A-Za-z0-9_]+)/g),
    ...matches(text, /export\s+const\s+([A-Za-z0-9_]+)/g),
    ...matches(text, /export\s+class\s+([A-Za-z0-9_]+)/g),
    ...matches(text, /export\s+interface\s+([A-Za-z0-9_]+)/g),
    ...matches(text, /export\s+type\s+([A-Za-z0-9_]+)/g),
  ]);
}

function flags(text) {
  const checks = [
    ['state', /\buseState\b|\buseReducer\b/],
    ['effect', /\buseEffect\b/],
    ['memo', /\buseMemo\b|\buseCallback\b/],
    ['form', /<form\b|FormData|react-hook-form|onSubmit|handleSubmit|TextArea|Textarea|Input\b|Select\b/],
    ['modal/dialog', /Dialog|Modal|Drawer|Sheet|Popover|AlertDialog/],
    ['table', /Table|DataTable|<table\b/],
    ['pagination', /pagination|pageSize|currentPage|\bpage\b.*limit|\blimit\b/],
    ['filter/search', /filter|search|Search|useSearchParams|query/],
    ['sort', /\bsort\b|sorted|orderBy/],
    ['upload', /FormData|multipart|upload|type=["']file["']/],
    ['download/export', /Blob|URL\.createObjectURL|download|export|Export|jspdf|autoTable/],
    ['toast', /toast\./],
    ['storage', /localStorage|sessionStorage/],
    ['polling/timer', /setInterval|setTimeout/],
    ['auth/guard', /ProtectedRoute|allowedRoles|authorize|role|permission/],
  ];
  return checks.filter(([, re]) => re.test(text)).map(([name]) => name);
}

function routeFromDashboardFile(file) {
  const relative = rel(file);
  const suffix = relative
    .replace(/^frontend\/src\/app\/dashboard/, '/dashboard')
    .replace(/\/page\.tsx$/, '')
    .replace(/\/layout\.tsx$/, '');
  return suffix || '/dashboard';
}

function extractRouterCalls(text) {
  const calls = [];
  const re = /router\.(get|post|put|patch|delete|use)\s*\(/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const method = match[1].toUpperCase();
    const start = match.index;
    let idx = re.lastIndex;
    let depth = 1;
    let quote = null;
    let escaped = false;
    while (idx < text.length && depth > 0) {
      const ch = text[idx];
      if (quote) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === quote) quote = null;
      } else {
        if (ch === '"' || ch === "'" || ch === '`') quote = ch;
        else if (ch === '(') depth++;
        else if (ch === ')') depth--;
      }
      idx++;
    }
    const chunk = text.slice(start, idx);
    const pathMatch = chunk.match(/router\.\w+\s*\(\s*['"`]([^'"`]+)['"`]/);
    const routePath = pathMatch ? pathMatch[1] : '(middleware)';
    const auth = [];
    if (/\bprotect\b/.test(chunk)) auth.push('protect');
    if (/\bauthenticate\b/.test(chunk)) auth.push('authenticate');
    const authz = chunk.match(/authorize\s*\(([\s\S]*?)\)/);
    if (authz) auth.push(`authorize(${compact(authz[1]).slice(0, 160)})`);
    const validators = [];
    if (/body\s*\(/.test(chunk)) validators.push('body()');
    if (/query\s*\(/.test(chunk)) validators.push('query()');
    if (/param\s*\(/.test(chunk)) validators.push('param()');
    if (/upload\./.test(chunk) || /multer|single\(|array\(/.test(chunk)) validators.push('upload');
    calls.push({
      method,
      path: routePath,
      line: lineForOffset(text, start),
      auth: uniq(auth),
      validation: uniq(validators),
      handler: compact(chunk).slice(0, 260),
    });
  }
  return calls;
}

function generateApiContracts() {
  const files = walk(path.join(root, 'backend/src/routes'), (f) => f.endsWith('.ts'));
  let total = 0;
  const lines = [
    '# API Contracts',
    '',
    'This file is generated from every TypeScript route module under `backend/src/routes`. It records the route declarations actually present in source code. Handler snippets are intentionally compacted source excerpts so route middleware, controllers, validators, uploads, and role guards remain traceable to file and line.',
    '',
    `Route modules inventoried: ${files.length}.`,
    '',
    'Common response shapes observed across controllers remain `{ success, data, message }`, raw arrays for legacy controllers, paginated objects, and binary bytes for export endpoints. Backend authorization remains authoritative even where Flutter hides actions.',
    '',
  ];
  for (const file of files) {
    const text = read(file);
    const calls = extractRouterCalls(text);
    total += calls.length;
    lines.push(`## ${rel(file)}`, '');
    lines.push(`Imports: ${md(extractImports(text))}`, '');
    lines.push('| Line | Method | Path | Auth / Roles | Validation / Upload | Handler / Business Rule Source |');
    lines.push('|---:|---|---|---|---|---|');
    if (calls.length === 0) {
      lines.push('| - | - | - | - | - | No `router.*` declarations found. |');
    } else {
      for (const call of calls) {
        lines.push(`| ${call.line} | ${call.method} | \`${md(call.path)}\` | ${md(call.auth)} | ${md(call.validation)} | \`${md(call.handler)}\` |`);
      }
    }
    lines.push('');
  }
  lines.splice(5, 0, `Route declarations inventoried: ${total}.`, '');
  fs.writeFileSync(path.join(root, 'docs/system-audit/api_contracts.md'), lines.join('\n'));
}

function generatePageInventory() {
  const files = walk(path.join(root, 'frontend/src/app/dashboard'), (f) => /\/(page|layout)\.tsx$/.test(f));
  const lines = [
    '# Page Inventory',
    '',
    'This file is generated from every `page.tsx` and `layout.tsx` under `frontend/src/app/dashboard`. Each row is file-specific and records source-derived hooks, imports, API path literals, component usage, and behavior flags. A blank cell means the pattern was not found in that file, not that the runtime has no indirect dependency.',
    '',
    `Dashboard page/layout files inventoried: ${files.length}.`,
    '',
    '| File | Route | Type | Imports | Hooks | API Paths | Components | Behavior Flags |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const file of files) {
    const text = read(file);
    const type = file.endsWith('/layout.tsx') ? 'layout' : 'page';
    lines.push(`| \`${md(rel(file))}\` | \`${md(routeFromDashboardFile(file))}\` | ${type} | ${md(extractImports(text))} | ${md(extractHooks(text))} | ${md(extractApiPaths(text))} | ${md(extractComponents(text))} | ${md(flags(text))} |`);
  }
  fs.writeFileSync(path.join(root, 'docs/system-audit/page_inventory.md'), lines.join('\n'));
}

function generateComponentInventory() {
  const bases = [
    'frontend/src/components',
    'frontend/src/hooks',
    'frontend/src/lib',
    'frontend/src/services',
    'frontend/src/store',
    'frontend/src/context',
    'frontend/src/providers',
    'frontend/src/utils',
  ];
  const files = uniq(bases.flatMap((base) => walk(path.join(root, base), (f) => /\.(tsx?|jsx?)$/.test(f))));
  const lines = [
    '# Component Inventory',
    '',
    'This file is generated from shared frontend implementation files outside dashboard route files. It covers reusable components, hooks, providers, services, utilities, API clients, export helpers, and context/store files when present.',
    '',
    `Shared frontend files inventoried: ${files.length}.`,
    '',
    '| File | Exports / Props / Types | Imports | Hooks | API Paths | Components Used | Behavior Flags |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const file of files) {
    const text = read(file);
    const exported = extractExports(text);
    const propTypes = matches(text, /(interface\s+[A-Za-z0-9_]*Props|type\s+[A-Za-z0-9_]*Props)/g, 1);
    lines.push(`| \`${md(rel(file))}\` | ${md(uniq([...exported, ...propTypes]))} | ${md(extractImports(text))} | ${md(extractHooks(text))} | ${md(extractApiPaths(text))} | ${md(extractComponents(text))} | ${md(flags(text))} |`);
  }
  fs.writeFileSync(path.join(root, 'docs/system-audit/component_inventory.md'), lines.join('\n'));
}

generateApiContracts();
generatePageInventory();
generateComponentInventory();

console.log('Generated inventories:');
console.log('- docs/system-audit/api_contracts.md');
console.log('- docs/system-audit/page_inventory.md');
console.log('- docs/system-audit/component_inventory.md');
