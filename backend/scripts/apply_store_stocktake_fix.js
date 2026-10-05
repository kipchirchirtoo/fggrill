const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../src/controllers/storekeeping/store-stocktake.controller.ts');
let content = fs.readFileSync(targetPath, 'utf-8');

// 1. Update isStoreCountableItem
const oldFunc = `const isStoreCountableItem = (i: any): boolean => {
    if (!i) return false;
    const storeType = String(i.store_type || '').toLowerCase();
    if (NON_STORE_TYPES.includes(storeType)) return false;
    const category = String(i.category || '').trim().toLowerCase();
    if (category === 'kitchen menu') return false;
    return true;
};`;

const newFunc = `const isStoreCountableItem = (i: any, branchId?: number): boolean => {
    if (!i) return false;
    const category = String(i.category || '').trim().toLowerCase();
    if (category === 'kitchen menu') return false;

    // For Kaplong branch (branch_id = 3), branch store stocktake includes bar stock / bar items
    if (branchId === 3) {
        return true;
    }

    const storeType = String(i.store_type || '').toLowerCase();
    if (NON_STORE_TYPES.includes(storeType)) return false;
    return true;
};`;

// Replace normalizing CRLF
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedOld = oldFunc.replace(/\r\n/g, '\n');

if (!normalizedContent.includes(normalizedOld)) {
  console.error('Could not find oldFunc in file!');
  process.exit(1);
}

let updated = normalizedContent.replace(normalizedOld, newFunc);

// 2. Update isStoreCountableItem calls inside getRecords:
// existingRecords: .filter((r: any) => isStoreCountableItem(r.item)) -> .filter((r: any) => isStoreCountableItem(r.item, branchId))
updated = updated.replace(
  '.filter((r: any) => isStoreCountableItem(r.item))',
  '.filter((r: any) => isStoreCountableItem(r.item, branchId))'
);

// invItems: (invItems || []).filter(isStoreCountableItem) -> (invItems || []).filter((it: any) => isStoreCountableItem(it, branchId))
updated = updated.replace(
  '(invItems || []).filter(isStoreCountableItem)',
  '(invItems || []).filter((it: any) => isStoreCountableItem(it, branchId))'
);

// simpleItems: (simpleItems || []).filter(isStoreCountableItem) -> (simpleItems || []).filter((it: any) => isStoreCountableItem(it, branchId))
updated = updated.replace(
  '(simpleItems || []).filter(isStoreCountableItem)',
  '(simpleItems || []).filter((it: any) => isStoreCountableItem(it, branchId))'
);

// 3. Update recordStoreStocktake item_id resolution to support both UUID and SKU mapping
const oldResolution = `        const itemIds = items.map((it: any) => String(it.item_id));
        const { data: invRows } = await supabase.from('inventory_items').select('id, sku').in('id', itemIds);
        const skuById = new Map((invRows || []).map((i: any) => [i.id, i.sku]));`;

const newResolution = `        const rawIds = items.map((it: any) => String(it.item_id));
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validUuids = rawIds.filter((id: string) => uuidRegex.test(id));
        const nonUuids = rawIds.filter((id: string) => !uuidRegex.test(id));

        let invRows: any[] = [];
        if (validUuids.length > 0) {
            const { data } = await supabase.from('inventory_items').select('id, sku').in('id', validUuids);
            if (data) invRows.push(...data);
        }
        if (nonUuids.length > 0) {
            const { data } = await supabase.from('inventory_items').select('id, sku').in('sku', nonUuids);
            if (data) invRows.push(...data);
        }

        const skuById = new Map<string, string>();
        const idBySku = new Map<string, string>();
        for (const i of invRows) {
            skuById.set(i.id, i.sku);
            idBySku.set(i.sku, i.id);
        }`;

if (updated.includes(oldResolution)) {
  updated = updated.replace(oldResolution, newResolution);
  
  // also adjust rows mapping
  const oldRowMap = `        const rows = items.map((it: any) => {
            const itemId = String(it.item_id);
            const sku = skuById.get(itemId);
            if (!sku) { logger.warn(\`recordStoreStocktake: no inventory_items mapping for \${itemId}\`); return null; }`;

  const newRowMap = `        const rows = items.map((it: any) => {
            const rawId = String(it.item_id);
            const resolvedId = skuById.has(rawId) ? rawId : idBySku.get(rawId);
            const sku = skuById.get(resolvedId || rawId) || idBySku.get(rawId) || rawId;
            if (!resolvedId) { logger.warn(\`recordStoreStocktake: no inventory_items mapping for \${rawId}\`); return null; }
            const itemId = resolvedId;`;

  updated = updated.replace(oldRowMap, newRowMap);
}

// Preserve original CRLF if was present
if (content.includes('\r\n')) {
  updated = updated.replace(/\n/g, '\r\n');
}

fs.writeFileSync(targetPath, updated, 'utf-8');
console.log('Successfully updated store-stocktake.controller.ts');
