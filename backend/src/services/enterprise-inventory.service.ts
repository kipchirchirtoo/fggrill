import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import * as BranchInventoryService from './branch-inventory.service';

type JsonRecord = Record<string, any>;
type StockMovementResult = { previousStock: number; newStock: number };
type DepartmentIssueResult = {
  ledger: JsonRecord;
  stock: StockMovementResult;
  accountingJournal?: JsonRecord | null;
};
type PosConsumptionRow = {
  itemSku: string;
  quantity: number;
  outletItemIds: string[];
  names: string[];
};
type PosInventoryPostResult = {
  row: PosConsumptionRow;
  movement: StockMovementResult;
  ledger: JsonRecord;
};

const STANDARD_DEPARTMENTS = [
  { department_code: 'main_kitchen', department_name: 'Main Kitchen', department_type: 'kitchen', accounting_treatment: 'inventory' },
  { department_code: 'choma_zone_kitchen', department_name: 'Choma Zone Kitchen', department_type: 'kitchen', accounting_treatment: 'inventory' },
  { department_code: 'pastries_kitchen', department_name: 'Pastries Kitchen', department_type: 'kitchen', accounting_treatment: 'inventory' },
  { department_code: 'buffet', department_name: 'Buffets', department_type: 'event', accounting_treatment: 'inventory' },
  { department_code: 'outside_catering', department_name: 'Outside Catering', department_type: 'event', accounting_treatment: 'inventory' },
  { department_code: 'accommodation_breakfast', department_name: 'Accommodation Breakfast', department_type: 'event', accounting_treatment: 'inventory' },
  { department_code: 'main_bar', department_name: 'Main Bar', department_type: 'bar', accounting_treatment: 'inventory' },
  { department_code: 'executive_bar', department_name: 'Executive Bar', department_type: 'bar', accounting_treatment: 'inventory' },
  { department_code: 'housekeeping', department_name: 'Housekeeping & Maintenance', department_type: 'housekeeping', accounting_treatment: 'expense' },
  { department_code: 'spa_sauna', department_name: 'Spa & Sauna', department_type: 'spa', accounting_treatment: 'inventory' },
  { department_code: 'back_office', department_name: 'Back Office', department_type: 'back_office', accounting_treatment: 'expense' }
];

const BRANCH_STORE_INVENTORY_ACCOUNT = {
  account_code: '1360',
  account_name: 'Branch Store Inventory',
  account_type: 'asset'
};

const DEPARTMENT_INVENTORY_ACCOUNT = {
  account_code: '1370',
  account_name: 'Department Inventory',
  account_type: 'asset'
};

const DEPARTMENT_EXPENSE_ACCOUNT = {
  account_code: '6100',
  account_name: 'Department Consumption Expense',
  account_type: 'expense'
};

const numberValue = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const textValue = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  return text ? text : null;
};

const itemQuantity = (item: JsonRecord): number =>
  numberValue(item.qty ?? item.quantity ?? item.quantity_sold ?? item.count);

const outletItemIdFor = (item: JsonRecord): string | null =>
  textValue(item.outlet_item_id ?? item.product_id ?? item.id);

const isMissingPosInventoryMappingTable = (error: any): boolean => {
  const message = String(error?.message || '');
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    error?.code === 'PGRST200' ||
    message.includes("Could not find the table 'public.pos_inventory_mappings'") ||
    message.includes('relation "public.pos_inventory_mappings" does not exist') ||
    message.includes('pos_inventory_mappings')
  );
};

const normalizeDepartmentCode = (code: unknown): string => {
  const normalized = String(code || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) throw new AppError('Department account is required', 400);
  return normalized;
};

const accountCodeForOutletType = (outletType: unknown): string => {
  const type = String(outletType || '').toLowerCase();
  if (type.includes('executive_bar')) return 'executive_bar';
  if (type.includes('bar')) return 'main_bar';
  if (type.includes('spa')) return 'spa_sauna';
  if (type.includes('restaurant') || type.includes('coffee') || type.includes('bakery')) return 'main_kitchen';
  return 'back_office';
};

export async function logInventoryAudit(input: {
  branchId?: number | null;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  beforeValue?: JsonRecord | null;
  afterValue?: JsonRecord | null;
  deviceInfo?: JsonRecord | null;
  metadata?: JsonRecord | null;
}): Promise<void> {
  const { error } = await supabase.from('inventory_audit_log').insert({
    branch_id: input.branchId ?? null,
    actor_id: input.actorId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    reference_type: input.referenceType ?? null,
    reference_id: input.referenceId ?? null,
    before_value: input.beforeValue ?? null,
    after_value: input.afterValue ?? null,
    device_info: input.deviceInfo ?? {},
    metadata: input.metadata ?? {}
  });

  if (error) {
    logger.warn(`Inventory audit log write failed: ${error.message}`);
  }
}

async function getOrCreateAccountingAccount(account: {
  account_code: string;
  account_name: string;
  account_type: string;
}): Promise<string | null> {
  try {
    const { data: existing, error: lookupError } = await supabase
      .from('accounting_chart_of_accounts')
      .select('id')
      .eq('account_code', account.account_code)
      .maybeSingle();

    if (lookupError) return null;
    if (existing?.id) return String(existing.id);

    const { data: created, error: createError } = await supabase
      .from('accounting_chart_of_accounts')
      .insert(account)
      .select('id')
      .single();

    if (!createError && created?.id) return String(created.id);

    const { data: createdWithoutType, error: fallbackError } = await supabase
      .from('accounting_chart_of_accounts')
      .insert({
        account_code: account.account_code,
        account_name: account.account_name
      })
      .select('id')
      .single();

    if (fallbackError || !createdWithoutType?.id) return null;
    return String(createdWithoutType.id);
  } catch (error) {
    logger.warn(`Accounting account ${account.account_code} unavailable`, error);
    return null;
  }
}

async function postDepartmentIssueJournal(input: {
  branchId: number;
  actorId: string;
  account: JsonRecord;
  ledger: JsonRecord;
  itemSku: string;
  itemName?: string | null;
  quantity: number;
  unitCost: number;
  sourceNumber?: string | null;
}): Promise<JsonRecord | null> {
  const amount = Math.round(input.quantity * input.unitCost * 100) / 100;
  if (amount <= 0) return null;

  const branchInventoryAccountId = await getOrCreateAccountingAccount(BRANCH_STORE_INVENTORY_ACCOUNT);
  const debitAccount =
    input.account.accounting_treatment === 'inventory'
      ? {
          ...DEPARTMENT_INVENTORY_ACCOUNT,
          account_code: input.account.inventory_account_code || DEPARTMENT_INVENTORY_ACCOUNT.account_code
        }
      : {
          ...DEPARTMENT_EXPENSE_ACCOUNT,
          account_code: input.account.expense_account_code || DEPARTMENT_EXPENSE_ACCOUNT.account_code
        };
  const debitAccountId = await getOrCreateAccountingAccount(debitAccount);

  if (!branchInventoryAccountId || !debitAccountId) {
    logger.warn('Skipping department issue journal because accounting accounts are unavailable', {
      branchInventoryAccountId,
      debitAccountId,
      department_code: input.account.department_code
    });
    return null;
  }

  const journalNumber = `JE-DI-${Date.now()}`;
  const description =
    `Department stock issue: ${input.itemName || input.itemSku} to ${input.account.department_name}`;

  const { data: journal, error: journalError } = await supabase
    .from('accounting_journal_entries')
    .insert({
      journal_number: journalNumber,
      entry_date: new Date().toISOString().split('T')[0],
      description,
      reference: input.sourceNumber || input.ledger.id,
      total_debit: amount,
      total_credit: amount,
      status: 'posted',
      posted_by: input.actorId,
      posted_at: new Date().toISOString(),
      branch_id: input.branchId
    })
    .select()
    .single();

  if (journalError) {
    logger.warn(`Department issue journal write failed: ${journalError.message}`);
    return null;
  }

  const lines = [
    {
      journal_entry_id: journal.id,
      account_id: debitAccountId,
      description:
        input.account.accounting_treatment === 'inventory'
          ? `Debit ${input.account.department_name} inventory at cost`
          : `Debit ${input.account.department_name} consumption expense at cost`,
      debit_amount: amount,
      credit_amount: 0,
      department: input.account.department_code,
      cost_center: input.account.department_code
    },
    {
      journal_entry_id: journal.id,
      account_id: branchInventoryAccountId,
      description: 'Credit branch store inventory at cost',
      debit_amount: 0,
      credit_amount: amount,
      department: input.account.department_code,
      cost_center: 'branch_store'
    }
  ];

  const { error: lineError } = await supabase
    .from('accounting_journal_lines')
    .insert(lines);

  if (lineError) {
    logger.warn(`Department issue journal lines write failed: ${lineError.message}`);
    return journal as JsonRecord;
  }

  return {
    ...(journal as JsonRecord),
    lines,
    debit_account_code: debitAccount.account_code,
    credit_account_code: BRANCH_STORE_INVENTORY_ACCOUNT.account_code,
    accounting_treatment: input.account.accounting_treatment
  };
}

export async function seedDepartmentAccounts(branchId: number): Promise<void> {
  const rows = STANDARD_DEPARTMENTS.map((department) => ({
    branch_id: branchId,
    ...department,
    inventory_account_code: DEPARTMENT_INVENTORY_ACCOUNT.account_code,
    expense_account_code: DEPARTMENT_EXPENSE_ACCOUNT.account_code
  }));

  const { error } = await supabase
    .from('department_inventory_accounts')
    .upsert(rows, { onConflict: 'branch_id,department_code' });

  if (error) throw error;
}

export async function listDepartmentAccounts(branchId: number): Promise<JsonRecord[]> {
  await seedDepartmentAccounts(branchId);

  const { data, error } = await supabase
    .from('department_inventory_accounts')
    .select('*')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('department_type')
    .order('department_name');

  if (error) throw error;
  return data || [];
}

export async function getDepartmentAccount(branchId: number, departmentCode: string): Promise<JsonRecord> {
  const normalized = normalizeDepartmentCode(departmentCode);
  await seedDepartmentAccounts(branchId);

  const { data, error } = await supabase
    .from('department_inventory_accounts')
    .select('*')
    .eq('branch_id', branchId)
    .eq('department_code', normalized)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new AppError(`Department account not found: ${normalized}`, 404);
  return data as JsonRecord;
}

export async function recordDepartmentIssue(input: {
  branchId: number;
  itemSku: string;
  quantity: number;
  departmentCode: string;
  actorId: string;
  shiftCode?: string | null;
  destinationType?: string | null;
  eventName?: string | null;
  eventDate?: string | null;
  location?: string | null;
  paxCount?: number | null;
  sourceType?: string | null;
  sourceId?: string | null;
  sourceNumber?: string | null;
  notes?: string | null;
  metadata?: JsonRecord | null;
}): Promise<DepartmentIssueResult> {
  if (!input.itemSku) throw new AppError('Item SKU is required', 400);
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new AppError('Issue quantity must be greater than zero', 400);
  }

  const account = await getDepartmentAccount(input.branchId, input.departmentCode);

  const [{ data: stock, error: stockError }, { data: item, error: itemError }] = await Promise.all([
    supabase
      .from('branch_stock')
      .select('quantity')
      .eq('branch_id', input.branchId)
      .eq('item_sku', input.itemSku)
      .maybeSingle(),
    supabase
      .from('simple_items')
      .select('sku, item_name, cost_price')
      .eq('sku', input.itemSku)
      .maybeSingle()
  ]);

  if (stockError) throw stockError;
  if (itemError) throw itemError;
  const previousStock = numberValue(stock?.quantity);
  if (previousStock < input.quantity) {
    throw new AppError(`Insufficient branch stock for ${item?.item_name || input.itemSku}`, 409);
  }

  const unitCost = numberValue(item?.cost_price);

  const movement = await BranchInventoryService.updateBranchStock(
    input.branchId,
    input.itemSku,
    -input.quantity,
    'DEPARTMENT_ISSUE',
    input.actorId,
    input.sourceType || 'department_issue',
    input.sourceId || undefined,
    input.sourceNumber || undefined,
    input.notes || `Issued to ${account.department_name}`
  );

  const { data: ledger, error: ledgerError } = await supabase
    .from('department_inventory_ledger')
    .insert({
      account_id: account.id,
      branch_id: input.branchId,
      item_sku: input.itemSku,
      movement_type: 'issue',
      quantity: input.quantity,
      unit_cost: unitCost,
      shift_code: input.shiftCode || null,
      destination_type: input.destinationType || account.department_type,
      event_name: input.eventName || null,
      event_date: input.eventDate || null,
      location: input.location || null,
      pax_count: input.paxCount ?? null,
      source_type: input.sourceType || 'department_issue',
      source_id: input.sourceId || null,
      source_number: input.sourceNumber || null,
      metadata: input.metadata || {},
      notes: input.notes || null,
      performed_by: input.actorId
    })
    .select('*')
    .single();

  if (ledgerError) throw ledgerError;

  const accountingJournal = await postDepartmentIssueJournal({
    branchId: input.branchId,
    actorId: input.actorId,
    account,
    ledger,
    itemSku: input.itemSku,
    itemName: item?.item_name,
    quantity: input.quantity,
    unitCost,
    sourceNumber: input.sourceNumber
  });

  const ledgerMetadata = {
    ...(ledger.metadata || {}),
    accounting_journal_id: accountingJournal?.id || null,
    debit_account_code:
      account.accounting_treatment === 'inventory'
        ? account.inventory_account_code || DEPARTMENT_INVENTORY_ACCOUNT.account_code
        : account.expense_account_code || DEPARTMENT_EXPENSE_ACCOUNT.account_code,
    credit_account_code: BRANCH_STORE_INVENTORY_ACCOUNT.account_code,
    stock_before: previousStock,
    stock_after: movement.newStock
  };
  const { error: ledgerMetadataError } = await supabase
    .from('department_inventory_ledger')
    .update({ metadata: ledgerMetadata })
    .eq('id', ledger.id);
  if (ledgerMetadataError) {
    logger.warn(`Department issue ledger metadata update failed: ${ledgerMetadataError.message}`);
  } else {
    ledger.metadata = ledgerMetadata;
  }

  await logInventoryAudit({
    branchId: input.branchId,
    actorId: input.actorId,
    action: 'department_issue',
    entityType: 'department_inventory_ledger',
    entityId: ledger.id,
    referenceType: input.sourceType || 'department_issue',
    referenceId: input.sourceId || ledger.id,
    beforeValue: { item_sku: input.itemSku, quantity: previousStock },
    afterValue: { item_sku: input.itemSku, quantity: movement.newStock },
    metadata: {
      department_code: account.department_code,
      department_name: account.department_name,
      accounting_treatment: account.accounting_treatment || 'expense',
      debit_account_code:
        account.accounting_treatment === 'inventory'
          ? account.inventory_account_code || DEPARTMENT_INVENTORY_ACCOUNT.account_code
          : account.expense_account_code || DEPARTMENT_EXPENSE_ACCOUNT.account_code,
      credit_account_code: BRANCH_STORE_INVENTORY_ACCOUNT.account_code,
      accounting_journal_id: accountingJournal?.id || null,
      quantity: input.quantity,
      unit_cost: unitCost,
      total_cost: input.quantity * unitCost
    }
  });

  return { ledger, stock: movement, accountingJournal };
}

async function loadPosConsumptionRows(
  branchId: number,
  outletId: string,
  items: JsonRecord[]
): Promise<PosConsumptionRow[]> {
  const outletItemIds = Array.from(new Set(items.map(outletItemIdFor).filter(Boolean))) as string[];
  if (!outletItemIds.length) return [];

  const { data: mappings, error: mappingError } = await supabase
    .from('pos_inventory_mappings')
    .select('*')
    .eq('branch_id', branchId)
    .eq('outlet_id', outletId)
    .eq('is_active', true)
    .in('outlet_item_id', outletItemIds);

  if (mappingError) {
    if (isMissingPosInventoryMappingTable(mappingError)) {
      logger.warn(
        'POS inventory mappings table is missing; skipping enterprise branch-stock posting for this POS order.'
      );
      return [];
    }
    throw mappingError;
  }

  const { data: outletItems, error: outletItemsError } = await supabase
    .from('pos_outlet_items')
    .select('id, sku, name, track_stock')
    .eq('outlet_id', outletId)
    .in('id', outletItemIds);

  if (outletItemsError) throw outletItemsError;

  const mappingsByItem = new Map<string, JsonRecord[]>();
  for (const mapping of mappings || []) {
    const key = String(mapping.outlet_item_id);
    mappingsByItem.set(key, [...(mappingsByItem.get(key) || []), mapping]);
  }

  const outletItemById = new Map<string, JsonRecord>();
  for (const outletItem of outletItems || []) outletItemById.set(String(outletItem.id), outletItem);

  const rows: Array<{ itemSku: string; quantity: number; outletItemId: string; outletItemName: string }> = [];
  for (const item of items) {
    const outletItemId = outletItemIdFor(item);
    const soldQty = itemQuantity(item);
    if (!outletItemId || soldQty <= 0) continue;

    const activeMappings = mappingsByItem.get(outletItemId) || [];
    const outletItem = outletItemById.get(outletItemId);

    if (activeMappings.length > 0) {
      for (const mapping of activeMappings) {
        rows.push({
          itemSku: String(mapping.item_sku),
          quantity: soldQty * numberValue(mapping.quantity_per_sale || 1),
          outletItemId,
          outletItemName: String(outletItem?.name || item.name || outletItemId)
        });
      }
      continue;
    }

    if (outletItem?.track_stock !== false && outletItem?.sku) {
      rows.push({
        itemSku: String(outletItem.sku),
        quantity: soldQty,
        outletItemId,
        outletItemName: String(outletItem.name || item.name || outletItemId)
      });
    }
  }

  const grouped = new Map<string, { itemSku: string; quantity: number; outletItemIds: string[]; names: string[] }>();
  for (const row of rows) {
    const current = grouped.get(row.itemSku) || { itemSku: row.itemSku, quantity: 0, outletItemIds: [], names: [] };
    current.quantity += row.quantity;
    current.outletItemIds.push(row.outletItemId);
    current.names.push(row.outletItemName);
    grouped.set(row.itemSku, current);
  }

  return Array.from(grouped.values());
}

export async function assertPosStockAvailable(branchId: number, outletId: string, items: JsonRecord[]): Promise<void> {
  const consumptionRows = await loadPosConsumptionRows(branchId, outletId, items);
  if (!consumptionRows.length) return;

  const skus = consumptionRows.map((row) => row.itemSku);
  const { data: stockRows, error } = await supabase
    .from('branch_stock')
    .select('item_sku, quantity')
    .eq('branch_id', branchId)
    .in('item_sku', skus);

  if (error) throw error;

  const quantityBySku = new Map<string, number>();
  for (const stock of stockRows || []) quantityBySku.set(String(stock.item_sku), numberValue(stock.quantity));

  const shortfalls = consumptionRows.filter((row) => numberValue(quantityBySku.get(row.itemSku)) < row.quantity);
  if (shortfalls.length > 0) {
    throw new AppError(
      `Out of stock: ${shortfalls.map((row) => `${row.itemSku} needs ${row.quantity}`).join(', ')}`,
      409
    );
  }
}

export async function postPosInventorySale(input: {
  branchId: number;
  outletId: string;
  shiftId: string;
  orderId: string;
  items: JsonRecord[];
  actorId: string;
  reverse?: boolean;
}): Promise<PosInventoryPostResult[]> {
  const consumptionRows = await loadPosConsumptionRows(input.branchId, input.outletId, input.items);
  if (!consumptionRows.length) return [];

  const { data: outlet } = await supabase
    .from('pos_outlets')
    .select('outlet_type, name')
    .eq('id', input.outletId)
    .maybeSingle();

  const accountCode = accountCodeForOutletType(outlet?.outlet_type);
  const account = await getDepartmentAccount(input.branchId, accountCode);
  const movementType = input.reverse ? 'POS_SALE_REVERSAL' : 'POS_SALE';
  const quantitySign = input.reverse ? 1 : -1;
  const results: PosInventoryPostResult[] = [];

  for (const row of consumptionRows) {
    if (!input.reverse) {
      const { data: stock, error: stockError } = await supabase
        .from('branch_stock')
        .select('quantity')
        .eq('branch_id', input.branchId)
        .eq('item_sku', row.itemSku)
        .maybeSingle();
      if (stockError) throw stockError;
      if (numberValue(stock?.quantity) < row.quantity) {
        throw new AppError(`Out of stock: ${row.itemSku} needs ${row.quantity}`, 409);
      }
    }

    const [{ data: item, error: itemError }, movement] = await Promise.all([
      supabase
        .from('simple_items')
        .select('sku, item_name, cost_price')
        .eq('sku', row.itemSku)
        .maybeSingle(),
      BranchInventoryService.updateBranchStock(
        input.branchId,
        row.itemSku,
        quantitySign * row.quantity,
        movementType,
        input.actorId,
        'pos_shift_order',
        input.orderId,
        input.shiftId,
        `${input.reverse ? 'Reversed' : 'Posted'} POS sale from ${outlet?.name || input.outletId}`
      )
    ]);

    if (itemError) throw itemError;

    const { data: ledger, error: ledgerError } = await supabase
      .from('department_inventory_ledger')
      .insert({
        account_id: account.id,
        branch_id: input.branchId,
        item_sku: row.itemSku,
        movement_type: input.reverse ? 'return' : 'sale',
        quantity: row.quantity,
        unit_cost: numberValue(item?.cost_price),
        destination_type: 'pos',
        source_type: 'pos_shift_order',
        source_id: input.orderId,
        source_number: input.shiftId,
        metadata: {
          outlet_id: input.outletId,
          outlet_type: outlet?.outlet_type,
          outlet_item_ids: row.outletItemIds,
          outlet_item_names: row.names,
          reversed: input.reverse === true
        },
        performed_by: input.actorId
      })
      .select('*')
      .single();

    if (ledgerError) throw ledgerError;

    await logInventoryAudit({
      branchId: input.branchId,
      actorId: input.actorId,
      action: input.reverse ? 'pos_sale_reversal' : 'pos_sale_posted',
      entityType: 'pos_shift_order',
      entityId: input.orderId,
      referenceType: 'pos_shift',
      referenceId: input.shiftId,
      beforeValue: { item_sku: row.itemSku, quantity: movement.previousStock },
      afterValue: { item_sku: row.itemSku, quantity: movement.newStock },
      metadata: { ledger_id: ledger.id, consumed_quantity: row.quantity }
    });

    results.push({ row, movement, ledger });
  }

  return results;
}

export async function listPosInventoryMappings(outletId: string): Promise<JsonRecord[]> {
  const { data, error } = await supabase
    .from('pos_inventory_mappings')
    .select('*, item:simple_items(sku, item_name, unit_of_measure, cost_price), outlet_item:pos_outlet_items(id, name, sku)')
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function listDepartmentConsumption(input: {
  branchId: number;
  startDate?: string | null;
  endDate?: string | null;
  departmentCode?: string | null;
}): Promise<JsonRecord[]> {
  let query = supabase
    .from('department_inventory_ledger')
    .select('*, account:department_inventory_accounts(department_code, department_name, department_type)')
    .eq('branch_id', input.branchId)
    .order('created_at', { ascending: false })
    .limit(500);

  if (input.startDate) query = query.gte('created_at', input.startDate);
  if (input.endDate) query = query.lte('created_at', `${input.endDate}T23:59:59.999Z`);

  if (input.departmentCode) {
    const account = await getDepartmentAccount(input.branchId, input.departmentCode);
    query = query.eq('account_id', account.id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function listDepartmentIssueJournals(input: {
  branchId: number;
  startDate?: string | null;
  endDate?: string | null;
  departmentCode?: string | null;
  limit?: number;
}): Promise<JsonRecord[]> {
  let query = supabase
    .from('department_inventory_ledger')
    .select('*, account:department_inventory_accounts(department_code, department_name, department_type, accounting_treatment)')
    .eq('branch_id', input.branchId)
    .eq('movement_type', 'issue')
    .order('created_at', { ascending: false })
    .limit(input.limit || 200);

  if (input.startDate) query = query.gte('created_at', input.startDate);
  if (input.endDate) query = query.lte('created_at', `${input.endDate}T23:59:59.999Z`);

  if (input.departmentCode) {
    const account = await getDepartmentAccount(input.branchId, input.departmentCode);
    query = query.eq('account_id', account.id);
  }

  const { data: ledgerRows, error } = await query;
  if (error) throw error;
  if (!ledgerRows?.length) return [];

  const ledgerIds = ledgerRows.map((row) => String(row.id));

  const [{ data: auditRows }, { data: stockMoves }] = await Promise.all([
    supabase
      .from('inventory_audit_log')
      .select('*')
      .eq('branch_id', input.branchId)
      .eq('action', 'department_issue')
      .in('entity_id', ledgerIds),
    supabase
      .from('branch_stock_movements')
      .select('*')
      .eq('branch_id', input.branchId)
      .eq('movement_type', 'DEPARTMENT_ISSUE')
      .order('created_at', { ascending: false })
      .limit(1000)
  ]);

  const auditByLedgerId = new Map<string, JsonRecord>();
  for (const audit of auditRows || []) auditByLedgerId.set(String(audit.entity_id), audit as JsonRecord);

  const journalIds = Array.from(new Set(
    ledgerRows
      .map((row) => {
        const audit = auditByLedgerId.get(String(row.id));
        return String(
          row.metadata?.accounting_journal_id ||
          row.metadata?.journal_id ||
          audit?.metadata?.accounting_journal_id ||
          audit?.metadata?.journal_id ||
          ''
        );
      })
      .filter(Boolean)
  ));

  const { data: journalRows } = journalIds.length
    ? await supabase
        .from('accounting_journal_entries')
        .select('*, lines:accounting_journal_lines(*, account:accounting_chart_of_accounts(*))')
        .in('id', journalIds)
    : { data: [] as JsonRecord[] };

  const journalById = new Map<string, JsonRecord>();
  for (const journal of journalRows || []) journalById.set(String(journal.id), journal as JsonRecord);

  return ledgerRows.map((ledger) => {
    const audit = auditByLedgerId.get(String(ledger.id));
    const journalId = String(
      ledger.metadata?.accounting_journal_id ||
      audit?.metadata?.accounting_journal_id ||
      ''
    );
    const stockMovement = (stockMoves || []).find((move: any) =>
      String(move.item_sku) === String(ledger.item_sku) &&
      numberValue(move.quantity) === numberValue(ledger.quantity) &&
      (!ledger.source_id || String(move.reference_id || '') === String(ledger.source_id || ''))
    ) || (audit
      ? {
          movement_type: 'DEPARTMENT_ISSUE',
          item_sku: ledger.item_sku,
          quantity: ledger.quantity,
          previous_stock: audit.before_value?.quantity ?? ledger.metadata?.stock_before,
          new_stock: audit.after_value?.quantity ?? ledger.metadata?.stock_after,
          reference_id: audit.reference_id,
          created_at: audit.created_at,
          source: 'audit_log'
        }
      : null);

    return {
      ledger,
      account: ledger.account,
      journal: journalById.get(journalId) || null,
      stock_movement: stockMovement || null,
      audit_log: audit || null,
      accounting_treatment:
        ledger.account?.accounting_treatment ||
        audit?.metadata?.accounting_treatment ||
        'expense',
      debit_account_code: audit?.metadata?.debit_account_code || null,
      credit_account_code: audit?.metadata?.credit_account_code || BRANCH_STORE_INVENTORY_ACCOUNT.account_code,
      total_cost: numberValue(ledger.total_cost),
      created_at: ledger.created_at
    };
  });
}

export async function getDepartmentIssueJournalDetail(branchId: number, ledgerId: string): Promise<JsonRecord> {
  const rows = await listDepartmentIssueJournals({ branchId, limit: 1000 });
  const match = rows.find((row) => String(row.ledger?.id) === String(ledgerId));
  if (!match) throw new AppError('Department issue journal not found', 404);
  return match;
}

export async function listInventoryAuditLog(input: {
  branchId?: number | null;
  action?: string | null;
  limit?: number;
}): Promise<JsonRecord[]> {
  let query = supabase
    .from('inventory_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(input.limit || 100, 1), 500));

  if (input.branchId) query = query.eq('branch_id', input.branchId);
  if (input.action) query = query.eq('action', input.action);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getEnterpriseInventoryAnalytics(input: {
  branchId: number;
  startDate?: string | null;
  endDate?: string | null;
}): Promise<JsonRecord> {
  const endDate = input.endDate || new Date().toISOString().split('T')[0];
  const startDate = input.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [
    { data: stockRows, error: stockError },
    { data: movementRows, error: movementError },
    { data: ledgerRows, error: ledgerError },
    { data: stockTakeRows, error: stockTakeError }
  ] = await Promise.all([
    supabase
      .from('branch_stock')
      .select('*')
      .eq('branch_id', input.branchId),
    supabase
      .from('branch_stock_movements')
      .select('*')
      .eq('branch_id', input.branchId)
      .gte('created_at', startDate)
      .lte('created_at', `${endDate}T23:59:59.999Z`)
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('department_inventory_ledger')
      .select('*, account:department_inventory_accounts(department_code, department_name, department_type)')
      .eq('branch_id', input.branchId)
      .gte('created_at', startDate)
      .lte('created_at', `${endDate}T23:59:59.999Z`)
      .order('created_at', { ascending: false })
      .limit(2000),
    supabase
      .from('stock_counts')
      .select('*')
      .eq('branch_id', input.branchId)
      .gte('count_date', startDate)
      .lte('count_date', endDate)
      .order('count_date', { ascending: false })
      .limit(200)
  ]);

  if (stockError) throw stockError;
  if (movementError) throw movementError;
  if (ledgerError) throw ledgerError;
  if (stockTakeError) throw stockTakeError;

  const skus = Array.from(new Set((stockRows || []).map((row) => String(row.item_sku)).filter(Boolean)));
  const { data: itemRows } = skus.length
    ? await supabase
      .from('simple_items')
      .select('sku, item_name, category, unit_of_measure, cost_price, retail_price')
      .in('sku', skus)
    : { data: [] as JsonRecord[] };
  const itemBySku = new Map<string, JsonRecord>();
  for (const item of itemRows || []) itemBySku.set(String(item.sku), item);

  const movementBySku = new Map<string, number>();
  for (const movement of movementRows || []) {
    const sku = String(movement.item_sku || '');
    if (!sku) continue;
    movementBySku.set(sku, numberValue(movementBySku.get(sku)) + numberValue(movement.quantity));
  }
  const quantities = Array.from(movementBySku.values()).filter((value) => value > 0);
  const averageMovement = quantities.length
    ? quantities.reduce((sum, value) => sum + value, 0) / quantities.length
    : 0;

  const lowStock = [];
  const outOfStock = [];
  const stockValuation = [];
  const deadStock = [];
  const slowMoving = [];
  const fastMoving = [];

  for (const stock of stockRows || []) {
    const sku = String(stock.item_sku || '');
    const item = itemBySku.get(sku) || {};
    const quantity = numberValue(stock.quantity);
    const reorderLevel = numberValue(stock.reorder_level || 10);
    const movementQuantity = numberValue(movementBySku.get(sku));
    const costPrice = numberValue(item.cost_price);
    const row = {
      ...stock,
      item,
      movement_quantity: movementQuantity,
      stock_value: quantity * costPrice
    };

    stockValuation.push(row);
    if (quantity <= 0) outOfStock.push(row);
    if (quantity > 0 && quantity <= reorderLevel) lowStock.push(row);
    if (movementQuantity <= 0) deadStock.push(row);
    if (movementQuantity > 0 && averageMovement > 0 && movementQuantity <= averageMovement * 0.5) slowMoving.push(row);
    if (averageMovement > 0 && movementQuantity >= averageMovement * 1.5) fastMoving.push(row);
  }

  const consumptionByDepartment = new Map<string, JsonRecord>();
  for (const ledger of ledgerRows || []) {
    const account = ledger.account || {};
    const key = String(account.department_code || ledger.account_id || 'unknown');
    const current = consumptionByDepartment.get(key) || {
      department_code: key,
      department_name: account.department_name || key,
      department_type: account.department_type || 'unknown',
      quantity: 0,
      total_cost: 0,
      movement_count: 0
    };
    current.quantity += numberValue(ledger.quantity);
    current.total_cost += numberValue(ledger.total_cost);
    current.movement_count += 1;
    consumptionByDepartment.set(key, current);
  }

  const totalStockValue = stockValuation.reduce((sum, row) => sum + numberValue(row.stock_value), 0);
  const totalConsumptionCost = Array.from(consumptionByDepartment.values())
    .reduce((sum, row) => sum + numberValue(row.total_cost), 0);
  const pendingStockTakes = (stockTakeRows || [])
    .filter((row) => ['draft', 'submitted_to_accountant', 'submitted'].includes(String(row.status)));
  const largeVariances = (stockTakeRows || [])
    .filter((row) => Math.abs(numberValue(row.total_variance_value)) > 0);

  return {
    period: { start_date: startDate, end_date: endDate },
    summary: {
      sku_count: stockValuation.length,
      total_stock_value: totalStockValue,
      total_consumption_cost: totalConsumptionCost,
      low_stock_count: lowStock.length,
      out_of_stock_count: outOfStock.length,
      fast_moving_count: fastMoving.length,
      slow_moving_count: slowMoving.length,
      dead_stock_count: deadStock.length,
      pending_stock_take_count: pendingStockTakes.length,
      variance_stock_take_count: largeVariances.length
    },
    low_stock: lowStock.slice(0, 50),
    out_of_stock: outOfStock.slice(0, 50),
    fast_moving: fastMoving.slice(0, 50),
    slow_moving: slowMoving.slice(0, 50),
    dead_stock: deadStock.slice(0, 50),
    department_consumption: Array.from(consumptionByDepartment.values())
      .sort((a, b) => numberValue(b.total_cost) - numberValue(a.total_cost)),
    pending_stock_takes: pendingStockTakes,
    variance_stock_takes: largeVariances
  };
}

export async function upsertPosInventoryMapping(input: {
  branchId: number;
  outletId: string;
  outletItemId: string;
  itemSku: string;
  quantityPerSale: number;
  isActive?: boolean;
  actorId?: string | null;
}): Promise<JsonRecord> {
  if (!input.outletId || !input.outletItemId || !input.itemSku) {
    throw new AppError('Outlet item and inventory SKU are required', 400);
  }
  if (!Number.isFinite(input.quantityPerSale) || input.quantityPerSale <= 0) {
    throw new AppError('Quantity per sale must be greater than zero', 400);
  }

  const { data, error } = await supabase
    .from('pos_inventory_mappings')
    .upsert({
      branch_id: input.branchId,
      outlet_id: input.outletId,
      outlet_item_id: input.outletItemId,
      item_sku: input.itemSku,
      quantity_per_sale: input.quantityPerSale,
      is_active: input.isActive ?? true,
      created_by: input.actorId || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'outlet_item_id,item_sku' })
    .select('*')
    .single();

  if (error) throw error;

  await logInventoryAudit({
    branchId: input.branchId,
    actorId: input.actorId || null,
    action: 'pos_inventory_mapping_upserted',
    entityType: 'pos_inventory_mapping',
    entityId: data.id,
    afterValue: data
  });

  return data;
}

export async function submitStockTakeToAccountant(stockCountId: string, actorId: string): Promise<JsonRecord> {
  const { data: count, error } = await supabase
    .from('stock_counts')
    .update({
      status: 'submitted',
      submitted_to_accountant_by: actorId,
      submitted_to_accountant_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', stockCountId)
    .in('status', ['draft', 'rejected'])
    .select('*')
    .single();

  if (error || !count) throw error || new AppError('Stock take cannot be submitted to accountant', 400);
  await logInventoryAudit({
    branchId: count.branch_id,
    actorId,
    action: 'stock_take_submitted_to_accountant',
    entityType: 'stock_counts',
    entityId: stockCountId,
    afterValue: count
  });
  return count;
}

export async function reviewStockTakeByAccountant(input: {
  stockCountId: string;
  actorId: string;
  approved: boolean;
  notes?: string | null;
  action?: string | null;
}): Promise<JsonRecord> {
  const action = (textValue(input.action) ?? '').toLowerCase();
  const nextStatus = input.approved
    ? 'accountant_approved'
    : action.includes('clarification')
      ? 'under_review'
      : 'accountant_rejected';
  const { data: count, error } = await supabase
    .from('stock_counts')
    .update({
      status: nextStatus,
      accountant_reviewed_by: input.actorId,
      accountant_reviewed_at: new Date().toISOString(),
      accountant_review_notes: input.notes || null,
      accountant_submitted_by: input.approved ? input.actorId : null,
      accountant_submitted_at: input.approved ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.stockCountId)
    .in('status', ['submitted', 'submitted_to_accountant', 'under_review'])
    .select('*')
    .single();

  if (error || !count) throw error || new AppError('Stock take is not awaiting accountant review', 400);
  await logInventoryAudit({
    branchId: count.branch_id,
    actorId: input.actorId,
    action: input.approved
      ? 'stock_take_accountant_approved'
      : nextStatus === 'under_review'
        ? 'stock_take_accountant_requested_clarification'
        : 'stock_take_accountant_rejected',
    entityType: 'stock_counts',
    entityId: input.stockCountId,
    afterValue: count
  });
  return count;
}

export async function finalizeStockTakeByAuditor(input: {
  stockCountId: string;
  actorId: string;
  approved: boolean;
  notes?: string | null;
}): Promise<JsonRecord> {
  const { data: count, error: countError } = await supabase
    .from('stock_counts')
    .select('*')
    .eq('id', input.stockCountId)
    .single();

  if (countError || !count) throw countError || new AppError('Stock take not found', 404);
  if (!['accountant_approved', 'auditor_review', 'submitted'].includes(count.status)) {
    throw new AppError('Stock take is not awaiting auditor review', 400);
  }

  if (!input.approved) {
    const { data: rejected, error } = await supabase
      .from('stock_counts')
      .update({
        status: 'auditor_flagged',
        auditor_reviewed_by: input.actorId,
        auditor_reviewed_at: new Date().toISOString(),
        auditor_review_notes: input.notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', input.stockCountId)
      .select('*')
      .single();

    if (error) throw error;
    await logInventoryAudit({
      branchId: count.branch_id,
      actorId: input.actorId,
      action: 'stock_take_auditor_flagged',
      entityType: 'stock_counts',
      entityId: input.stockCountId,
      afterValue: rejected
    });
    return rejected;
  }

  const { data: items, error: itemsError } = await supabase
    .from('stock_count_items')
    .select('id, item_sku, physical_quantity, system_closing_stock, system_quantity')
    .eq('stock_count_id', input.stockCountId);

  if (itemsError) throw itemsError;

  for (const item of items || []) {
    const itemSku = textValue(item.item_sku);
    if (!itemSku) continue;
    const physicalQuantity = numberValue(item.physical_quantity);
    const systemQuantity = numberValue(item.system_closing_stock ?? item.system_quantity);
    const adjustment = physicalQuantity - systemQuantity;
    if (adjustment === 0) continue;

    await BranchInventoryService.updateBranchStock(
      Number(count.branch_id),
      itemSku,
      adjustment,
      'STOCK_TAKE_ADJUSTMENT',
      input.actorId,
      'stock_count',
      input.stockCountId,
      count.count_number || input.stockCountId,
      input.notes || 'Auditor finalized stock take variance adjustment'
    );
  }

  const { data: approved, error } = await supabase
    .from('stock_counts')
    .update({
      status: 'auditor_approved',
      auditor_reviewed_by: input.actorId,
      auditor_reviewed_at: new Date().toISOString(),
      auditor_review_notes: input.notes || null,
      locked_by: input.actorId,
      locked_at: new Date().toISOString(),
      next_opening_posted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', input.stockCountId)
    .select('*')
    .single();

  if (error) throw error;

  await logInventoryAudit({
    branchId: count.branch_id,
    actorId: input.actorId,
    action: 'stock_take_auditor_finalized',
    entityType: 'stock_counts',
    entityId: input.stockCountId,
    beforeValue: { status: count.status },
    afterValue: approved,
    metadata: { adjusted_item_count: (items || []).length }
  });

  return approved;
}
