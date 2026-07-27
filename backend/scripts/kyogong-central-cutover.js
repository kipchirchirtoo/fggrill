const fs = require('fs');
const path = require('path');
const { createClient } = require('../node_modules/@supabase/supabase-js');

const repoRoot = path.resolve(__dirname, '..', '..');
const envPath = path.join(repoRoot, 'backend', '.env');
const env = fs.readFileSync(envPath, 'utf8');
const getEnv = (key) => {
  const match = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : '';
};

const supabase = createClient(
  getEnv('SUPABASE_PROJECT_URL'),
  getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false } },
);

const KYOGONG_BRANCH_ID = 1;
const STRAY_CENTRAL_BRANCH_ID = 3;
const KEEP_BRANCH_STORE_CODE = 'BRANCH-STORE-1';
const PREFERRED_CENTRAL_CODE = 'CENTRAL-STORE-1';

function bucketKey(row) {
  return `${row.item_id}::${row.batch_id || ''}`;
}

function sumNumber(value) {
  return Number(value || 0);
}

async function fetchLocationRows(branchId, locationType) {
  const { data, error } = await supabase
    .from('inventory_locations')
    .select('*')
    .eq('branch_id', branchId)
    .eq('location_type', locationType)
    .eq('is_active', true)
    .order('location_code', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function fetchBalances(locationId) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    const { data, error } = await supabase
      .from('inventory_balances')
      .select('*')
      .eq('location_id', locationId)
      .range(from, from + pageSize - 1);

    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function aggregateRows(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const key = bucketKey(row);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        key,
        keeper: row,
        rows: [row],
        item_id: row.item_id,
        batch_id: row.batch_id || null,
        current_quantity: sumNumber(row.current_quantity),
        reserved_quantity: sumNumber(row.reserved_quantity),
        damaged_quantity: sumNumber(row.damaged_quantity),
        expired_quantity: sumNumber(row.expired_quantity),
        available_quantity: sumNumber(row.available_quantity),
        unit_cost: sumNumber(row.unit_cost),
      });
      continue;
    }

    existing.rows.push(row);
    existing.current_quantity += sumNumber(row.current_quantity);
    existing.reserved_quantity += sumNumber(row.reserved_quantity);
    existing.damaged_quantity += sumNumber(row.damaged_quantity);
    existing.expired_quantity += sumNumber(row.expired_quantity);
    existing.available_quantity += sumNumber(row.available_quantity);
    if (!existing.unit_cost && sumNumber(row.unit_cost)) {
      existing.unit_cost = sumNumber(row.unit_cost);
    }
  }

  return grouped;
}

async function updateBalance(id, payload) {
  const { error } = await supabase
    .from('inventory_balances')
    .update(payload)
    .eq('id', id);

  if (error) throw error;
}

async function deleteBalances(ids) {
  if (!ids.length) return;
  const { error } = await supabase
    .from('inventory_balances')
    .delete()
    .in('id', ids);

  if (error) throw error;
}

async function insertBalance(payload) {
  const { data, error } = await supabase
    .from('inventory_balances')
    .insert(payload)
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

async function updateLocation(id, payload) {
  const { error } = await supabase
    .from('inventory_locations')
    .update(payload)
    .eq('id', id);

  if (error) throw error;
}

async function main() {
  const branchStoreRows = await fetchLocationRows(KYOGONG_BRANCH_ID, 'branch_store');
  const centralRows = await fetchLocationRows(KYOGONG_BRANCH_ID, 'central_store');
  const strayCentralRows = await fetchLocationRows(STRAY_CENTRAL_BRANCH_ID, 'central_store');

  const branchStore = branchStoreRows.find((row) => row.location_code === KEEP_BRANCH_STORE_CODE);
  const canonicalCentral = centralRows.find((row) => row.location_code === PREFERRED_CENTRAL_CODE)
    || centralRows.find((row) => String(row.name || '').trim().toLowerCase() === 'central store')
    || centralRows[0];

  if (!branchStore) throw new Error('Kyogong branch store location BRANCH-STORE-1 not found');
  if (!canonicalCentral) throw new Error('Canonical central location not found for Kyogong');

  const duplicateCentrals = centralRows.filter((row) => row.id !== canonicalCentral.id);
  const sourceLocations = [branchStore, ...duplicateCentrals];

  const targetBuckets = aggregateRows(await fetchBalances(canonicalCentral.id));
  const sourceBucketsByLocation = new Map();

  for (const location of sourceLocations) {
    sourceBucketsByLocation.set(location.id, aggregateRows(await fetchBalances(location.id)));
  }

  let mergedBucketCount = 0;
  let movedBucketCount = 0;
  let deletedSourceRowCount = 0;
  let dedupedTargetRowCount = 0;
  const deactivatedStrayLocationIds = [];

  for (const bucket of targetBuckets.values()) {
    const extraRows = bucket.rows.slice(1);
    if (extraRows.length > 0) {
      await updateBalance(bucket.keeper.id, {
        current_quantity: bucket.current_quantity,
        reserved_quantity: bucket.reserved_quantity,
        damaged_quantity: bucket.damaged_quantity,
        expired_quantity: bucket.expired_quantity,
        unit_cost: bucket.unit_cost,
        updated_at: new Date().toISOString(),
      });
      await deleteBalances(extraRows.map((row) => row.id));
      dedupedTargetRowCount += extraRows.length;
      bucket.rows = [bucket.keeper];
    }
  }

  for (const [locationId, sourceBuckets] of sourceBucketsByLocation.entries()) {
    for (const sourceBucket of sourceBuckets.values()) {
      const targetBucket = targetBuckets.get(sourceBucket.key);

      if (targetBucket) {
        targetBucket.current_quantity += sumNumber(sourceBucket.current_quantity);
        targetBucket.reserved_quantity += sumNumber(sourceBucket.reserved_quantity);
        targetBucket.damaged_quantity += sumNumber(sourceBucket.damaged_quantity);
        targetBucket.expired_quantity += sumNumber(sourceBucket.expired_quantity);
        if (!sumNumber(targetBucket.unit_cost) && sumNumber(sourceBucket.unit_cost)) {
          targetBucket.unit_cost = sumNumber(sourceBucket.unit_cost);
        }
        await updateBalance(targetBucket.keeper.id, {
          current_quantity: targetBucket.current_quantity,
          reserved_quantity: targetBucket.reserved_quantity,
          damaged_quantity: targetBucket.damaged_quantity,
          expired_quantity: targetBucket.expired_quantity,
          unit_cost: targetBucket.unit_cost,
          updated_at: new Date().toISOString(),
        });
        mergedBucketCount += 1;
      } else {
        const inserted = await insertBalance({
          item_id: sourceBucket.item_id,
          location_id: canonicalCentral.id,
          batch_id: sourceBucket.batch_id,
          current_quantity: sourceBucket.current_quantity,
          reserved_quantity: sourceBucket.reserved_quantity,
          damaged_quantity: sourceBucket.damaged_quantity,
          expired_quantity: sourceBucket.expired_quantity,
          unit_cost: sourceBucket.unit_cost,
        });
        targetBuckets.set(sourceBucket.key, {
          ...sourceBucket,
          keeper: { id: inserted.id },
          rows: [{ id: inserted.id }],
        });
        movedBucketCount += 1;
      }

      const sourceIds = sourceBucket.rows.map((row) => row.id);
      await deleteBalances(sourceIds);
      deletedSourceRowCount += sourceIds.length;
    }
  }

  for (const duplicateCentral of duplicateCentrals) {
    const nextMetadata = {
      ...(duplicateCentral.metadata || {}),
      merged_into_location_id: canonicalCentral.id,
      merged_at: new Date().toISOString(),
      legacy_duplicate: true,
    };
    await updateLocation(duplicateCentral.id, {
      is_active: false,
      metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    });
  }

  for (const stray of strayCentralRows) {
    const strayBalances = await fetchBalances(stray.id);
    if (strayBalances.length === 0) {
      const nextMetadata = {
        ...(stray.metadata || {}),
        legacy_duplicate: true,
        deactivated_at: new Date().toISOString(),
      };
      await updateLocation(stray.id, {
        is_active: false,
        metadata: nextMetadata,
        updated_at: new Date().toISOString(),
      });
      deactivatedStrayLocationIds.push(stray.id);
    }
  }

  const branchStoreAfter = await fetchBalances(branchStore.id);
  const canonicalAfter = await fetchBalances(canonicalCentral.id);
  const branchTotal = branchStoreAfter.reduce((sum, row) => sum + sumNumber(row.current_quantity), 0);
  const centralTotal = canonicalAfter.reduce((sum, row) => sum + sumNumber(row.current_quantity), 0);

  console.log(JSON.stringify({
    canonical_central_location_id: canonicalCentral.id,
    branch_store_location_id: branchStore.id,
    merged_bucket_count: mergedBucketCount,
    moved_bucket_count: movedBucketCount,
    deleted_source_row_count: deletedSourceRowCount,
    deduped_target_row_count: dedupedTargetRowCount,
    branch_store_rows_after: branchStoreAfter.length,
    branch_store_total_qty_after: branchTotal,
    canonical_central_rows_after: canonicalAfter.length,
    canonical_central_total_qty_after: centralTotal,
    deactivated_duplicate_central_locations: duplicateCentrals.map((row) => row.id),
    deactivated_empty_stray_locations: deactivatedStrayLocationIds,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
