#!/usr/bin/env node
/**
 * Dual Database Schema Audit
 *
 * Read-only scanner that compares backend database dependencies against:
 * - DATABASE_URL / DATABASE_URL_OLD
 * - DATABASE_URL_NEW
 *
 * It writes markdown/json reports and idempotent repair-script drafts.
 * It never applies SQL to either database.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..', '..');
const BACKEND = path.join(ROOT, 'backend');
const BACKEND_SRC = path.join(BACKEND, 'src');
const REPORT_DIR = path.join(ROOT, 'docs', 'database-audit');
const REPAIR_DIR = path.join(BACKEND, 'supabase', 'repair');

const CODE_DIRS = [
  path.join(BACKEND_SRC, 'controllers'),
  path.join(BACKEND_SRC, 'services'),
  path.join(BACKEND_SRC, 'routes'),
  path.join(BACKEND_SRC, 'models'),
  path.join(BACKEND_SRC, 'middleware'),
  path.join(BACKEND_SRC, 'utils'),
  path.join(BACKEND_SRC, 'jobs'),
  path.join(BACKEND_SRC, 'config'),
  path.join(BACKEND_SRC, 'migrations'),
  path.join(BACKEND_SRC, 'database'),
].filter(fs.existsSync);

const MIGRATION_DIRS = [
  path.join(BACKEND, 'supabase', 'migrations'),
  path.join(BACKEND_SRC, 'database', 'migrations'),
  path.join(BACKEND_SRC, 'migrations'),
  path.join(ROOT, 'database', 'migrations'),
].filter(fs.existsSync);

const IGNORE_NAMES = new Set(['node_modules', 'dist', '.git', '.next', 'build', 'coverage']);
const SQL_KEYWORDS = new Set([
  'select', 'insert', 'update', 'delete', 'from', 'where', 'join', 'left', 'right', 'inner',
  'outer', 'full', 'cross', 'on', 'and', 'or', 'not', 'null', 'true', 'false', 'as', 'by',
  'group', 'order', 'limit', 'offset', 'values', 'set', 'returning', 'with', 'case', 'when',
  'then', 'else', 'end', 'public', 'auth', 'using', 'to', 'for', 'if', 'exists',
]);

const DOMAIN_RULES = [
  { name: 'Identity/RBAC', re: /(users?|roles?|permissions?|staff_profiles|departments|branches|user_branch_roles|role_permissions|user_roles|auth_|sessions?)/i },
  { name: 'Inventory', re: /(inventory|stock|store_|branch_stock|central_|grn|goods_receipt|dispatch|requisition|movement|reservation|batch|wastage|spoilage)/i },
  { name: 'Procurement/AP', re: /(supplier|purchase|po_|invoice|payment|ledger|vendor|grn)/i },
  { name: 'Finance/Cashier', re: /(finance|cashier|transaction|journal|account|budget|bank|expense|credit_bill|payroll|outbound)/i },
  { name: 'POS/Outlet', re: /(pos_|restaurant|bar_|menu|outlet|shift|order|tab|kitchen|production)/i },
  { name: 'Reception/Hotel', re: /(booking|reservation|room|guest|folio|housekeeping|conference|catering)/i },
  { name: 'Audit/Governance', re: /(audit|notification|workflow|approval|variance|discrepancy|document|task)/i },
];

const KNOWN_COMPATIBILITY = {
  supplier_invoices: {
    target: 'store_supplier_invoices',
    reason: 'Legacy finance service expects supplier_invoices; store supplier finance uses store_supplier_invoices.',
  },
  payroll: {
    target: 'payroll_batches/payroll_batch_lines or staff_payroll',
    reason: 'Enhanced payroll controller uses legacy payroll while branch payroll uses payroll_batches.',
  },
  attendance: {
    target: 'staff_attendance or staff_time_clock',
    reason: 'Staff performance/director code expects attendance records.',
  },
  store_dispatches: {
    target: 'dispatch_notes / dispatch_items',
    reason: 'Dispatch OTP and tracking controllers expect a store dispatch header table.',
  },
  conference_bookings: {
    target: 'conference_hall_bookings or conference_events',
    reason: 'Accounting and P&L reports expect conference revenue source records.',
  },
  orders: {
    target: 'restaurant_orders / pos_shift_orders / bar_orders',
    reason: 'Director reporting uses generic orders; operational orders are split by outlet.',
  },
  invoices: {
    target: 'finance_invoices / store_supplier_invoices',
    reason: 'Director reporting expects generic invoice totals.',
  },
  customers: {
    target: 'guest_profiles / guests',
    reason: 'Accounting customer lookup should map to hotel guests/customers.',
  },
};

function loadEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || m[1].startsWith('#')) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[m[1]] = value;
  }
  return env;
}

function walk(dir, extensions) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (IGNORE_NAMES.has(name)) continue;
    const file = path.join(dir, name);
    const stat = fs.statSync(file);
    if (stat.isDirectory()) out.push(...walk(file, extensions));
    else if (extensions.some((ext) => file.endsWith(ext))) out.push(file);
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function lineOf(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function textLineAt(content, index) {
  const start = content.lastIndexOf('\n', index) + 1;
  const end = content.indexOf('\n', index);
  return content.slice(start, end === -1 ? content.length : end).trim();
}

function cleanIdentifier(name) {
  if (!name) return null;
  let out = String(name).trim();
  out = out.replace(/^public\./, '').replace(/^auth\./, '');
  out = out.replace(/["'`;()[\],]/g, '');
  if (!out || SQL_KEYWORDS.has(out.toLowerCase())) return null;
  if (/^\d/.test(out)) return null;
  if (out.includes('${')) return null;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(out)) return null;
  return out;
}

function splitTopLevel(input) {
  const parts = [];
  let current = '';
  let depth = 0;
  for (const ch of input) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function extractObjectKeys(source) {
  const keys = new Set();
  const body = source.slice(0, 1200);
  const keyRe = /(?:^|[\s,{])([A-Za-z_][A-Za-z0-9_]*)\s*:/g;
  let m;
  while ((m = keyRe.exec(body))) {
    if (!['data', 'error', 'count', 'message', 'success'].includes(m[1])) keys.add(m[1]);
  }
  return [...keys];
}

function moduleName(file) {
  const r = rel(file);
  if (r.includes('/controllers/')) return r.split('/controllers/')[1].split('/')[0] || 'controllers';
  if (r.includes('/services/')) return r.split('/services/')[1].split('/')[0] || 'services';
  if (r.includes('/routes/')) return r.split('/routes/')[1].split('/')[0] || 'routes';
  if (r.includes('/jobs/')) return 'jobs';
  if (r.includes('/middleware/')) return 'middleware';
  if (r.includes('/models/')) return 'models';
  return r.split('/').slice(0, 3).join('/');
}

function domainFor(table) {
  const hit = DOMAIN_RULES.find((rule) => rule.re.test(table));
  return hit ? hit.name : 'General';
}

function addRef(map, table, ref) {
  if (!table) return;
  if (!map.has(table)) map.set(table, []);
  map.get(table).push(ref);
}

function scanBackendCode() {
  const files = CODE_DIRS.flatMap((dir) => walk(dir, ['.ts', '.js']));
  const tableRefs = new Map();
  const columnRefs = new Map();
  const rpcRefs = new Map();
  const relationshipHints = [];
  const rawSqlRefs = new Map();
  const routeRoles = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const fileRel = rel(file);

    let m;
    const fromRe = /\.from\(\s*(['"`])([^'"`]+)\1\s*\)/g;
    while ((m = fromRe.exec(content))) {
      const table = cleanIdentifier(m[2]);
      if (!table) continue;
      const pos = m.index;
      const context = content.slice(pos, pos + 1800);
      const operation = context.includes('.insert(') ? 'insert'
        : context.includes('.upsert(') ? 'upsert'
        : context.includes('.update(') ? 'update'
        : context.includes('.delete(') ? 'delete'
        : context.includes('.select(') ? 'select'
        : 'unknown';
      const ref = { file: fileRel, line: lineOf(content, pos), module: moduleName(file), operation };
      addRef(tableRefs, table, ref);

      const columns = new Set();
      const selectMatch = context.match(/\.select\(\s*(['"`])([\s\S]*?)\1\s*[,)]/);
      if (selectMatch) {
        for (const token of splitTopLevel(selectMatch[2])) {
          if (!token || token === '*' || token.includes('(')) {
            const join = token.match(/(?:^|,|\s)(?:[A-Za-z_][A-Za-z0-9_]*:)?([A-Za-z_][A-Za-z0-9_]*)(?:!([A-Za-z_][A-Za-z0-9_]*))?\s*\(/);
            if (join) {
              relationshipHints.push({
                table,
                target: join[1],
                constraint: join[2] || null,
                file: fileRel,
                line: lineOf(content, pos),
              });
            }
            continue;
          }
          if (token.includes(':') || token.includes('!')) continue;
          const column = cleanIdentifier(token.split(/\s+/)[0]);
          if (column && column !== '*') columns.add(column);
        }
      }

      const filterRe = /\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|containedBy|order)\(\s*(['"`])([^'"`]+)\2/g;
      let fm;
      while ((fm = filterRe.exec(context))) {
        const column = cleanIdentifier(fm[3]);
        if (column) columns.add(column);
      }
      const matchRe = /\.match\(\s*\{([\s\S]*?)\}\s*\)/g;
      let mm;
      while ((mm = matchRe.exec(context))) {
        for (const key of extractObjectKeys(mm[1])) columns.add(key);
      }
      if (operation === 'insert' || operation === 'update' || operation === 'upsert') {
        const opRe = new RegExp(`\\.${operation}\\(\\s*(?:\\[\\s*)?\\{([\\s\\S]*?)\\}`, 'm');
        const opMatch = context.match(opRe);
        if (opMatch) {
          for (const key of extractObjectKeys(opMatch[1])) columns.add(key);
        }
      }
      if (columns.size) {
        if (!columnRefs.has(table)) columnRefs.set(table, new Map());
        for (const column of columns) {
          if (!columnRefs.get(table).has(column)) columnRefs.get(table).set(column, []);
          columnRefs.get(table).get(column).push(ref);
        }
      }
    }

    const rpcRe = /\.rpc\(\s*(['"`])([^'"`]+)\1/g;
    while ((m = rpcRe.exec(content))) {
      const routine = cleanIdentifier(m[2]);
      if (!routine) continue;
      addRef(rpcRefs, routine, { file: fileRel, line: lineOf(content, m.index), module: moduleName(file), operation: 'rpc' });
    }

    const sqlRe = /\b(from|join|update|into|delete\s+from)\s+("?[\w.]+")/gi;
    while ((m = sqlRe.exec(content))) {
      const line = textLineAt(content, m.index);
      if (/^import\s/.test(line) || /^export\s+.*\sfrom\s/.test(line)) continue;
      const table = cleanIdentifier(m[2]);
      if (!table) continue;
      addRef(rawSqlRefs, table, { file: fileRel, line: lineOf(content, m.index), module: moduleName(file), operation: `raw:${m[1].toLowerCase()}` });
      addRef(tableRefs, table, { file: fileRel, line: lineOf(content, m.index), module: moduleName(file), operation: `raw:${m[1].toLowerCase()}` });
    }

    const authRe = /authorize\(\s*(?:\[([^\]]+)\]|(['"`][^'"`]+['"`]))/g;
    while ((m = authRe.exec(content))) {
      const source = m[1] || m[2] || '';
      const roles = [...source.matchAll(/['"`]([^'"`]+)['"`]/g)].map((x) => x[1]);
      if (roles.length) routeRoles.push({ file: fileRel, line: lineOf(content, m.index), roles });
    }
  }

  return { files, tableRefs, columnRefs, rpcRefs, relationshipHints, rawSqlRefs, routeRoles };
}

function scanMigrations() {
  const files = MIGRATION_DIRS.flatMap((dir) => walk(dir, ['.sql']));
  const creates = { tables: new Map(), views: new Map(), functions: new Map(), indexes: new Map() };
  const alters = new Map();
  const references = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const fileRel = rel(file);
    let m;

    const createTableRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?("?[\w]+"?)/gi;
    while ((m = createTableRe.exec(content))) addRef(creates.tables, cleanIdentifier(m[1]), { file: fileRel, line: lineOf(content, m.index) });

    const createViewRe = /create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?("?[\w]+"?)/gi;
    while ((m = createViewRe.exec(content))) addRef(creates.views, cleanIdentifier(m[1]), { file: fileRel, line: lineOf(content, m.index) });

    const createFnRe = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?("?[\w]+"?)/gi;
    while ((m = createFnRe.exec(content))) addRef(creates.functions, cleanIdentifier(m[1]), { file: fileRel, line: lineOf(content, m.index) });

    const createIdxRe = /create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?("?[\w]+"?)/gi;
    while ((m = createIdxRe.exec(content))) addRef(creates.indexes, cleanIdentifier(m[1]), { file: fileRel, line: lineOf(content, m.index) });

    const alterAddRe = /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?("?[\w]+"?)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?("?[\w]+"?)/gi;
    while ((m = alterAddRe.exec(content))) {
      const table = cleanIdentifier(m[1]);
      const column = cleanIdentifier(m[2]);
      if (!table || !column) continue;
      if (!alters.has(table)) alters.set(table, new Map());
      if (!alters.get(table).has(column)) alters.get(table).set(column, []);
      alters.get(table).get(column).push({ file: fileRel, line: lineOf(content, m.index) });
    }

    const refRe = /references\s+(?:public\.)?("?[\w]+"?)\s*\(([^)]+)\)/gi;
    while ((m = refRe.exec(content))) {
      references.push({ target: cleanIdentifier(m[1]), columns: m[2], file: fileRel, line: lineOf(content, m.index) });
    }
  }

  return { files, creates, alters, references };
}

async function inspectDb(label, url) {
  if (!url) return { label, status: 'missing_env' };
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  try {
    await client.connect();
    const query = async (sql, params = []) => (await client.query(sql, params)).rows;
    const tables = await query(`
      select table_schema, table_name, table_type
      from information_schema.tables
      where table_schema in ('public','auth')
      order by table_schema, table_name
    `);
    const columns = await query(`
      select table_schema, table_name, column_name, data_type, udt_name, is_nullable, column_default
      from information_schema.columns
      where table_schema in ('public','auth')
      order by table_schema, table_name, ordinal_position
    `);
    const constraints = await query(`
      select
        n.nspname as table_schema,
        c.relname as table_name,
        con.conname as constraint_name,
        con.contype as constraint_type,
        pg_get_constraintdef(con.oid) as definition
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public','auth')
      order by n.nspname, c.relname, con.conname
    `);
    const indexes = await query(`
      select schemaname as table_schema, tablename as table_name, indexname, indexdef
      from pg_indexes
      where schemaname in ('public','auth')
      order by schemaname, tablename, indexname
    `);
    const routines = await query(`
      select routine_schema, routine_name, routine_type
      from information_schema.routines
      where routine_schema in ('public','auth')
      order by routine_schema, routine_name
    `);
    const policies = await query(`
      select schemaname as table_schema, tablename as table_name, policyname, roles, cmd, qual, with_check
      from pg_policies
      where schemaname in ('public','auth')
      order by schemaname, tablename, policyname
    `);
    const rls = await query(`
      select n.nspname as table_schema, c.relname as table_name, c.relrowsecurity as rls_enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public','auth') and c.relkind in ('r','p')
      order by n.nspname, c.relname
    `);
    await client.end();
    return { label, status: 'ok', tables, columns, constraints, indexes, routines, policies, rls };
  } catch (error) {
    try { await client.end(); } catch (_) {}
    return { label, status: 'error', message: error.message };
  }
}

function tableSet(db) {
  return new Set((db.tables || []).filter((t) => t.table_schema === 'public').map((t) => t.table_name));
}

function objectSet(db) {
  return new Set((db.tables || []).filter((t) => t.table_schema === 'public').map((t) => t.table_name));
}

function routineSet(db) {
  return new Set((db.routines || []).filter((r) => r.routine_schema === 'public').map((r) => r.routine_name));
}

function columnsByTable(db) {
  const map = new Map();
  for (const col of db.columns || []) {
    if (col.table_schema !== 'public') continue;
    if (!map.has(col.table_name)) map.set(col.table_name, new Map());
    map.get(col.table_name).set(col.column_name, col);
  }
  return map;
}

function constraintsByName(db) {
  const map = new Map();
  for (const c of db.constraints || []) map.set(c.constraint_name, c);
  return map;
}

function fkConstraints(db) {
  return (db.constraints || []).filter((c) => c.table_schema === 'public' && c.constraint_type === 'f');
}

function indexCoversColumn(indexdef, column) {
  const re = new RegExp(`\\((?:[^)]*,\\s*)?${column}(?:\\s|,|\\))`, 'i');
  return re.test(indexdef);
}

function firstRefs(refs, limit = 3) {
  return refs.slice(0, limit).map((r) => `${r.file}:${r.line}`).join(', ');
}

function referencesMarkdown(refs) {
  const grouped = new Map();
  for (const ref of refs) {
    const key = `${ref.module}|${ref.operation}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(ref);
  }
  return [...grouped.entries()].slice(0, 6).map(([key, rows]) => {
    const [module, operation] = key.split('|');
    return `  - ${module} (${operation}) at ${firstRefs(rows)}`;
  }).join('\n');
}

function compare(code, migrations, dbs) {
  const tableNames = [...code.tableRefs.keys()].sort();
  const routineNames = [...code.rpcRefs.keys()].sort();
  const tableCreateNames = new Set([...migrations.creates.tables.keys(), ...migrations.creates.views.keys()]);
  const functionCreateNames = new Set([...migrations.creates.functions.keys()]);

  const missingTables = [];
  for (const table of tableNames) {
    const refs = code.tableRefs.get(table);
    const row = {
      table,
      domain: domainFor(table),
      old: dbs.old.status === 'ok' && objectSet(dbs.old).has(table) ? 'present' : 'missing',
      next: dbs.next.status === 'ok' && objectSet(dbs.next).has(table) ? 'present' : 'missing',
      migration: tableCreateNames.has(table) ? 'defined' : 'not_found',
      refs,
      risk: riskFor(table, refs),
      compatibility: KNOWN_COMPATIBILITY[table] || null,
    };
    if (row.old === 'missing' || row.next === 'missing') missingTables.push(row);
  }

  const missingRoutines = [];
  for (const routine of routineNames) {
    const refs = code.rpcRefs.get(routine);
    const row = {
      routine,
      domain: domainFor(routine),
      old: dbs.old.status === 'ok' && routineSet(dbs.old).has(routine) ? 'present' : 'missing',
      next: dbs.next.status === 'ok' && routineSet(dbs.next).has(routine) ? 'present' : 'missing',
      migration: functionCreateNames.has(routine) ? 'defined' : 'not_found',
      refs,
      risk: riskFor(routine, refs),
    };
    if (row.old === 'missing' || row.next === 'missing') missingRoutines.push(row);
  }

  const missingColumns = [];
  for (const [table, cols] of code.columnRefs.entries()) {
    for (const [column, refs] of cols.entries()) {
      if (column === '*' || column.includes('.')) continue;
      const oldCols = columnsByTable(dbs.old).get(table);
      const nextCols = columnsByTable(dbs.next).get(table);
      const old = oldCols ? (oldCols.has(column) ? 'present' : 'missing') : 'table_missing';
      const next = nextCols ? (nextCols.has(column) ? 'present' : 'missing') : 'table_missing';
      if (old !== 'present' || next !== 'present') {
        missingColumns.push({
          table,
          column,
          domain: domainFor(table),
          old,
          next,
          refs,
          risk: riskFor(table, refs),
          oldType: oldCols?.get(column) || null,
          nextType: nextCols?.get(column) || null,
        });
      }
    }
  }

  const missingRelationships = [];
  for (const hint of code.relationshipHints) {
    for (const dbKey of ['old', 'next']) {
      const db = dbs[dbKey];
      if (db.status !== 'ok') continue;
      const byName = constraintsByName(db);
      if (hint.constraint && !byName.has(hint.constraint)) {
        missingRelationships.push({
          ...hint,
          db: db.label,
          issue: `Missing hinted FK constraint ${hint.constraint}`,
          risk: 'high',
        });
      }
    }
  }

  const missingIndexes = [];
  for (const dbKey of ['old', 'next']) {
    const db = dbs[dbKey];
    if (db.status !== 'ok') continue;
    const indexes = db.indexes || [];
    for (const fk of fkConstraints(db)) {
      const localCols = (fk.definition.match(/FOREIGN KEY \(([^)]+)\)/i)?.[1] || '')
        .split(',').map((x) => cleanIdentifier(x)).filter(Boolean);
      for (const column of localCols) {
        const tableIndexes = indexes.filter((idx) => idx.table_schema === 'public' && idx.table_name === fk.table_name);
        if (!tableIndexes.some((idx) => indexCoversColumn(idx.indexdef, column))) {
          missingIndexes.push({
            db: db.label,
            table: fk.table_name,
            column,
            reason: `FK ${fk.constraint_name} should have an index on the referencing side.`,
            indexName: `idx_${fk.table_name}_${column}`,
          });
        }
      }
    }

    const cols = columnsByTable(db);
    for (const table of tableNames) {
      const tableCols = cols.get(table);
      if (!tableCols) continue;
      const tableIndexes = indexes.filter((idx) => idx.table_schema === 'public' && idx.table_name === table);
      for (const combo of [
        ['branch_id', 'created_at'],
        ['branch_id', 'status'],
      ]) {
        if (combo.every((c) => tableCols.has(c))) {
          const pattern = new RegExp(`\\(${combo.join('\\s*,\\s*')}`, 'i');
          if (!tableIndexes.some((idx) => pattern.test(idx.indexdef))) {
            missingIndexes.push({
              db: db.label,
              table,
              column: combo.join(', '),
              reason: `Backend filters ${table} by branch and ${combo[1]} in list/report paths.`,
              indexName: `idx_${table}_${combo.join('_')}`,
            });
          }
        }
      }
    }
  }

  const migrationDrift = [];
  for (const table of tableCreateNames) {
    const oldPresent = dbs.old.status === 'ok' && objectSet(dbs.old).has(table);
    const nextPresent = dbs.next.status === 'ok' && objectSet(dbs.next).has(table);
    if (!oldPresent || !nextPresent) {
      migrationDrift.push({ object: table, type: 'table_or_view', old: oldPresent ? 'present' : 'missing', next: nextPresent ? 'present' : 'missing' });
    }
  }
  const backendTables = new Set(tableNames);
  for (const dbKey of ['old', 'next']) {
    const db = dbs[dbKey];
    if (db.status !== 'ok') continue;
    for (const table of objectSet(db)) {
      if (!backendTables.has(table) && !table.startsWith('_')) {
        migrationDrift.push({ object: table, type: 'db_object_without_static_backend_ref', db: db.label });
      }
    }
  }

  return { missingTables, missingRoutines, missingColumns, missingRelationships, missingIndexes, migrationDrift };
}

function riskFor(name, refs) {
  const text = `${name} ${(refs || []).map((r) => r.file).join(' ')}`.toLowerCase();
  if (/(auth|user|role|permission|payment|invoice|payroll|pos|order|stock|inventory|grn|dispatch|supplier|booking|reservation)/.test(text)) return 'critical';
  if (/(report|dashboard|analytics|summary|view|attendance|housekeeping)/.test(text)) return 'high';
  return 'medium';
}

function mdTable(rows, columns) {
  if (!rows.length) return '_No findings._\n';
  const header = `| ${columns.map((c) => c.label).join(' |')} |`;
  const sep = `| ${columns.map(() => '---').join(' |')} |`;
  const body = rows.map((row) => `| ${columns.map((c) => String(c.value(row) ?? '').replace(/\n/g, '<br>').replace(/\|/g, '\\|')).join(' |')} |`);
  return [header, sep, ...body].join('\n') + '\n';
}

function writeJson(name, data) {
  fs.writeFileSync(path.join(REPORT_DIR, name.replace(/\.md$/, '.json')), JSON.stringify(data, null, 2));
}

function writeReports(code, migrations, dbs, findings) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(REPAIR_DIR, { recursive: true });
  const generatedAt = new Date().toISOString();
  const oldCount = dbs.old.tables?.filter((t) => t.table_schema === 'public' && t.table_type === 'BASE TABLE').length || 0;
  const nextCount = dbs.next.tables?.filter((t) => t.table_schema === 'public' && t.table_type === 'BASE TABLE').length || 0;

  const dependencyRows = [...code.tableRefs.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([table, refs]) => ({
    table,
    domain: domainFor(table),
    refs,
    old: dbs.old.status === 'ok' && objectSet(dbs.old).has(table) ? 'present' : 'missing',
    next: dbs.next.status === 'ok' && objectSet(dbs.next).has(table) ? 'present' : 'missing',
  }));
  const dependencyMd = `# Backend DB Dependency Map\n\nGenerated: ${generatedAt}\n\n` +
    `Scanned ${code.files.length} backend files and ${migrations.files.length} migration SQL files.\n\n` +
    `Old DB public tables: ${oldCount}. New DB public tables: ${nextCount}.\n\n` +
    mdTable(dependencyRows, [
      { label: 'Object', value: (r) => r.table },
      { label: 'Domain', value: (r) => r.domain },
      { label: 'Old DB', value: (r) => r.old },
      { label: 'New DB', value: (r) => r.next },
      { label: 'Required By', value: (r) => referencesMarkdown(r.refs) },
    ]);
  fs.writeFileSync(path.join(REPORT_DIR, 'BACKEND_DB_DEPENDENCY_MAP.md'), dependencyMd);
  writeJson('BACKEND_DB_DEPENDENCY_MAP.md', dependencyRows);

  const missingTablesMd = `# Missing Tables / Views / RPC Report\n\nGenerated: ${generatedAt}\n\n## Missing Tables And Views\n\n` +
    mdTable(findings.missingTables, [
      { label: 'Object', value: (r) => r.table },
      { label: 'Risk', value: (r) => r.risk },
      { label: 'Domain', value: (r) => r.domain },
      { label: 'Old DB', value: (r) => r.old },
      { label: 'New DB', value: (r) => r.next },
      { label: 'Migration', value: (r) => r.migration },
      { label: 'Compatibility / Reason', value: (r) => r.compatibility ? `${r.compatibility.target}: ${r.compatibility.reason}` : reasonFor(r.table) },
      { label: 'Required By', value: (r) => referencesMarkdown(r.refs) },
    ]) +
    `\n## Missing RPC Functions\n\n` +
    mdTable(findings.missingRoutines, [
      { label: 'RPC', value: (r) => r.routine },
      { label: 'Risk', value: (r) => r.risk },
      { label: 'Old DB', value: (r) => r.old },
      { label: 'New DB', value: (r) => r.next },
      { label: 'Migration', value: (r) => r.migration },
      { label: 'Required By', value: (r) => referencesMarkdown(r.refs) },
    ]);
  fs.writeFileSync(path.join(REPORT_DIR, 'MISSING_TABLES_REPORT.md'), missingTablesMd);
  writeJson('MISSING_TABLES_REPORT.md', { tables: findings.missingTables, routines: findings.missingRoutines });

  const missingColumnsMd = `# Missing Columns Report\n\nGenerated: ${generatedAt}\n\n` +
    mdTable(findings.missingColumns, [
      { label: 'Table', value: (r) => r.table },
      { label: 'Column', value: (r) => r.column },
      { label: 'Risk', value: (r) => r.risk },
      { label: 'Old DB', value: (r) => r.old },
      { label: 'New DB', value: (r) => r.next },
      { label: 'Required By', value: (r) => referencesMarkdown(r.refs) },
    ]);
  fs.writeFileSync(path.join(REPORT_DIR, 'MISSING_COLUMNS_REPORT.md'), missingColumnsMd);
  writeJson('MISSING_COLUMNS_REPORT.md', findings.missingColumns);

  const relationshipsMd = `# Missing Relationships Report\n\nGenerated: ${generatedAt}\n\n` +
    mdTable(findings.missingRelationships, [
      { label: 'DB', value: (r) => r.db },
      { label: 'Source', value: (r) => r.table },
      { label: 'Target', value: (r) => r.target },
      { label: 'Issue', value: (r) => r.issue },
      { label: 'Code', value: (r) => `${r.file}:${r.line}` },
    ]);
  fs.writeFileSync(path.join(REPORT_DIR, 'MISSING_RELATIONSHIPS_REPORT.md'), relationshipsMd);
  writeJson('MISSING_RELATIONSHIPS_REPORT.md', findings.missingRelationships);

  const indexesMd = `# Missing Indexes Report\n\nGenerated: ${generatedAt}\n\n` +
    mdTable(findings.missingIndexes, [
      { label: 'DB', value: (r) => r.db },
      { label: 'Table', value: (r) => r.table },
      { label: 'Column(s)', value: (r) => r.column },
      { label: 'Recommended Index', value: (r) => r.indexName },
      { label: 'Reason', value: (r) => r.reason },
    ]);
  fs.writeFileSync(path.join(REPORT_DIR, 'MISSING_INDEXES_REPORT.md'), indexesMd);
  writeJson('MISSING_INDEXES_REPORT.md', findings.missingIndexes);

  const migrationMd = `# Migration Drift Report\n\nGenerated: ${generatedAt}\n\n` +
    mdTable(findings.migrationDrift.slice(0, 500), [
      { label: 'Object', value: (r) => r.object },
      { label: 'Type', value: (r) => r.type },
      { label: 'Old DB', value: (r) => r.old || r.db || '' },
      { label: 'New DB', value: (r) => r.next || '' },
    ]) +
    `\n_Note: JSON contains the full drift list. Markdown is capped at 500 rows for readability._\n`;
  fs.writeFileSync(path.join(REPORT_DIR, 'MIGRATION_DRIFT_REPORT.md'), migrationMd);
  writeJson('MIGRATION_DRIFT_REPORT.md', findings.migrationDrift);

  writeRbacReport(code, dbs, generatedAt);
  writeDomainReport(dbs, findings, generatedAt);
  writeHealthScore(code, migrations, dbs, findings, generatedAt);
  writeRepairScripts(findings, dbs);
}

function reasonFor(table) {
  if (table.includes('dispatch')) return 'Dispatch, OTP, transfer, or branch receiving workflow requires this object.';
  if (table.includes('stock') || table.includes('inventory')) return 'Inventory module requires this object for stock state, movements, or analytics.';
  if (table.includes('invoice') || table.includes('payment') || table.includes('bank')) return 'Finance/AP module requires this object for billing, payments, or reconciliation.';
  if (table.includes('conference')) return 'Conference/event billing and reporting requires this object.';
  if (table.includes('payroll') || table.includes('attendance')) return 'Staff payroll/performance workflows require this object.';
  return 'Backend code references this object at runtime.';
}

function writeRbacReport(code, dbs, generatedAt) {
  const expectedRoles = new Set(code.routeRoles.flatMap((r) => r.roles));
  const report = [];
  for (const dbKey of ['old', 'next']) {
    const db = dbs[dbKey];
    if (db.status !== 'ok') {
      report.push(`## ${db.label}\n\nCould not inspect: ${db.message || db.status}\n`);
      continue;
    }
    const tables = objectSet(db);
    const cols = columnsByTable(db);
    const roleCols = cols.get('roles');
    const userCols = cols.get('users');
    const staffCols = cols.get('staff_profiles');
    report.push(`## ${db.label}\n`);
    report.push(`- roles table: ${tables.has('roles') ? 'present' : 'missing'}`);
    report.push(`- permissions table: ${tables.has('permissions') ? 'present' : 'missing'}`);
    report.push(`- user_branch_roles table: ${tables.has('user_branch_roles') ? 'present' : 'missing'}`);
    report.push(`- role_permissions compatibility table: ${tables.has('role_permissions') ? 'present' : 'missing'}`);
    report.push(`- user_roles compatibility table: ${tables.has('user_roles') ? 'present' : 'missing'}`);
    report.push(`- users columns inspected: ${userCols ? [...userCols.keys()].slice(0, 20).join(', ') : 'missing table'}`);
    report.push(`- staff_profiles columns inspected: ${staffCols ? [...staffCols.keys()].slice(0, 20).join(', ') : 'missing table'}`);
    report.push(`- roles columns inspected: ${roleCols ? [...roleCols.keys()].join(', ') : 'missing table'}\n`);
  }
  report.push(`## Backend Route Role Requirements\n`);
  report.push([...expectedRoles].sort().map((r) => `- ${r}`).join('\n') || '_No authorize(...) role literals found._');
  report.push('\n\nImportant: `users` and `staff_profiles` are separate domains. Do not backfill missing staff rows by creating fake login users.');
  fs.writeFileSync(path.join(REPORT_DIR, 'RBAC_AUTH_AUDIT.md'), `# RBAC And Auth Audit\n\nGenerated: ${generatedAt}\n\n${report.join('\n')}\n`);
  writeJson('RBAC_AUTH_AUDIT.md', { expectedRoles: [...expectedRoles].sort(), routeRoles: code.routeRoles });
}

function writeDomainReport(dbs, findings, generatedAt) {
  const domains = ['Inventory', 'Procurement/AP', 'Finance/Cashier', 'POS/Outlet', 'Audit/Governance'];
  const rows = [];
  for (const domain of domains) {
    rows.push({
      domain,
      missingTables: findings.missingTables.filter((r) => r.domain === domain).length,
      missingColumns: findings.missingColumns.filter((r) => r.domain === domain).length,
      missingIndexes: findings.missingIndexes.filter((r) => domainFor(r.table) === domain).length,
      critical: findings.missingTables.concat(findings.missingColumns).filter((r) => r.domain === domain && r.risk === 'critical').length,
    });
  }
  const md = `# Inventory, Procurement, Finance, POS And Governance Audit\n\nGenerated: ${generatedAt}\n\n` +
    mdTable(rows, [
      { label: 'Domain', value: (r) => r.domain },
      { label: 'Missing Tables/Views', value: (r) => r.missingTables },
      { label: 'Missing Columns', value: (r) => r.missingColumns },
      { label: 'Missing Indexes', value: (r) => r.missingIndexes },
      { label: 'Critical Findings', value: (r) => r.critical },
    ]) +
    `\n## Notes\n\n- Inventory and procurement fixes must preserve journal-ledger movement rules.\n- Supplier/payment fixes should prefer existing \`store_supplier_*\` tables over duplicate legacy AP tables.\n- POS/outlet fixes must preserve branch isolation and avoid cross-branch outlet names.\n`;
  fs.writeFileSync(path.join(REPORT_DIR, 'INVENTORY_PROCUREMENT_FINANCE_AUDIT.md'), md);
  writeJson('INVENTORY_PROCUREMENT_FINANCE_AUDIT.md', rows);
}

function writeHealthScore(code, migrations, dbs, findings, generatedAt) {
  const dependencyCount = code.tableRefs.size + code.rpcRefs.size;
  const oldMissing = findings.missingTables.filter((r) => r.old === 'missing').length + findings.missingRoutines.filter((r) => r.old === 'missing').length;
  const nextMissing = findings.missingTables.filter((r) => r.next === 'missing').length + findings.missingRoutines.filter((r) => r.next === 'missing').length;
  const critical = findings.missingTables.concat(findings.missingColumns).filter((r) => r.risk === 'critical').length;
  const oldScore = Math.max(0, Math.round(100 - (oldMissing / Math.max(1, dependencyCount)) * 70 - critical * 0.2));
  const nextScore = Math.max(0, Math.round(100 - (nextMissing / Math.max(1, dependencyCount)) * 70 - critical * 0.2));
  const md = `# Database Health Score\n\nGenerated: ${generatedAt}\n\n` +
    `| Database | Score | Runtime Missing Objects | Notes |\n| --- | --- | --- | --- |\n` +
    `| Old / DATABASE_URL | ${oldScore}% | ${oldMissing} | Current runtime hotfix target. |\n` +
    `| New / DATABASE_URL_NEW | ${nextScore}% | ${nextMissing} | Clean cutover readiness target. |\n\n` +
    `## Inputs\n\n- Backend table dependencies: ${code.tableRefs.size}\n- Backend RPC dependencies: ${code.rpcRefs.size}\n- Migration SQL files scanned: ${migrations.files.length}\n- Missing column findings: ${findings.missingColumns.length}\n- Missing relationship findings: ${findings.missingRelationships.length}\n- Missing index recommendations: ${findings.missingIndexes.length}\n`;
  fs.writeFileSync(path.join(REPORT_DIR, 'DATABASE_HEALTH_SCORE.md'), md);
  writeJson('DATABASE_HEALTH_SCORE.md', { oldScore, nextScore, dependencyCount, oldMissing, nextMissing, critical });
}

function pgTypeForColumn(column) {
  if (column.endsWith('_id') || column === 'created_by' || column === 'updated_by') return 'UUID';
  if (column === 'branch_id') return 'INTEGER';
  if (column.includes('amount') || column.includes('price') || column.includes('cost') || column.includes('total')) return 'NUMERIC(15,2) DEFAULT 0';
  if (column.includes('quantity') || column.includes('count')) return 'NUMERIC(15,3) DEFAULT 0';
  if (column.includes('date')) return 'DATE';
  if (column.includes('_at')) return 'TIMESTAMPTZ';
  if (column.startsWith('is_') || column.startsWith('has_') || column.includes('enabled')) return 'BOOLEAN DEFAULT false';
  if (column === 'status') return 'TEXT';
  return 'TEXT';
}

function createTableTemplate(table) {
  if (table === 'store_dispatches') {
    return `CREATE TABLE IF NOT EXISTS public.store_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_number TEXT UNIQUE,
  branch_id INTEGER REFERENCES public.branches(id),
  request_id UUID,
  status TEXT NOT NULL DEFAULT 'draft',
  otp_code TEXT,
  otp_expires_at TIMESTAMPTZ,
  dispatched_by UUID,
  dispatched_at TIMESTAMPTZ,
  received_by UUID,
  received_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`;
  }
  if (table === 'conference_daily_attendance') {
    return `CREATE TABLE IF NOT EXISTS public.conference_daily_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES public.branches(id),
  booking_id UUID,
  attendance_date DATE NOT NULL DEFAULT current_date,
  expected_pax INTEGER DEFAULT 0,
  actual_pax INTEGER DEFAULT 0,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`;
  }
  if (table === 'attendance') {
    return `CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES public.branches(id),
  staff_id UUID,
  user_id UUID,
  attendance_date DATE NOT NULL DEFAULT current_date,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`;
  }
  if (table === 'revenue_targets') {
    return `CREATE TABLE IF NOT EXISTS public.revenue_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES public.branches(id),
  target_date DATE NOT NULL,
  department TEXT,
  target_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, target_date, department)
);`;
  }
  if (table === 'banking_reconciliations') {
    return `CREATE TABLE IF NOT EXISTS public.banking_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES public.branches(id),
  account_id UUID,
  reconciliation_date DATE NOT NULL DEFAULT current_date,
  opening_balance NUMERIC(15,2) DEFAULT 0,
  closing_balance NUMERIC(15,2) DEFAULT 0,
  reconciled_by UUID,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`;
  }
  if (table === 'stock_in_records') {
    return `CREATE TABLE IF NOT EXISTS public.stock_in_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES public.branches(id),
  item_id TEXT,
  item_name TEXT,
  quantity NUMERIC(15,3) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(15,2) DEFAULT 0,
  source_document TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`;
  }
  return `CREATE TABLE IF NOT EXISTS public.${table} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES public.branches(id),
  status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`;
}

function writeRepairScripts(findings, dbs) {
  const compatibilityOnlyObjects = new Set(['supplier_invoices', 'bar_stock_ledger']);
  const criticalTables = findings.missingTables
    .filter((r) => r.old === 'missing' && r.risk === 'critical')
    .filter((r) => !compatibilityOnlyObjects.has(r.table))
    .map((r) => r.table);
  const uniqueCriticalTables = [...new Set(criticalTables)];

  const repair1 = [
    '-- 001 Critical runtime objects',
    '-- Review before applying. Generated by scripts/dual-db-schema-audit.js.',
    '-- This script is idempotent and targets current runtime failures.',
    'CREATE EXTENSION IF NOT EXISTS pgcrypto;',
    '',
    ...uniqueCriticalTables.map((table) => `-- ${table}: ${reasonFor(table)}\n${createTableTemplate(table)}\n`),
    compatibilityViews(findings),
  ].join('\n');
  fs.writeFileSync(path.join(REPAIR_DIR, '001_critical_runtime_objects.sql'), repair1);

  const columnLines = [
    '-- 002 Missing columns and constraints',
    '-- Review generated column types before applying to production.',
    '',
  ];
  for (const row of findings.missingColumns.filter((r) => r.old === 'missing' && r.old !== 'table_missing').slice(0, 400)) {
    columnLines.push(`ALTER TABLE IF EXISTS public.${row.table} ADD COLUMN IF NOT EXISTS ${row.column} ${pgTypeForColumn(row.column)};`);
  }
  fs.writeFileSync(path.join(REPAIR_DIR, '002_missing_columns_and_constraints.sql'), columnLines.join('\n') + '\n');

  const indexLines = [
    '-- 003 Missing indexes',
    '-- Uses CONCURRENTLY where possible; run outside a transaction if applying manually.',
    '',
  ];
  const seenIndexes = new Set();
  for (const row of findings.missingIndexes.filter((r) => r.db === 'DATABASE_URL' || r.db === 'DATABASE_URL_OLD').slice(0, 500)) {
    if (seenIndexes.has(row.indexName)) continue;
    seenIndexes.add(row.indexName);
    indexLines.push(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${row.indexName} ON public.${row.table} (${row.column});`);
  }
  fs.writeFileSync(path.join(REPAIR_DIR, '003_missing_indexes.sql'), indexLines.join('\n') + '\n');

  fs.writeFileSync(path.join(REPAIR_DIR, '004_views_and_rpc_functions.sql'), rpcAndViewTemplates(findings));
  fs.writeFileSync(path.join(REPAIR_DIR, '005_rbac_and_audit_integrity.sql'), rbacIntegritySql(dbs));
}

function compatibilityViews(findings) {
  const lines = ['-- Compatibility views for known legacy names.'];
  const missing = new Set(findings.missingTables.filter((r) => r.old === 'missing').map((r) => r.table));
  if (missing.has('supplier_invoices')) {
    lines.push(`
CREATE OR REPLACE VIEW public.supplier_invoices WITH (security_invoker = true) AS
SELECT * FROM public.store_supplier_invoices;`);
  }
  if (missing.has('bar_stock_ledger')) {
    lines.push(`
CREATE OR REPLACE VIEW public.bar_stock_ledger WITH (security_invoker = true) AS
SELECT * FROM public.branch_stock_movements;`);
  }
  return lines.join('\n');
}

function rpcAndViewTemplates(findings) {
  const routines = new Set(findings.missingRoutines.filter((r) => r.old === 'missing').map((r) => r.routine));
  const lines = [
    '-- 004 Views and RPC function compatibility drafts',
    '-- Review business logic before applying; these preserve route availability but may need domain-specific refinement.',
    '',
  ];
  if (routines.has('cleanup_expired_otps')) {
    lines.push(`CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE affected INTEGER;
BEGIN
  UPDATE public.store_dispatches
  SET otp_code = NULL, otp_expires_at = NULL
  WHERE otp_expires_at IS NOT NULL AND otp_expires_at < now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;`);
  }
  if (routines.has('generate_dispatch_otp')) {
    lines.push(`CREATE OR REPLACE FUNCTION public.generate_dispatch_otp(dispatch_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE code TEXT;
BEGIN
  code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  UPDATE public.store_dispatches
  SET otp_code = code, otp_expires_at = now() + interval '15 minutes', updated_at = now()
  WHERE id = dispatch_id;
  RETURN code;
END;
$$;`);
  }
  if (routines.has('verify_dispatch_otp')) {
    lines.push(`CREATE OR REPLACE FUNCTION public.verify_dispatch_otp(dispatch_id UUID, provided_otp TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE ok BOOLEAN;
BEGIN
  SELECT otp_code = provided_otp AND otp_expires_at > now()
  INTO ok
  FROM public.store_dispatches
  WHERE id = dispatch_id;
  RETURN coalesce(ok, false);
END;
$$;`);
  }
  if (routines.has('update_tab_total')) {
    lines.push(`CREATE OR REPLACE FUNCTION public.update_tab_total(tab_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Placeholder compatibility function. Confirm bar tab table names before applying.
  RETURN;
END;
$$;`);
  }
  if (routines.has('update_stock_level') || routines.has('receive_purchase_order')) {
    lines.push(`-- update_stock_level and receive_purchase_order are inventory-mutating RPCs.
-- Do not add permissive placeholder functions for them.
-- Implement them through the canonical inventory movement ledger service instead.`);
  }
  if (routines.has('calculate_conference_invoice_with_attendance')) {
    lines.push(`-- calculate_conference_invoice_with_attendance requires conference billing rules.
-- Keep as a controller/service implementation unless the finalized function body is reviewed.`);
  }
  return lines.join('\n') + '\n';
}

function rbacIntegritySql(dbs) {
  return `-- 005 RBAC and audit integrity
-- Do not merge public.users and public.staff_profiles.
-- public.users = login/auth records.
-- public.staff_profiles = HR/personnel records.

CREATE TABLE IF NOT EXISTS public.user_branch_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  branch_id INTEGER REFERENCES public.branches(id),
  role TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id, role)
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER REFERENCES public.branches(id),
  actor_user_id UUID,
  actor_staff_id UUID,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  before_value JSONB,
  after_value JSONB,
  reason TEXT,
  source_document TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_branch_created ON public.audit_events (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_branch_roles_user_branch ON public.user_branch_roles (user_id, branch_id);
`;
}

async function main() {
  const env = { ...process.env, ...loadEnv(path.join(BACKEND, '.env')) };
  const oldUrl = env.DATABASE_URL || env.DATABASE_URL_OLD;
  const oldAlt = env.DATABASE_URL_OLD && env.DATABASE_URL_OLD !== oldUrl ? env.DATABASE_URL_OLD : null;
  const nextUrl = env.DATABASE_URL_NEW;

  console.log('Dual DB schema audit starting...');
  console.log('Scanning backend and migrations...');
  const code = scanBackendCode();
  const migrations = scanMigrations();

  console.log('Inspecting DATABASE_URL / DATABASE_URL_OLD...');
  const oldDb = await inspectDb('DATABASE_URL', oldUrl);
  if (oldAlt) await inspectDb('DATABASE_URL_OLD', oldAlt);
  console.log('Inspecting DATABASE_URL_NEW...');
  const nextDb = await inspectDb('DATABASE_URL_NEW', nextUrl);

  const dbs = { old: oldDb, next: nextDb };
  const findings = compare(code, migrations, dbs);
  writeReports(code, migrations, dbs, findings);

  console.log('Audit complete.');
  console.log(`Reports: ${path.relative(ROOT, REPORT_DIR)}`);
  console.log(`Repair scripts: ${path.relative(ROOT, REPAIR_DIR)}`);
  console.log(`Missing tables/views: ${findings.missingTables.length}`);
  console.log(`Missing RPCs: ${findings.missingRoutines.length}`);
  console.log(`Missing columns: ${findings.missingColumns.length}`);
  console.log(`Missing relationship hints: ${findings.missingRelationships.length}`);
  console.log(`Missing index recommendations: ${findings.missingIndexes.length}`);
}

main().catch((error) => {
  console.error('Audit failed:', error.message);
  process.exit(1);
});
