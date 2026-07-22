/**
 * Master Inventory Catalog + POS Outlet Analyser
 *
 * Usage:
 *   node scripts/analyse_catalog.mjs              → write catalog_report.md
 *   node scripts/analyse_catalog.mjs --inactive   → include inactive items
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing SUPABASE_PROJECT_URL / SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const args            = process.argv.slice(2);
const includeInactive = args.includes('--inactive');
const OUT_FILE        = resolve(import.meta.dirname, 'catalog_report.md');

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt  = (n) => Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const normalName = (s) => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
const lines = [];
const out   = (...parts) => lines.push(parts.join(''));

// ─── POS outlet categories in simple_items (these are NOT real stock) ────────
// Items in simple_items under these categories are actually POS menu entries
// duplicated into the catalog — they have no meaningful cost/qty and are
// managed via restaurant_menu_items / bar_drinks instead.
// NOTE: BAR DRINKS / SOFT DRINKS in simple_items ARE real stock (feeds bar POS).
const POS_ONLY_CATEGORIES = new Set(['KITCHEN MENU', 'PASTRY', 'food', 'FOOD']);

// ─── fetch everything in parallel ────────────────────────────────────────────
let catalogQuery = sb
  .from('simple_items')
  .select('id, sku, item_name, category, unit_of_measure, unit, cost_price, retail_price, quantity, store_type, is_active, branch_id')
  .order('category').order('item_name');
if (!includeInactive) catalogQuery = catalogQuery.eq('is_active', true);

const [
  { data: items,   error: itemsErr },
  { data: barDrinks },
  { data: menuItems },
  { data: branches },
] = await Promise.all([
  catalogQuery,
  sb.from('bar_drinks').select('id, name, category, sku, linked_inventory_sku, inventory_item_id, price, cost_price, is_available, branch_id').order('name'),
  sb.from('restaurant_menu_items').select('id, name, category, sku, menu_type, price, cost_price, is_available, branch_id, ingredients').order('name'),
  sb.from('branches').select('id, name'),
]);

if (itemsErr) { console.error('❌  Catalog fetch error:', itemsErr.message); process.exit(1); }

const branchMap = Object.fromEntries((branches || []).map(b => [b.id, b.name]));

// ─── split catalog into STOCK items vs POS-only misplaced entries ─────────────
const stockItems  = (items || []).filter(i => !POS_ONLY_CATEGORIES.has((i.category || '').trim()));
const posInCatalog = (items || []).filter(i => POS_ONLY_CATEGORIES.has((i.category || '').trim()));

// ─── bar_drinks linkage ───────────────────────────────────────────────────────
const catalogSkuSet = new Set(stockItems.map(i => i.sku));
const linkedBarDrinks   = (barDrinks || []).filter(d => d.linked_inventory_sku && catalogSkuSet.has(d.linked_inventory_sku));
const unlinkedBarDrinks = (barDrinks || []).filter(d => !d.linked_inventory_sku || !catalogSkuSet.has(d.linked_inventory_sku));

// ─── duplicate detection (name) in STOCK items only ──────────────────────────
const byName = {};
for (const item of stockItems) {
  const key = normalName(item.item_name);
  if (!byName[key]) byName[key] = [];
  byName[key].push(item);
}
const nameDupes = Object.entries(byName).filter(([, rows]) => rows.length > 1);

// ─── category case mismatches ─────────────────────────────────────────────────
const catNorm = {};
for (const item of stockItems) {
  const cat = (item.category || '').trim();
  const key = cat.toLowerCase();
  if (!catNorm[key]) catNorm[key] = new Set();
  catNorm[key].add(cat);
}
const catCaseDupes = Object.values(catNorm).filter(s => s.size > 1).map(s => [...s]);

// ─── analytics (stock items only) ────────────────────────────────────────────
const byCategory  = {};
const byStoreType = {};
let totalValue = 0;
for (const item of stockItems) {
  const cat = (item.category || '(no category)').trim();
  const st  = (item.store_type || '(unknown)').trim();
  byCategory[cat]  = (byCategory[cat]  || 0) + 1;
  byStoreType[st]  = (byStoreType[st]  || 0) + 1;
  totalValue += (Number(item.cost_price) || 0) * (Number(item.quantity) || 0);
}

// ─── write report ─────────────────────────────────────────────────────────────

out('# Master Inventory Catalog + POS Outlet Report');
out('');
out('> Generated: ', new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }), ' EAT  ');
out('> Filter: ', includeInactive ? 'Active + Inactive' : 'Active items only');
out('');
out('## Architecture Overview');
out('');
out('```');
out('┌─────────────────────────────────────────────────────────────────┐');
out('│  CENTRAL MASTER CATALOG  (simple_items)                         │');
out('│  Real stock — DRY GOODS, BEERS, WINES, WHISKY, SPIRITS, etc.   │');
out('│  Quantity is tracked; cost price matters for F&B costing        │');
out('└────────────────────┬────────────────────────────────────────────┘');
out('                     │ linked_inventory_sku / inventory_item_id');
out('          ┌──────────┴──────────┐');
out('          ▼                     ▼');
out('  ┌───────────────┐   ┌──────────────────────┐');
out('  │  bar_drinks   │   │ restaurant_menu_items │');
out('  │  (399 items)  │   │   (482 items)         │');
out('  │  BAR POS      │   │   KITCHEN POS         │');
out('  │  Bottle/can   │   │   Composed dishes     │');
out('  │  sold at bar  │   │   made from ingredients│');
out('  └───────────────┘   └──────────────────────┘');
out('        ▲                       ▲');
out('        │                       │');
out('   Stock depletes          No direct stock link');
out('   from simple_items       (uses ingredients field)');
out('```');
out('');
out('**Key rule:** `bar_drinks` are physical bottles — each sale depletes a matching');
out('`simple_items` stock entry. `restaurant_menu_items` are composed dishes; the kitchen');
out('uses raw ingredients from DRY GOODS / central catalog, not a 1:1 stock item.');
out('');

// ── summary ──
out('## Summary');
out('');
out('| Metric | Value |');
out('|--------|-------|');
out(`| **Central stock items** (simple_items, real inventory) | **${stockItems.length}** |`);
out(`| POS-only items misplaced in simple_items | ${posInCatalog.length} |`);
out(`| Bar POS items (bar_drinks) | ${(barDrinks||[]).length} |`);
out(`| &nbsp;&nbsp;└ linked to central stock | ${linkedBarDrinks.length} |`);
out(`| &nbsp;&nbsp;└ NOT linked to any stock SKU | **${unlinkedBarDrinks.length}** |`);
out(`| Kitchen POS items (restaurant_menu_items) | ${(menuItems||[]).length} |`);
out(`| &nbsp;&nbsp;└ These are composed dishes — NOT stock items | — |`);
out(`| Stock value (cost × qty) | **KES ${fmt(totalValue)}** |`);
out(`| Name duplicates in stock catalog | **${nameDupes.length}** groups |`);
out(`| Category name case mismatches | **${catCaseDupes.length}** groups |`);
out('');

// ── POS outlet explained ──
out('## POS Outlets — What They Are');
out('');
out('### 1. Kitchen POS → `restaurant_menu_items` (482 items)');
out('');
out('These are **dishes the kitchen sells** at the POS terminal. They are NOT inventory stock.');
out('Each item may have an `ingredients` array listing raw ingredients from DRY GOODS.');
out('Examples: Chips, Chapati, Chicken Wet Fry, Pilau, Ugali, etc.');
out('');
out('**These should NOT appear in `simple_items`** — the KITCHEN MENU / PASTRY / food / FOOD');
out(`categories in simple_items (${posInCatalog.length} items below) are stale/duplicate entries.`);
out('');
out('### 2. Bar POS → `bar_drinks` (399 items)');
out('');
out('These are **bottles and cans** sold at the bar POS. Each one should be linked to a');
out('`simple_items` stock entry via `linked_inventory_sku`. When a bartender sells a');
out('JW Red 750ml, it decrements the matching stock entry.');
out('');
out(`- **${linkedBarDrinks.length}** bar drinks are correctly linked to central stock`);
out(`- **${unlinkedBarDrinks.length}** bar drinks have NO link to any stock SKU (pricing/stock gap)`);
out('');

// ── bar drinks link status ──
out('## Bar Drinks → Stock Linkage');
out('');
out('### Correctly Linked Bar Drinks');
out('');
out('| Bar Drink Name | Bar SKU | Linked Stock SKU | Stock Item Name | Cost | Retail |');
out('|----------------|---------|-----------------|-----------------|-----:|-------:|');
for (const d of linkedBarDrinks.sort((a, b) => a.name.localeCompare(b.name))) {
  const stockItem = stockItems.find(i => i.sku === d.linked_inventory_sku);
  out(`| ${d.name} | \`${d.sku || ''}\` | \`${d.linked_inventory_sku}\` | ${stockItem?.item_name || '—'} | ${fmt(d.cost_price)} | ${fmt(d.price)} |`);
}
out('');

out('### Bar Drinks With NO Stock Link ⚠️');
out('');
out('These bar POS items are sold but not linked to any master catalog stock entry.');
out('Stock cannot be automatically decremented when sold.');
out('');
out('| Bar Drink Name | Category | SKU | Price | Branch |');
out('|----------------|----------|-----|------:|--------|');
for (const d of unlinkedBarDrinks.sort((a, b) => (a.category||'').localeCompare(b.category||'') || a.name.localeCompare(b.name))) {
  const branch = d.branch_id ? (branchMap[d.branch_id] || `Branch #${d.branch_id}`) : 'global';
  out(`| ${d.name} | ${d.category || ''} | \`${d.sku || ''}\` | ${fmt(d.price)} | ${branch} |`);
}
out('');

// ── kitchen menu items ──
out('## Kitchen POS Items (restaurant_menu_items)');
out('');
out('These 482 items are sold at the kitchen/restaurant POS. They are **composed dishes**, not raw stock.');
out('The system\'s Food Control Standards / Recipes define what raw ingredients each dish consumes.');
out('');
const menuByCategory = {};
for (const m of (menuItems || [])) {
  const cat = (m.category || m.menu_type || '(uncategorised)').trim();
  if (!menuByCategory[cat]) menuByCategory[cat] = [];
  menuByCategory[cat].push(m);
}
out('| Category | Count |');
out('|----------|------:|');
for (const [cat, rows] of Object.entries(menuByCategory).sort((a, b) => b[1].length - a[1].length)) {
  out(`| ${cat} | ${rows.length} |`);
}
out('');
out('### Full Kitchen POS Listing');
out('');
out('| SKU | Name | Category | Price (KES) | Cost (KES) | Available | Branch |');
out('|-----|------|----------|------------:|-----------:|-----------|--------|');
for (const m of (menuItems || []).sort((a, b) => (a.category||'').localeCompare(b.category||'') || a.name.localeCompare(b.name))) {
  const cat    = (m.category || m.menu_type || '').trim();
  const branch = m.branch_id ? (branchMap[m.branch_id] || `Branch #${m.branch_id}`) : 'global';
  const avail  = m.is_available ? '✓' : '✗';
  out(`| \`${m.sku || m.id.slice(0, 8)}\` | ${m.name} | ${cat} | ${fmt(m.price)} | ${fmt(m.cost_price)} | ${avail} | ${branch} |`);
}
out('');

// ── misplaced POS items in simple_items ──
out('## ⚠️ Misplaced POS Items Inside simple_items');
out('');
out(`**${posInCatalog.length} items** in \`simple_items\` belong to POS-only categories`);
out('(KITCHEN MENU, PASTRY, food, FOOD, beverage, soft drinks).');
out('These are managed via `restaurant_menu_items` and should be **removed from the stock catalog**.');
out('');
out('| SKU | Item Name | Category | Branch |');
out('|-----|-----------|----------|--------|');
for (const item of posInCatalog.sort((a, b) => (a.category||'').localeCompare(b.category||'') || a.item_name.localeCompare(b.item_name))) {
  const branch = item.branch_id ? (branchMap[item.branch_id] || `Branch #${item.branch_id}`) : 'global';
  out(`| \`${item.sku}\` | ${item.item_name} | ${item.category} | ${branch} |`);
}
out('');

// ── stock catalog sections ──
out('## Central Stock Catalog (simple_items — Real Inventory Only)');
out('');

// Summary table
out('### By Category');
out('');
out('| Category | Count |');
out('|----------|------:|');
for (const [cat, cnt] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
  out(`| ${cat} | ${cnt} |`);
}
out('');

out('### By Store Type');
out('');
out('| Store Type | Count |');
out('|------------|------:|');
for (const [st, cnt] of Object.entries(byStoreType).sort((a, b) => b[1] - a[1])) {
  out(`| ${st} | ${cnt} |`);
}
out('');

// Duplicates
out('### Name Duplicates in Stock Catalog');
out('');
if (nameDupes.length === 0) {
  out('_No exact name duplicates found._');
} else {
  out(`**${nameDupes.length}** item names appear under 2+ SKUs:`);
  out('');
  for (const [, rows] of nameDupes.sort((a, b) => a[0].localeCompare(b[0]))) {
    out(`#### "${rows[0].item_name}"`);
    out('');
    out('| SKU | Category | Unit | Cost | Retail | Qty | Store Type | Branch |');
    out('|-----|----------|------|-----:|-------:|----:|------------|--------|');
    for (const r of rows) {
      const branch = r.branch_id ? (branchMap[r.branch_id] || `Branch #${r.branch_id}`) : 'global';
      out(`| \`${r.sku}\` | ${r.category||''} | ${r.unit_of_measure||r.unit||''} | ${fmt(r.cost_price)} | ${fmt(r.retail_price)} | ${fmt(r.quantity)} | ${r.store_type||''} | ${branch} |`);
    }
    out('');
  }
}

if (catCaseDupes.length > 0) {
  out('### Category Name Case Mismatches');
  out('');
  out('| Variants | Total Items |');
  out('|----------|------------:|');
  for (const variants of catCaseDupes) {
    const total = variants.reduce((s, v) => s + (byCategory[v] || 0), 0);
    out(`| ${variants.map(v => `\`${v}\``).join(' / ')} | ${total} |`);
  }
  out('');
}

// Full stock listing
out('### Full Stock Item Listing');
out('');
out('> Real inventory only — POS-only categories excluded');
out('');
let lastCat = null;
for (const item of stockItems) {
  const cat  = (item.category || '(no category)').trim();
  const unit = item.unit_of_measure || item.unit || '';
  const branch = item.branch_id ? ` *(${branchMap[item.branch_id] || 'branch ' + item.branch_id})*` : '';
  const inactive = item.is_active === false ? ' ~~INACTIVE~~' : '';

  if (cat !== lastCat) {
    if (lastCat !== null) out('');
    out(`#### ${cat}`);
    out('');
    out('| SKU | Item Name | Unit | Cost (KES) | Retail (KES) | Qty | Store Type |');
    out('|-----|-----------|------|----------:|-------------:|----:|------------|');
    lastCat = cat;
  }
  out(`| \`${item.sku}\` | ${item.item_name}${branch}${inactive} | ${unit} | ${fmt(item.cost_price)} | ${fmt(item.retail_price)} | ${fmt(item.quantity)} | ${item.store_type||''} |`);
}

out('');
out('---');
out(`*Generated by \`analyse_catalog.mjs\` — ${stockItems.length} stock items | ${(barDrinks||[]).length} bar POS | ${(menuItems||[]).length} kitchen POS*`);

// ─── write ────────────────────────────────────────────────────────────────────
writeFileSync(OUT_FILE, lines.join('\n'), 'utf8');
console.log(`✅  Report written → ${OUT_FILE}`);
console.log(`    Stock: ${stockItems.length} | Bar POS: ${(barDrinks||[]).length} (${linkedBarDrinks.length} linked / ${unlinkedBarDrinks.length} unlinked) | Kitchen POS: ${(menuItems||[]).length} | Misplaced in catalog: ${posInCatalog.length}`);
