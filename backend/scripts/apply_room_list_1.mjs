/**
 * Room List 1 — Implementation Script
 * Applies the authoritative Room List 1 CSV to the live database.
 * Steps: VIP type, rate plans, category fixes, price overrides, missing rooms, room_type sync.
 * No schema changes. Data only.
 *
 * Usage (from backend/ directory):
 *   node --env-file=.env scripts/apply_room_list_1.mjs --dry-run
 *   node --env-file=.env scripts/apply_room_list_1.mjs
 */

import { createClient } from '@supabase/supabase-js';

const DRY = process.argv.includes('--dry-run');

const sb = createClient(
  process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

let errors = 0;

async function dbInsert(table, payload, label) {
  if (DRY) { console.log('  [DRY] INSERT ' + table + ' ' + label); return null; }
  const { data, error } = await sb.from(table).insert(payload).select('id').single();
  if (error) { console.error('  ERR ' + label + ': ' + error.message); errors++; return null; }
  console.log('  OK  ' + label);
  return data;
}

async function dbUpdate(table, payload, filters, label) {
  if (DRY) { console.log('  [DRY] UPDATE ' + table + ' WHERE ' + JSON.stringify(filters) + ' -> ' + JSON.stringify(payload)); return; }
  let q = sb.from(table).update(payload);
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { data, error } = await q.select('id');
  if (error) { console.error('  ERR ' + label + ': ' + error.message); errors++; }
  else if (!data || data.length === 0) console.log('  MISS ' + label + ' (no row matched)');
  else console.log('  OK  ' + label);
}

async function exists(table, filters) {
  let q = sb.from(table).select('id').limit(1);
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { data } = await q;
  return data && data.length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + (DRY ? '[DRY-RUN] ' : '[LIVE] ') + 'Room List 1 — Apply Implementation\n');

  // ── STEP 1: Ensure VIP room type exists ──────────────────────────────────
  console.log('━━  STEP 1: VIP room type');
  let vipId;
  const { data: existingVip } = await sb.from('room_types').select('id').eq('branch_id', 1).eq('code', 'VIP').limit(1);
  if (existingVip && existingVip.length > 0) {
    vipId = existingVip[0].id;
    console.log('  SKIP VIP type already exists id=' + vipId);
  } else {
    const row = await dbInsert('room_types', {
      branch_id: 1,
      code: 'VIP',
      name: 'VIP',
      type_name: 'VIP',
      base_rate: 3000,
      price_per_night: 3000,
      rate: 3000,
      max_occupancy: 2,
      amenities: [],
      is_active: true,
    }, 'VIP room type');
    vipId = row?.id;
  }
  if (!vipId && !DRY) { console.error('Cannot continue without VIP room type id.'); process.exit(1); }

  // ── Fetch all branch 1 room type ids ─────────────────────────────────────
  const { data: allTypes } = await sb.from('room_types').select('id, code, name, base_rate').eq('branch_id', 1);
  const byCode = {};
  for (const t of (allTypes || [])) byCode[t.code] = t;
  if (!DRY) {
    byCode['VIP'] = byCode['VIP'] || { id: vipId, name: 'VIP', base_rate: 3000 };
  }

  const STD = byCode['STD']?.id;
  const DLX = byCode['DLX']?.id;
  const DTW = byCode['DTW']?.id;
  const EXE = byCode['EXE']?.id;
  const VIP = byCode['VIP']?.id ?? vipId;

  console.log('  Type IDs: STD=' + STD?.slice(0,8) + ' DLX=' + DLX?.slice(0,8) + ' DTW=' + DTW?.slice(0,8) + ' EXE=' + EXE?.slice(0,8) + ' VIP=' + (VIP ?? 'TBD').toString().slice(0,8));

  // ── STEP 2: Rate plans (one per type, branch-scoped) ─────────────────────
  console.log('\n━━  STEP 2: Default meal-basis rate plans');
  const plans = [
    { code: 'STD-BO', name: 'Standard – Bed Only',          room_type_id: STD, meal_plan: 'bed_only',      rate_per_night: 2000 },
    { code: 'DLX-BB', name: 'Deluxe – Bed & Breakfast',     room_type_id: DLX, meal_plan: 'bed_breakfast', rate_per_night: 3500 },
    { code: 'DTW-BB', name: 'Deluxe Twin – Bed & Breakfast', room_type_id: DTW, meal_plan: 'bed_breakfast', rate_per_night: 5000 },
    { code: 'EXE-BB', name: 'Executive – Bed & Breakfast',  room_type_id: EXE, meal_plan: 'bed_breakfast', rate_per_night: 5500 },
    { code: 'VIP-BB', name: 'VIP – Bed & Breakfast',        room_type_id: VIP, meal_plan: 'bed_breakfast', rate_per_night: 3000 },
  ];
  for (const p of plans) {
    if (!p.room_type_id && !DRY) { console.log('  SKIP ' + p.code + ' (no type id)'); continue; }
    if (await exists('rate_plans', { branch_id: 1, code: p.code })) {
      console.log('  SKIP ' + p.code + ' already exists');
      continue;
    }
    await dbInsert('rate_plans', { ...p, branch_id: 1, is_active: true }, p.code + ' (' + p.meal_plan + ' / KES ' + p.rate_per_night + ')');
  }

  // ── STEP 3: Fix room category assignments ─────────────────────────────────
  console.log('\n━━  STEP 3: Fix category assignments');

  // Standard → Deluxe
  const toDeluxe = ['FA 01','FA 02','FA 03','FA 04','FA 05','FA 06','FA 07','FA 08','FA 13',
                    'FB 01','FB 02','FB 03','FB 04','FB 05','FB 06','FB 07','FB 08','FB 13'];
  for (const rn of toDeluxe) {
    await dbUpdate('rooms', { room_type_id: DLX, type_id: DLX, room_type: 'Deluxe' },
      { branch_id: 1, room_number: rn }, rn + ' STD→DLX');
  }

  // Standard → Deluxe Twin
  for (const rn of ['FB 17', 'FB 18']) {
    await dbUpdate('rooms', { room_type_id: DTW, type_id: DTW, room_type: 'Deluxe Twin' },
      { branch_id: 1, room_number: rn }, rn + ' STD→DTW');
  }

  // Deluxe → Standard (FG 47)
  await dbUpdate('rooms', { room_type_id: STD, type_id: STD, room_type: 'Standard' },
    { branch_id: 1, room_number: 'FG 47' }, 'FG 47 DLX→STD');

  // Executive → VIP
  for (const rn of ['FB 14', 'FC 01-A', 'FC 01-B']) {
    await dbUpdate('rooms', { room_type_id: VIP, type_id: VIP, room_type: 'VIP', is_vip: true },
      { branch_id: 1, room_number: rn }, rn + ' EXE→VIP');
  }

  // ── STEP 4: Price overrides ───────────────────────────────────────────────
  console.log('\n━━  STEP 4: Price overrides');
  const overrides = [
    ['FA 11', 7000, 'Executive Twin override'],
    ['FB 17', 6000, 'Triple override'],
    ['FG 52', 3000, 'Twin Standard override'],
    ['FG 54', 2500, 'Executive Standard override'],
    ['FG 56', 3000, 'Twin Standard override'],
  ];
  for (const [rn, price, note] of overrides) {
    await dbUpdate('rooms', { price_override: price },
      { branch_id: 1, room_number: rn }, rn + ' price_override=' + price + ' (' + note + ')');
  }

  // ── STEP 5: Insert 9 missing Standard rooms ───────────────────────────────
  console.log('\n━━  STEP 5: Create missing rooms');
  // FG53-60 inferred floor 5 (FG4x=floor4, FG5x=floor5, FG6x=floor6 pattern)
  // FG68 inferred floor 6
  const newRooms = [
    { room_number: 'FG 53', floor: '5' },
    { room_number: 'FG 54', floor: '5', price_override: 2500 },
    { room_number: 'FG 55', floor: '5' },
    { room_number: 'FG 56', floor: '5', price_override: 3000 },
    { room_number: 'FG 57', floor: '5' },
    { room_number: 'FG 58', floor: '5' },
    { room_number: 'FG 59', floor: '5' },
    { room_number: 'FG 60', floor: '5' },
    { room_number: 'FG 68', floor: '6' },
  ];
  for (const r of newRooms) {
    if (await exists('rooms', { branch_id: 1, room_number: r.room_number })) {
      console.log('  SKIP ' + r.room_number + ' already exists');
      continue;
    }
    const payload = {
      branch_id: 1,
      building: 'FG',
      floor: r.floor,
      room_number: r.room_number,
      room_type_id: STD,
      type_id: STD,
      room_type: 'Standard',
      status: 'available',
      housekeeping_status: 'clean',
      hk_status: 'vacant_clean',
      is_active: true,
      is_clean: true,
      max_occupancy: 2,
      amenities: [],
      cleaning_priority: 'normal',
      is_vip: false,
    };
    if (r.price_override) payload.price_override = r.price_override;
    await dbInsert('rooms', payload, r.room_number + (r.price_override ? ' (override ' + r.price_override + ')' : ''));
  }

  // ── STEP 6: Sync room_type text for every branch 1 room ──────────────────
  console.log('\n━━  STEP 6: Sync room_type text column');
  const typeNameMap = {};
  for (const t of (allTypes || [])) typeNameMap[t.id] = t.name;
  if (vipId) typeNameMap[vipId] = 'VIP';

  const { data: allRooms } = await sb.from('rooms').select('id, room_number, room_type_id, room_type').eq('branch_id', 1);
  let synced = 0, alreadyOk = 0;
  for (const r of (allRooms || [])) {
    const expected = typeNameMap[r.room_type_id] ?? null;
    if (r.room_type === expected) { alreadyOk++; continue; }
    if (DRY) { console.log('  [DRY] ' + r.room_number + ' room_type: "' + r.room_type + '" → "' + expected + '"'); synced++; continue; }
    const { error } = await sb.from('rooms').update({ room_type: expected }).eq('id', r.id);
    if (error) { console.error('  ERR ' + r.room_number + ': ' + error.message); errors++; }
    else synced++;
  }
  console.log('  ' + synced + ' synced, ' + alreadyOk + ' already correct');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━  COMPLETE  ━━━━━━━━━━━━━━━━━━');
  console.log('  Errors: ' + errors);
  if (errors > 0) console.log('  Review errors above before proceeding.');
  else             console.log('  All steps completed successfully.');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
