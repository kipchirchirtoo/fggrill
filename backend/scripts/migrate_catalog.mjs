/**
 * FGH Master Catalog Migration
 *
 * Phase 1 — Rename / merge / deactivate simple_items to standardised FGH-{CATEGORY}-{NNN} SKUs
 * Phase 2 — Populate branch_stock for branches 2, 5 and Sotik with every active master-catalog item
 *
 * Setup:
 *   Copy the following CSV files into backend/scripts/ :
 *     FGH_Cleaned_Stock_Master.csv
 *     FGH_SKU_Mapping_Corrected.csv
 *     FGH_Removed_POS_and_Pastry_Items.csv
 *
 * Usage (from backend/ directory):
 *   node --env-file=.env scripts/migrate_catalog.mjs --dry-run          # preview only
 *   node --env-file=.env scripts/migrate_catalog.mjs --phase=1          # catalog only
 *   node --env-file=.env scripts/migrate_catalog.mjs --phase=2          # branch stock only
 *   node --env-file=.env scripts/migrate_catalog.mjs                    # both phases (LIVE)
 */

import 'dotenv/config';
import { createClient }          from '@supabase/supabase-js';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { resolve, dirname }      from 'path';
import { fileURLToPath }         from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ─── CLI ──────────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const DRY_RUN  = args.includes('--dry-run');
const phaseStr = (args.find(a => a.startsWith('--phase=')) ?? '').split('=')[1] ?? 'all';
const PHASE1   = phaseStr === 'all' || phaseStr === '1';
const PHASE2   = phaseStr === 'all' || phaseStr === '2';

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Set SUPABASE_PROJECT_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ─── Log ──────────────────────────────────────────────────────────────────────
const LOG_PATH = resolve(__dir, 'migration_log.txt');
writeFileSync(LOG_PATH, `=== FGH Catalog Migration ${new Date().toISOString()} [${DRY_RUN ? 'DRY-RUN' : 'LIVE'}] phase=${phaseStr} ===\n`);

function log(...parts) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${parts.join(' ')}`;
  console.log(line);
  appendFileSync(LOG_PATH, line + '\n');
}

// ─── CSV parser (zero deps) ───────────────────────────────────────────────────
function readCSV(filename) {
  const fullPath = resolve(__dir, filename);
  if (!existsSync(fullPath)) {
    console.error(`❌  CSV not found: ${fullPath}`);
    console.error(`    Place the CSV file in backend/scripts/ and re-run.`);
    process.exit(1);
  }
  const raw  = readFileSync(fullPath, 'utf8');
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n');
  const headers = parseCSVLine(lines[0]);

  return lines
    .slice(1)
    .filter(l => l.trim())
    .map(l => {
      const vals = parseCSVLine(l);
      const row  = {};
      headers.forEach((h, i) => { row[h.trim()] = (vals[i] ?? '').trim(); });
      return row;
    });
}

function parseCSVLine(line) {
  const result = []; let inQ = false; let cur = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (!inQ) { inQ = true; }
      else if (line[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = false; }
    } else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += c; }
  }
  result.push(cur);
  return result;
}

// ─── Stats ────────────────────────────────────────────────────────────────────
const S = {
  renamed: 0, deactivated: 0, skipped: 0, errors: 0,
  bs_created: 0, bs_existing: 0, bs_errors: 0,
};

// ─── Phase 1 ─────────────────────────────────────────────────────────────────
async function runPhase1(skuMap, removed) {
  log('━━━━━━  PHASE 1: Migrate simple_items to FGH-* SKUs  ━━━━━━');

  // --- Build action sets ---

  // 1. Items to deactivate (POS items, non-bread pastry, merged duplicates)
  const deactivateSkus = new Set(
    removed.map(r => r.old_sku || r['Old SKU'] || r.sku).filter(Boolean)
  );

  // 2. Renames: RENAME or KEEP / RENAME rows in the mapping
  const renames = [];

  for (const row of skuMap) {
    const action   = (row.action || row.Action || '').toUpperCase().trim();
    const oldSku   = (row.old_sku || row['Old SKU'] || '').trim();
    const newSku   = (row.new_sku || row['New SKU'] || '').trim();
    const newName  = (row.new_item_name || row['New Item Name'] || row.item_name || '').trim();
    const newCat   = (row.new_category  || row['New Category']  || row.category  || '').trim();

    if (!oldSku || !newSku) continue;

    if (action === 'RENAME' || action === 'KEEP / RENAME') {
      renames.push({ old_sku: oldSku, new_sku: newSku, new_name: newName, new_category: newCat });
    } else if (action === 'MERGE INTO') {
      deactivateSkus.add(oldSku);     // merged-away duplicates → deactivate
    } else if (action.startsWith('REMOVE')) {
      deactivateSkus.add(oldSku);
    }
  }

  // Never deactivate a row that is the selected rename source
  const renameOldSkus  = new Set(renames.map(r => r.old_sku));
  const toDeactivate   = [...deactivateSkus].filter(s => !renameOldSkus.has(s));

  log(`  Renames:       ${renames.length}`);
  log(`  Deactivations: ${toDeactivate.length}`);

  // --- 1a. Deactivate merged / removed items ---
  log(`  Deactivating ${toDeactivate.length} items...`);
  const BATCH = 100;
  for (let i = 0; i < toDeactivate.length; i += BATCH) {
    const batch = toDeactivate.slice(i, i + BATCH);
    if (DRY_RUN) { S.deactivated += batch.length; continue; }
    const { error } = await sb.from('simple_items').update({ is_active: false }).in('sku', batch);
    if (error) { log(`  ❌ deactivate batch ${i}: ${error.message}`); S.errors += batch.length; }
    else        { S.deactivated += batch.length; }
  }
  log(`  ✓ Deactivated ${S.deactivated}`);

  // --- 1b. Check which FGH-* SKUs already exist (idempotency) ---
  const { data: existing } = await sb.from('simple_items').select('sku').like('sku', 'FGH-%');
  const alreadyNew = new Set((existing ?? []).map(r => r.sku));
  log(`  Already on FGH-* format: ${alreadyNew.size}`);

  // --- 1c. Rename items one-by-one (sku is not a FK to anything with data) ---
  log(`  Renaming ${renames.length} items...`);
  for (let i = 0; i < renames.length; i++) {
    const { old_sku, new_sku, new_name, new_category } = renames[i];
    if (i > 0 && i % 50 === 0) log(`    ... ${i}/${renames.length}`);

    // Idempotent: if the new SKU already exists, skip
    if (alreadyNew.has(new_sku)) { S.skipped++; continue; }

    const upd = { sku: new_sku };
    if (new_name)     upd.item_name = new_name;
    if (new_category) upd.category  = new_category;

    if (DRY_RUN) { S.renamed++; alreadyNew.add(new_sku); continue; }

    const { error } = await sb.from('simple_items').update(upd).eq('sku', old_sku);
    if (error) {
      log(`  ❌ rename ${old_sku} → ${new_sku}: ${error.message}`);
      S.errors++;
    } else {
      S.renamed++;
      alreadyNew.add(new_sku);
    }
  }
  log(`  ✓ Renamed ${S.renamed}  (${S.skipped} already on FGH-* format, ${S.errors} errors)`);
}

// ─── Phase 2 ─────────────────────────────────────────────────────────────────
async function runPhase2() {
  log('━━━━━━  PHASE 2: Populate branch_stock (branches 2, 5, Sotik)  ━━━━━━');

  // --- Resolve branches ---
  const { data: branches, error: bErr } = await sb.from('branches').select('id, name').order('id');
  if (bErr) { log(`  ❌ branches fetch: ${bErr.message}`); return; }
  log(`  All branches: ${branches.map(b => `${b.id}:${b.name}`).join(', ')}`);

  const targetBranches = new Map();
  for (const b of branches) {
    const n = (b.name ?? '').toLowerCase();
    if (b.id === 2 || b.id === 5 || n.includes('sotik')) {
      targetBranches.set(b.id, b.name);
    }
  }
  if (targetBranches.size === 0) {
    log('  ❌ No target branches found (expected ids 2 & 5 plus "Sotik" in name)');
    return;
  }
  log(`  Target branches: ${[...targetBranches.entries()].map(([id, n]) => `${id}:${n}`).join(', ')}`);

  // --- Fetch active master-catalog items ---
  const { data: items, error: iErr } = await sb
    .from('simple_items')
    .select('id, sku, item_name, category, unit_of_measure, cost_price, retail_price, quantity, store_type, branch_id')
    .eq('is_active', true)
    .order('sku');

  if (iErr) { log(`  ❌ simple_items fetch: ${iErr.message}`); return; }
  log(`  Active catalog items: ${items.length}`);

  // --- Fetch existing branch_stock rows for our branches ---
  const branchIds = [...targetBranches.keys()];
  const { data: existing, error: exErr } = await sb
    .from('branch_stock')
    .select('branch_id, item_sku')
    .in('branch_id', branchIds);

  if (exErr) { log(`  ❌ existing branch_stock fetch: ${exErr.message}`); return; }

  const existingSet = new Set((existing ?? []).map(r => `${r.branch_id}:${r.item_sku}`));
  log(`  Existing branch_stock entries for these branches: ${existingSet.size}`);

  // --- Build inserts ---
  const toInsert = [];
  for (const [branchId] of targetBranches) {
    for (const item of items) {
      // Branch-scoped items only go into their own branch; global items go to all
      if (item.branch_id && item.branch_id !== branchId) continue;

      const key = `${branchId}:${item.sku}`;
      if (existingSet.has(key)) { S.bs_existing++; continue; }

      toInsert.push({
        branch_id: branchId,
        item_sku:  item.sku,
        quantity:  item.quantity ?? 0,
      });
    }
  }

  log(`  New branch_stock rows to create: ${toInsert.length}  (${S.bs_existing} already exist)`);

  if (DRY_RUN) {
    S.bs_created = toInsert.length;
    // Print sample
    log('  [DRY-RUN] Sample of rows that would be inserted:');
    toInsert.slice(0, 5).forEach(r => log(`    branch ${r.branch_id}: ${r.item_sku}`));
    if (toInsert.length > 5) log(`    ... and ${toInsert.length - 5} more`);
    return;
  }

  const BATCH = 200;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    // unique_branch_item constraint → upsert with ignoreDuplicates for safety
    const { error } = await sb
      .from('branch_stock')
      .upsert(batch, { onConflict: 'branch_id,item_sku', ignoreDuplicates: true });

    if (error) {
      log(`  ❌ insert batch ${i}–${i + batch.length}: ${error.message}`);
      S.bs_errors += batch.length;
    } else {
      S.bs_created += batch.length;
      if (i % 1000 === 0 && i > 0) log(`    ... ${i}/${toInsert.length}`);
    }
  }
  log(`  ✓ Created ${S.bs_created} branch_stock entries (${S.bs_errors} errors)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log();
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log(`║   FGH MASTER CATALOG MIGRATION  ${DRY_RUN ? '  [DRY RUN — no writes]' : '  [LIVE — CHANGES APPLY]'}  ║`);
  console.log(`║   Phase: ${phaseStr.padEnd(51)}║`);
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log();

  if (!DRY_RUN) {
    console.log('⚠️   LIVE run — database will be modified.');
    console.log('    You have 5 seconds to Ctrl-C if you meant --dry-run');
    console.log();
    await new Promise(r => setTimeout(r, 5000));
  }

  if (PHASE1) {
    const skuMap  = readCSV('FGH_SKU_Mapping_Corrected.csv');
    const removed = readCSV('FGH_Removed_POS_and_Pastry_Items.csv');
    log(`Loaded SKU mapping: ${skuMap.length} rows  |  Removed items: ${removed.length} rows`);
    // Print first row headers for debugging
    if (skuMap.length > 0) log(`  SKU map headers: ${Object.keys(skuMap[0]).join(', ')}`);
    if (removed.length > 0) log(`  Removed headers: ${Object.keys(removed[0]).join(', ')}`);
    await runPhase1(skuMap, removed);
  }

  if (PHASE2) {
    await runPhase2();
  }

  console.log();
  console.log('━━━━━━━━━━━━━━━━━━  RESULTS  ━━━━━━━━━━━━━━━━━━');
  if (PHASE1) {
    console.log(`  simple_items renamed:      ${S.renamed}`);
    console.log(`  simple_items deactivated:  ${S.deactivated}`);
    console.log(`  Already on FGH-* (skipped): ${S.skipped}`);
    console.log(`  Errors:                    ${S.errors}`);
  }
  if (PHASE2) {
    console.log(`  branch_stock created:      ${S.bs_created}`);
    console.log(`  branch_stock already had:  ${S.bs_existing}`);
    console.log(`  branch_stock errors:       ${S.bs_errors}`);
  }
  console.log(`  Log file: ${LOG_PATH}`);
  console.log();

  log('Migration complete:', JSON.stringify(S));
}

main().catch(err => {
  console.error('💥 Fatal error:', err.message ?? err);
  process.exit(1);
});
