/**
 * Kyogong Branch Menu Import
 *
 * Imports 263 approved items from kyogong_menu_import.json into pos_outlet_items
 * targeting the Kyogong Restaurant POS and Kyogong Choma Zone POS outlets.
 *
 * Usage (from backend/ directory):
 *   node --env-file=.env scripts/import_kyogong_menu.mjs --dry-run   # preview
 *   node --env-file=.env scripts/import_kyogong_menu.mjs              # live import
 */

import 'dotenv/config';
import { createClient }        from '@supabase/supabase-js';
import { readFileSync, writeFileSync, appendFileSync } from 'fs';
import { resolve, dirname }    from 'path';
import { fileURLToPath }       from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────────────────────────
const BRANCH_ID  = 1;   // Kyogong
const OUTLETS = {
  RESTAURANT: 'e21e2b3b-cdd4-4bca-a552-5a6cf0989907', // Kyogong Restaurant POS
  CHOMA_ZONE: '571454c8-5987-4716-b1c8-74992e735050', // Kyogong Choma Zone POS
};
// Chomazone category items also appear in the Choma Zone POS
const CHOMA_CATEGORY = 'Chomazone';

const JSON_PATH = 'c:/Users/user/Downloads/kyogong_menu_import.json';

// ─── CLI ─────────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Supabase ────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('❌  Missing env vars'); process.exit(1); }
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ─── Log ─────────────────────────────────────────────────────────────────────
const LOG = resolve(__dir, 'menu_import_log.txt');
writeFileSync(LOG, `=== Kyogong Menu Import ${new Date().toISOString()} [${DRY_RUN ? 'DRY-RUN' : 'LIVE'}] ===\n`);
function log(...parts) {
  const line = `[${new Date().toISOString().slice(11,19)}] ${parts.join(' ')}`;
  console.log(line);
  appendFileSync(LOG, line + '\n');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const norm  = s => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const pause = ms => new Promise(r => setTimeout(r, ms));

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log();
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log(`║  KYOGONG MENU IMPORT  ${DRY_RUN ? '[DRY RUN]                     ' : '[LIVE — WRITES TO DATABASE]  '}║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();

  if (!DRY_RUN) {
    console.log('⚠️   Live run — database will be modified. 5 seconds to Ctrl-C...\n');
    await pause(5000);
  }

  // ── 1. Load JSON ───────────────────────────────────────────────────────────
  const rawJson  = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
  const allRows  = rawJson.records;
  // User confirmed: import all records as-is, including review items
  const approved = allRows;
  const skipped  = [];

  log(`Loaded ${allRows.length} records → ${approved.length} approved, ${skipped.length} skipped`);

  // ── 2. Show skipped / review items ────────────────────────────────────────
  log('\n── SKIPPED (review required) ──');
  skipped.forEach(r => log(`  #${r.record_no} [${r.main_category}] "${r.display_name}" KES ${r.price_kes} | ${r.review_note}`));

  // ── 3. Load existing Kyogong outlet items ─────────────────────────────────
  const allOutletIds = Object.values(OUTLETS);
  const { data: existing, error: exErr } = await sb
    .from('pos_outlet_items')
    .select('id, outlet_id, name, selling_price, is_active')
    .in('outlet_id', allOutletIds);
  if (exErr) { log('❌ fetch existing:', exErr.message); process.exit(1); }

  // Build lookup: outlet_id → Map<normName, row>
  const existingMap = {};
  for (const outId of allOutletIds) existingMap[outId] = new Map();
  for (const row of (existing ?? [])) {
    existingMap[row.outlet_id]?.set(norm(row.name), row);
  }
  log(`\nExisting items in Kyogong outlets: ${existing?.length ?? 0}`);

  // ── 4. Plan the import ────────────────────────────────────────────────────
  const toCreate  = [];  // new items per outlet
  const toUpdate  = [];  // price/active changes
  const unchanged = [];
  const duplicates = [];

  // Detect duplicates within the approved set (same norm name in same category)
  const seenInApproved = new Map(); // normName → first record
  for (const r of approved) {
    const key = `${r.main_category}::${norm(r.display_name)}`;
    if (seenInApproved.has(key)) {
      duplicates.push({ first: seenInApproved.get(key), second: r });
    } else {
      seenInApproved.set(key, r);
    }
  }

  // Build insert/update batches — one entry per (outlet × item)
  for (const r of approved) {
    const outletIds = [OUTLETS.RESTAURANT];
    if (r.main_category === CHOMA_CATEGORY) outletIds.push(OUTLETS.CHOMA_ZONE);

    for (const outId of outletIds) {
      const existRow = existingMap[outId]?.get(norm(r.display_name));

      const payload = {
        outlet_id:     outId,
        branch_id:     BRANCH_ID,
        name:          r.display_name,
        category:      r.main_category,
        selling_price: r.price_kes,
        is_active:     true,
        is_available:  true,
        status:        'active',
        current_stock: 9999,
        track_stock:   false,
        cost_price:    0,
        source_table:  'manual',
        unit:          'portion',
      };

      if (!existRow) {
        toCreate.push(payload);
      } else if (existRow.selling_price !== r.price_kes || !existRow.is_active) {
        toUpdate.push({ id: existRow.id, selling_price: r.price_kes, is_active: true });
      } else {
        unchanged.push({ name: r.display_name, outlet: outId });
      }
    }
  }

  log(`\n── IMPORT PLAN ──`);
  log(`  Create: ${toCreate.length}`);
  log(`  Update: ${toUpdate.length}`);
  log(`  Unchanged: ${unchanged.length}`);
  log(`  In-file duplicates: ${duplicates.length}`);

  // Categories that will be created
  const newCats = [...new Set(approved.map(r => r.main_category))];
  const newSubcats = [...new Set(approved.map(r => `${r.main_category} > ${r.subcategory}`))];
  log(`\n── CATEGORIES (${newCats.length}) ──`);
  newCats.forEach(c => log(`  ${c}`));
  log(`\n── SUBCATEGORIES (${newSubcats.length}) ──`);
  newSubcats.forEach(s => log(`  ${s}`));

  if (duplicates.length > 0) {
    log('\n── DUPLICATES ──');
    duplicates.forEach(({ first, second }) =>
      log(`  #${first.record_no} vs #${second.record_no}: "${first.display_name}" in [${first.main_category}]`)
    );
  }

  if (DRY_RUN) {
    log('\n[DRY-RUN] No changes made.');
    log('Sample of items that would be created:');
    toCreate.slice(0, 10).forEach(r => log(`  → "${r.name}" | ${r.category} | KES ${r.selling_price}`));
    if (toCreate.length > 10) log(`  ... and ${toCreate.length - 10} more`);
    printSummary({ created: toCreate.length, updated: toUpdate.length, unchanged: unchanged.length, skipped: skipped.length, duplicates: duplicates.length, verified: 0, rollback: 'N/A (dry run)' });
    return;
  }

  // ── 5. BACKUP: read current state ─────────────────────────────────────────
  const BACKUP_PATH = resolve(__dir, `menu_import_backup_${Date.now()}.json`);
  log(`\nBacking up existing Kyogong outlet items → ${BACKUP_PATH}`);
  writeFileSync(BACKUP_PATH, JSON.stringify(existing ?? [], null, 2));
  log(`✓ Backup saved (${existing?.length ?? 0} rows)`);

  // ── 6. Execute ────────────────────────────────────────────────────────────
  let created = 0, updated = 0, errors = 0;

  // CREATE
  if (toCreate.length > 0) {
    log(`\nInserting ${toCreate.length} new items...`);
    const BATCH = 100;
    for (let i = 0; i < toCreate.length; i += BATCH) {
      const batch = toCreate.slice(i, i + BATCH);
      const { error } = await sb.from('pos_outlet_items').insert(batch);
      if (error) { log(`❌ insert batch ${i}: ${error.message}`); errors += batch.length; }
      else        { created += batch.length; }
    }
    log(`✓ Created ${created}`);
  }

  // UPDATE
  if (toUpdate.length > 0) {
    log(`\nUpdating ${toUpdate.length} existing items...`);
    for (const upd of toUpdate) {
      const { error } = await sb.from('pos_outlet_items')
        .update({ selling_price: upd.selling_price, is_active: upd.is_active })
        .eq('id', upd.id);
      if (error) { log(`❌ update ${upd.id}: ${error.message}`); errors++; }
      else        { updated++; }
    }
    log(`✓ Updated ${updated}`);
  }

  // ── 7. VERIFY ─────────────────────────────────────────────────────────────
  log('\nVerifying import...');
  const approvedNames = new Set(approved.map(r => norm(r.display_name)));
  const { data: postImport } = await sb
    .from('pos_outlet_items')
    .select('name, category, selling_price, branch_id, is_active')
    .eq('outlet_id', OUTLETS.RESTAURANT)
    .eq('branch_id', BRANCH_ID);

  let verifyOk = 0, verifyFail = 0;
  const failures = [];
  for (const r of approved) {
    const found = (postImport ?? []).find(p => norm(p.name) === norm(r.display_name));
    if (!found) { verifyFail++; failures.push(`MISSING: ${r.display_name}`); }
    else if (found.selling_price !== r.price_kes) {
      verifyFail++;
      failures.push(`PRICE MISMATCH: ${r.display_name} expected ${r.price_kes} got ${found.selling_price}`);
    } else if (!found.is_active) {
      verifyFail++;
      failures.push(`INACTIVE: ${r.display_name}`);
    } else {
      verifyOk++;
    }
  }

  if (failures.length > 0) {
    log('⚠️  Verification failures:');
    failures.forEach(f => log('  ' + f));
  } else {
    log(`✓ All ${verifyOk} approved items verified`);
  }

  if (errors > 0) {
    log(`\n⚠️  ${errors} errors occurred. Consider restoring from backup: ${BACKUP_PATH}`);
  }

  printSummary({
    created,
    updated,
    unchanged: unchanged.length,
    skipped: skipped.length,
    duplicates: duplicates.length,
    verified: verifyOk,
    verifyFailed: verifyFail,
    errors,
    rollback: errors > 0 ? `Manual restore from: ${BACKUP_PATH}` : 'Not needed',
  });
}

function printSummary(s) {
  console.log('\n━━━━━━━━━━━━━━━━━━  FINAL REPORT  ━━━━━━━━━━━━━━━━━━');
  console.log(`  Created:           ${s.created}`);
  console.log(`  Updated:           ${s.updated}`);
  console.log(`  Unchanged:         ${s.unchanged}`);
  console.log(`  Skipped (review):  ${s.skipped}`);
  console.log(`  Duplicates found:  ${s.duplicates}`);
  console.log(`  Verified OK:       ${s.verified}`);
  if (s.verifyFailed) console.log(`  Verify failures:   ${s.verifyFailed}`);
  if (s.errors)       console.log(`  Errors:            ${s.errors}`);
  console.log(`  Rollback status:   ${s.rollback}`);
  console.log(`  Log file:          ${LOG}`);
  console.log();
}

main().catch(err => { console.error('💥 Fatal:', err.message); process.exit(1); });
