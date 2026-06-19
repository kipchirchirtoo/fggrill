import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const url = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const BRANCH_ID = 2; // BOMET TOWN

// Tables where branch_id is reliably populated.
const BRANCH_ID_TABLES = [
  'pos_void_requests',
  'cashier_transactions',
  'cashier_shift_logs',
  'pos_shift_orders',
  'staff_credit_bills',
  'credit_bills',
  'pos_outlet_shifts',
];

// Tables where branch_id is NULL on every row (data-quality gap) — scope via shift_id instead,
// referencing pos_outlet_shifts.id.
const POS_SHIFT_ID_TABLES = ['pos_shift_payments'];
// These reference cashier_shift_logs.id (a separate shift-id namespace), also NULL branch_id.
const LOG_SHIFT_ID_TABLES = ['cashier_shift_transactions', 'shift_transactions'];
const SHIFT_ID_TABLES = [...POS_SHIFT_ID_TABLES, ...LOG_SHIFT_ID_TABLES];

// Leaf tables first, root (pos_outlet_shifts) last, to respect FK references.
const TABLES_IN_DELETE_ORDER = [
  'pos_shift_payments',
  'pos_void_requests',
  'cashier_shift_transactions',
  'cashier_transactions',
  'shift_transactions',
  'cashier_shift_logs',
  'pos_shift_orders',
  'staff_credit_bills',
  'credit_bills',
  'pos_outlet_shifts',
];

let bometShiftIds: string[] = [];
let bometLogShiftIds: string[] = [];

async function loadBometShiftIds() {
  const { data, error } = await supabase.from('pos_outlet_shifts').select('id').eq('branch_id', BRANCH_ID);
  if (error) throw new Error(`pos_outlet_shifts: ${error.message}`);
  bometShiftIds = (data || []).map((r: any) => r.id);
  console.log(`Bomet Town pos_outlet_shifts ids: ${bometShiftIds.join(', ')}`);

  const logsRes = await supabase.from('cashier_shift_logs').select('id').eq('branch_id', BRANCH_ID);
  if (logsRes.error) throw new Error(`cashier_shift_logs: ${logsRes.error.message}`);
  bometLogShiftIds = (logsRes.data || []).map((r: any) => r.id);
  console.log(`Bomet Town cashier_shift_logs ids: ${bometLogShiftIds.join(', ')}`);
}

function filterFor(query: any, table: string) {
  if (POS_SHIFT_ID_TABLES.includes(table)) return query.in('shift_id', bometShiftIds);
  if (LOG_SHIFT_ID_TABLES.includes(table)) return query.in('shift_id', bometLogShiftIds);
  return query.eq('branch_id', BRANCH_ID);
}

async function fetchAllForBranch(table: string) {
  const pageSize = 1000;
  let from = 0;
  let all: any[] = [];
  while (true) {
    let q = supabase.from(table).select('*').range(from, from + pageSize - 1);
    q = filterFor(q, table);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function backup() {
  await loadBometShiftIds();
  const snapshot: Record<string, any[]> = {};
  for (const table of TABLES_IN_DELETE_ORDER) {
    const rows = await fetchAllForBranch(table);
    snapshot[table] = rows;
    console.log(`Backed up ${rows.length} rows from ${table}`);
  }
  const outDir = '/home/john/db-backups';
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `bomet-town-purge-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log(`\nBackup written to ${outPath}`);
  return outPath;
}

async function purge() {
  await loadBometShiftIds();
  for (const table of TABLES_IN_DELETE_ORDER) {
    let q = supabase.from(table).delete({ count: 'exact' });
    q = filterFor(q, table);
    const { error, count } = await q;
    if (error) {
      console.log(`[FAILED] ${table}: ${error.message}`);
    } else {
      console.log(`[DELETED] ${table}: ${count} rows`);
    }
  }
}

async function verify() {
  console.log('\n--- Post-purge verification (should all be 0) ---');
  for (const table of BRANCH_ID_TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', BRANCH_ID);
    console.log(`${table}: ${error ? error.message : count}`);
  }
  const placeholder = ['00000000-0000-0000-0000-000000000000'];
  for (const table of SHIFT_ID_TABLES) {
    const ids = POS_SHIFT_ID_TABLES.includes(table) ? bometShiftIds : bometLogShiftIds;
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .in('shift_id', ids.length ? ids : placeholder);
    console.log(`${table}: ${error ? error.message : count}`);
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'backup') {
    await backup();
  } else if (mode === 'delete') {
    await purge();
    await verify();
  } else {
    console.log('Usage: ts-node purge-bomet-town.ts [backup|delete]');
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
