import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import * as BranchInventoryService from './branch-inventory.service';
import * as InventoryFoundationService from './inventory-foundation.service';
import notificationService from './notification.service';

type JsonRecord = Record<string, any>;
type StockMovementResult = { previousStock: number; newStock: number };
type DepartmentIssueResult = {
  ledger: JsonRecord;
  stock: StockMovementResult;
  accountingJournal?: JsonRecord | null;
  status?: 'completed' | 'partially_issued' | 'pending';
  minNumber?: string;
  requestedQuantity?: number;
  issuedQuantity?: number;
  pendingQuantity?: number;
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

const minDateKey = (): string => new Date().toISOString().slice(2, 10).replace(/-/g, '');

async function generateMaterialIssueNumber(branchId: number): Promise<string> {
  const prefix = `MIN${minDateKey()}-${branchId}-`;
  const { count, error } = await supabase
    .from('department_inventory_ledger')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .eq('source_type', 'material_issue_note')
    .ilike('source_number', `${prefix}%`);

  if (error) {
    logger.warn(`MIN sequence lookup failed: ${error.message}`);
  }

  return `${prefix}${String((count || 0) + 1).padStart(4, '0')}`;
}

async function notifyBranchIssueShortfall(input: {
  branchId: number;
  itemSku: string;
  itemName: string;
  requestedQuantity: number;
  issuedQuantity: number;
  pendingQuantity: number;
  departmentName: string;
  minNumber: string;
}) {
  try {
    const message = `${input.departmentName} requested ${input.requestedQuantity} of ${input.itemName}; issued ${input.issuedQuantity}, pending ${input.pendingQuantity}.`;
    await Promise.all([
      notificationService.notifyRole('procurement', 'Branch issue needs replenishment', message, {
        type: 'warning',
        category: 'stock',
        priority: input.issuedQuantity > 0 ? 'medium' : 'high',
        branchId: input.branchId,
        actionUrl: '/dashboard/procurement',
        metadata: {
          branch_id: input.branchId,
          item_sku: input.itemSku,
          min_number: input.minNumber,
          requested_quantity: input.requestedQuantity,
          issued_quantity: input.issuedQuantity,
          pending_quantity: input.pendingQuantity
        }
      }),
      notificationService.notifyRole('branch_storekeeper', 'Pending department issue', message, {
        type: 'warning',
        category: 'stock',
        priority: input.issuedQuantity > 0 ? 'medium' : 'high',
        branchId: input.branchId,
        actionUrl: '/dashboard/branch-store/stock-out',
        metadata: {
          branch_id: input.branchId,
          item_sku: input.itemSku,
          min_number: input.minNumber,
          requested_quantity: input.requestedQuantity,
          issued_quantity: input.issuedQuantity,
          pending_quantity: input.pendingQuantity
        }
      })
    ]);
  } catch (error) {
    logger.warn(`Branch issue shortfall notification failed: ${(error as Error).message}`);
  }
}

const itemQuantity = (item: JsonRecord): number =>
  numberValue(item.qty ?? item.quantity ?? item.quantity_sold ?? item.count);

async function recordDepartmentFoundationIssue(input: {
  branchId: number;
  itemSku: string;
  itemName: string;
  quantity: number;
  departmentCode: string;
  departmentName: string;
  actorId: string;
  documentReference: string;
  unitCost?: number;
  metadata?: JsonRecord;
}): Promise<string | null> {
  if (input.quantity <= 0) return null;
  try {
    const sourceLocation = {
      branchId: input.branchId,
      locationType: 'branch_store' as const,
      locationCode: `BRANCH-${input.branchId}-STORE`,
      locationName: `Branch Store ${input.branchId}`
    };
    const destinationLocation = {
      branchId: input.branchId,
      locationType: 'department' as const,
      locationCode: `DEPT-${input.branchId}-${input.departmentCode.toUpperCase()}`,
      locationName: input.departmentName,
      departmentCode: input.departmentCode
    };

    const balances = await InventoryFoundationService.listBalances({
      branchId: input.branchId,
      search: input.itemSku,
      limit: 100
    });
    const sourceBalance = balances.find((balance: any) =>
      String(balance.sku) === input.itemSku && String(balance.location_code) === sourceLocation.locationCode
    );
    const current = Number(sourceBalance?.current_quantity || 0);
    if (current < input.quantity) {
      await InventoryFoundationService.recordMovement({
        movementType: 'purchase_receipt',
        item: {
          sku: input.itemSku,
          sourceTable: 'simple_items',
          sourceItemKey: input.itemSku,
          itemName: input.itemName,
          defaultUnitCost: input.unitCost
        },
        sourceLocation: {
          locationType: 'external',
          locationCode: 'LEGACY-STOCK-BASELINE',
          locationName: 'Legacy stock baseline'
        },
        destinationLocation: sourceLocation,
        quantity: Math.max(input.quantity - current, input.quantity),
        unitCost: input.unitCost,
        reason: 'Legacy balance baseline before department issue',
        documentType: 'stock_take_adjustment',
        documentReference: input.documentReference,
        documentNumber: input.documentReference,
        metadata: { generated_by_controlled_movement_bridge: true }
      }, input.actorId);
    }

    const movement = await InventoryFoundationService.recordMovement({
      movementType: 'department_issue',
      item: {
        sku: input.itemSku,
        sourceTable: 'simple_items',
        sourceItemKey: input.itemSku,
        itemName: input.itemName,
        defaultUnitCost: input.unitCost
      },
      sourceLocation,
      destinationLocation,
      quantity: input.quantity,
      unitCost: input.unitCost,
      reason: `Material issue to ${input.departmentName}`,
      documentType: 'material_issue_note',
      documentReference: input.documentReference,
      documentNumber: input.documentReference,
      metadata: input.metadata || {}
    }, input.actorId);

    return movement?.movement?.id || null;
  } catch (error) {
    logger.warn(`Department issue foundation movement failed for ${input.itemSku}: ${(error as Error).message}`);
    return null;
  }
}

const outletItemIdFor = (item: JsonRecord): string | null =>
  textValue(item.outlet_item_id ?? item.product_id ?? item.id);

const isMissingPosInventoryMappingTable = (error: any): boolean => {
  return isMissingRelation(error, 'pos_inventory_mappings');
};

const isMissingRelation = (error: any, tableName?: string): boolean => {
  const message = String(error?.message || '');
  const details = String(error?.details || '');
  const haystack = `${message} ${details}`;
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    error?.code === 'PGRST200' ||
    (tableName ? haystack.includes(tableName) : false) ||
    haystack.includes('schema cache')
  );
};

const isMissingDepartmentLedgerTable = (error: any): boolean =>
  isMissingRelation(error, 'department_inventory_ledger');

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
  const { error } = await supabase.from('inventory_audit_logs').insert({
    branch_id: input.branchId ?? null,
    actor_id: input.actorId ?? null,
    action_type: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    source_document_type: input.referenceType ?? null,
    source_document_reference: input.referenceId ?? null,
    before_value: input.beforeValue ?? null,
    after_value: input.afterValue ?? null,
    reason: input.action,
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
      entry_number: journalNumber,
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

  // Silently ignore if table doesn't exist yet
  if (error && error.code !== 'PGRST205' && error.code !== '42P01') throw error;
}

export async function listDepartmentAccounts(branchId: number): Promise<JsonRecord[]> {
  try {
    await seedDepartmentAccounts(branchId);

    const { data, error } = await supabase
      .from('department_inventory_accounts')
      .select('*')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('department_type')
      .order('department_name');

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') return [];
      throw error;
    }
    return data || [];
  } catch {
    return [];
  }
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
  departmentRequestId?: string | null;
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
      .select('sku, item_name, description, cost_price')
      .eq('sku', input.itemSku)
      .maybeSingle()
  ]);

  if (stockError) throw stockError;
  if (itemError) throw itemError;
  const previousStock = numberValue(stock?.quantity);
  const minNumber = input.sourceNumber || await generateMaterialIssueNumber(input.branchId);
  const requestedQuantity = input.quantity;
  const issuedQuantity = Math.min(previousStock, requestedQuantity);
  const pendingQuantity = Math.max(0, requestedQuantity - issuedQuantity);
  const issueStatus: DepartmentIssueResult['status'] =
    issuedQuantity <= 0 ? 'pending' : pendingQuantity > 0 ? 'partially_issued' : 'completed';
  const itemName = item?.item_name || item?.description || input.itemSku;
  const unitCost = numberValue(item?.cost_price);
  let movement: StockMovementResult = { previousStock, newStock: previousStock };

  if (issuedQuantity > 0) {
    movement = await BranchInventoryService.updateBranchStock(
      input.branchId,
      input.itemSku,
      -issuedQuantity,
      'DEPARTMENT_ISSUE',
      input.actorId,
      'material_issue_note',
      input.sourceId || undefined,
      minNumber,
      input.notes || `Issued to ${account.department_name}`
    );

    const departmentStr = (account.department_code || '').toLowerCase();
    const departmentTypeStr = (account.department_type || '').toLowerCase();
    
    if (departmentStr.includes('bar') || departmentTypeStr.includes('bar')) {
      await syncIssuedStockToBar(input.branchId, input.itemSku, issuedQuantity, itemName, input.actorId);
    } else if (departmentStr.includes('kitchen') || departmentTypeStr.includes('kitchen') || ['buffet', 'breakfast', 'outside_catering'].includes(departmentStr)) {
      await syncIssuedStockToKitchen(input.branchId, input.itemSku, issuedQuantity, itemName, input.actorId);
    }
  }

  const { data: ledger, error: ledgerError } = await supabase
    .from('department_inventory_ledger')
    .insert({
      account_id: account.id,
      branch_id: input.branchId,
      item_sku: input.itemSku,
      movement_type: 'issue',
      quantity: issuedQuantity,
      unit_cost: unitCost,
      shift_code: input.shiftCode || null,
      destination_type: input.destinationType || account.department_type,
      event_name: input.eventName || null,
      event_date: input.eventDate || null,
      location: input.location || null,
      pax_count: input.paxCount ?? null,
      source_type: 'material_issue_note',
      source_id: input.sourceId || null,
      source_number: minNumber,
      department_request_id: input.departmentRequestId || null,
      document_number: minNumber,
      metadata: {
        ...(input.metadata || {}),
        min_number: minNumber,
        item_name: itemName,
        issue_status: issueStatus,
        requested_quantity: requestedQuantity,
        issued_quantity: issuedQuantity,
        pending_quantity: pendingQuantity,
        low_stock_alerted: pendingQuantity > 0,
        department_code: account.department_code,
        department_name: account.department_name
      },
      notes: input.notes || null,
      performed_by: input.actorId
    })
    .select('*')
    .single();

  if (ledgerError) throw ledgerError;

  const accountingJournal = issuedQuantity > 0
    ? await postDepartmentIssueJournal({
        branchId: input.branchId,
        actorId: input.actorId,
        account,
        ledger,
        itemSku: input.itemSku,
        itemName,
        quantity: issuedQuantity,
        unitCost,
        sourceNumber: minNumber
      })
    : null;

  const inventoryMovementId = issuedQuantity > 0
    ? await recordDepartmentFoundationIssue({
        branchId: input.branchId,
        itemSku: input.itemSku,
        itemName,
        quantity: issuedQuantity,
        departmentCode: account.department_code,
        departmentName: account.department_name,
        actorId: input.actorId,
        documentReference: minNumber,
        unitCost,
        metadata: {
          department_request_id: input.departmentRequestId || null,
          department_code: account.department_code,
          requested_quantity: requestedQuantity,
          issued_quantity: issuedQuantity,
          pending_quantity: pendingQuantity
        }
      })
    : null;

  const ledgerMetadata = {
    ...(ledger.metadata || {}),
    accounting_journal_id: accountingJournal?.id || null,
    inventory_movement_id: inventoryMovementId,
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
    .update({
      metadata: ledgerMetadata,
      inventory_movement_id: inventoryMovementId,
      document_number: minNumber
    })
    .eq('id', ledger.id);
  if (ledgerMetadataError) {
    logger.warn(`Department issue ledger metadata update failed: ${ledgerMetadataError.message}`);
  } else {
    ledger.metadata = ledgerMetadata;
  }

  await logInventoryAudit({
    branchId: input.branchId,
    actorId: input.actorId,
    action: issueStatus === 'pending' ? 'department_issue_pending' : 'department_issue',
    entityType: 'department_inventory_ledger',
    entityId: ledger.id,
    referenceType: 'material_issue_note',
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
      min_number: minNumber,
      issue_status: issueStatus,
      requested_quantity: requestedQuantity,
      issued_quantity: issuedQuantity,
      pending_quantity: pendingQuantity,
      quantity: issuedQuantity,
      unit_cost: unitCost,
      total_cost: issuedQuantity * unitCost
    }
  });

  if (pendingQuantity > 0) {
    await notifyBranchIssueShortfall({
      branchId: input.branchId,
      itemSku: input.itemSku,
      itemName,
      requestedQuantity,
      issuedQuantity,
      pendingQuantity,
      departmentName: account.department_name || account.department_code,
      minNumber
    });
  }

  return {
    ledger,
    stock: movement,
    accountingJournal,
    status: issueStatus,
    minNumber,
    requestedQuantity,
    issuedQuantity,
    pendingQuantity
  };
}

async function generateDepartmentRequestNumber(branchId: number): Promise<string> {
  const prefix = `DRL${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${branchId}-`;
  const { count, error } = await supabase
    .from('department_request_logs')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .ilike('request_number', `${prefix}%`);

  if (error) {
    logger.warn(`Department request sequence lookup failed: ${error.message}`);
  }

  return `${prefix}${String((count || 0) + 1).padStart(4, '0')}`;
}

export async function createDepartmentRequestLog(input: {
  branchId: number;
  departmentCode: string;
  requestorName: string;
  requestorContact?: string | null;
  shiftCode?: string | null;
  eventName?: string | null;
  eventDate?: string | null;
  paxCount?: number | null;
  purpose?: string | null;
  remarks?: string | null;
  attachments?: any[];
  items: Array<{ item_sku?: string; itemSku?: string; item_name?: string; itemName?: string; quantity: number; unit?: string; purpose?: string | null }>;
  actorId: string;
  metadata?: JsonRecord | null;
}) {
  if (!input.items?.length) throw new AppError('At least one item is required', 400);
  const account = await getDepartmentAccount(input.branchId, input.departmentCode);
  const requestNumber = await generateDepartmentRequestNumber(input.branchId);

  const { data: request, error } = await supabase
    .from('department_request_logs')
    .insert({
      request_number: requestNumber,
      branch_id: input.branchId,
      department_account_id: account.id,
      department_code: account.department_code,
      department_name: account.department_name,
      requestor_name: textValue(input.requestorName) || 'Department requestor',
      requestor_contact: textValue(input.requestorContact),
      shift_code: textValue(input.shiftCode),
      event_name: textValue(input.eventName),
      event_date: input.eventDate || null,
      pax_count: input.paxCount ?? null,
      purpose: textValue(input.purpose),
      remarks: textValue(input.remarks),
      attachments: input.attachments || [],
      status: 'pending_audit',
      audit_status: 'pending_audit',
      logged_by: input.actorId,
      metadata: input.metadata || {}
    })
    .select('*')
    .single();

  if (error) throw error;

  const skus = input.items.map(item => String(item.item_sku || item.itemSku || '').trim()).filter(Boolean);
  const { data: catalog, error: catalogError } = skus.length
    ? await supabase.from('simple_items').select('sku, item_name, description, unit_of_measure').in('sku', skus)
    : { data: [] as any[], error: null };
  if (catalogError) throw catalogError;
  const catalogMap = new Map((catalog || []).map((item: any) => [String(item.sku), item]));

  const rows = input.items.map(item => {
    const sku = String(item.item_sku || item.itemSku || '').trim();
    if (!sku) throw new AppError('Item SKU is required', 400);
    const quantity = numberValue(item.quantity);
    if (quantity <= 0) throw new AppError(`Quantity for ${sku} must be greater than zero`, 400);
    const catalogItem = catalogMap.get(sku);
    return {
      request_id: request.id,
      item_sku: sku,
      item_name: cleanItemName(item.item_name || item.itemName || catalogItem?.item_name || catalogItem?.description || sku),
      quantity,
      unit: item.unit || catalogItem?.unit_of_measure || 'units',
      purpose: textValue(item.purpose || input.purpose),
      pending_quantity: quantity,
      status: 'logged'
    };
  });

  const { data: createdItems, error: itemError } = await supabase
    .from('department_request_items')
    .insert(rows)
    .select('*');
  if (itemError) throw itemError;

  await logInventoryAudit({
    branchId: input.branchId,
    actorId: input.actorId,
    action: 'department_request_logged',
    entityType: 'department_request_logs',
    entityId: request.id,
    referenceType: 'department_request_log',
    referenceId: request.id,
    afterValue: { request_number: requestNumber, item_count: rows.length },
    metadata: {
      request_number: requestNumber,
      department_code: account.department_code,
      department_name: account.department_name
    }
  });

  return { ...request, items: createdItems || [] };
}

function cleanItemName(value: unknown): string {
  const text = String(value || '').trim();
  return text || 'Unknown item';
}

export async function listDepartmentRequestLogs(input: {
  branchId: number;
  status?: string | null;
  search?: string | null;
  limit?: number;
}) {
  try {
    let query = supabase
      .from('department_request_logs')
      .select('*, items:department_request_items(*)')
      .eq('branch_id', input.branchId)
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(input.limit || 100, 1), 300));

    if (input.status) query = query.eq('status', input.status);
    if (input.search) {
      const term = `%${input.search}%`;
      query = query.or(`request_number.ilike.${term},department_name.ilike.${term},requestor_name.ilike.${term},purpose.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') return [];
      throw error;
    }
    return data || [];
  } catch {
    return [];
  }
}

export async function getDepartmentRequestLog(branchId: number, id: string) {
  const { data, error } = await supabase
    .from('department_request_logs')
    .select('*, items:department_request_items(*)')
    .eq('branch_id', branchId)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') throw new AppError('Department request not found', 404);
    throw error;
  }
  if (!data) throw new AppError('Department request not found', 404);
  return data;
}

export async function issueDepartmentRequest(input: {
  branchId: number;
  requestId: string;
  actorId: string;
  notes?: string | null;
}) {
  const request = await getDepartmentRequestLog(input.branchId, input.requestId);
  const items = request.items || [];
  if (!items.length) throw new AppError('Department request has no items', 400);

  const results: DepartmentIssueResult[] = [];
  for (const item of items) {
    const pending = numberValue(item.pending_quantity || item.quantity);
    if (pending <= 0 || item.status === 'closed') continue;
    const result = await recordDepartmentIssue({
      branchId: input.branchId,
      itemSku: item.item_sku,
      quantity: pending,
      departmentCode: request.department_code,
      actorId: input.actorId,
      shiftCode: request.shift_code,
      destinationType: null,
      eventName: request.event_name,
      eventDate: request.event_date,
      paxCount: request.pax_count,
      sourceType: 'department_request_log',
      sourceId: request.id,
      sourceNumber: resultSafeSourceNumber(request.request_number),
      departmentRequestId: request.id,
      notes: input.notes || request.remarks || null,
      metadata: {
        department_request_number: request.request_number,
        department_request_item_id: item.id
      }
    });
    results.push(result);

    await supabase
      .from('department_request_items')
      .update({
        issued_quantity: numberValue(item.issued_quantity) + numberValue(result.issuedQuantity),
        pending_quantity: numberValue(result.pendingQuantity),
        status: result.status === 'completed' ? 'issued' : result.status === 'partially_issued' ? 'partially_issued' : 'pending_stock',
        updated_at: new Date().toISOString()
      })
      .eq('id', item.id);
  }

  const anyPending = results.some(result => numberValue(result.pendingQuantity) > 0);
  const anyIssued = results.some(result => numberValue(result.issuedQuantity) > 0);
  const status = anyPending ? (anyIssued ? 'partially_issued' : 'approved') : 'issued';

  const { data: updated, error } = await supabase
    .from('department_request_logs')
    .update({
      status,
      audit_status: 'audited',
      audited_by: input.actorId,
      audited_at: new Date().toISOString(),
      approved_by: input.actorId,
      approved_at: new Date().toISOString(),
      issue_reference: results.map(result => result.minNumber).filter(Boolean).join(', ') || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', request.id)
    .select('*, items:department_request_items(*)')
    .single();

  if (error) throw error;

  await logInventoryAudit({
    branchId: input.branchId,
    actorId: input.actorId,
    action: 'department_request_issued',
    entityType: 'department_request_logs',
    entityId: request.id,
    referenceType: 'department_request_log',
    referenceId: request.id,
    beforeValue: { status: request.status },
    afterValue: { status, min_numbers: results.map(result => result.minNumber) },
    metadata: { request_number: request.request_number }
  });

  return { request: updated, issues: results };
}

function resultSafeSourceNumber(requestNumber: string): string {
  return `MIN-${requestNumber}`;
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

    // Direct POS outlet stock is validated and reduced on pos_outlet_items.
    // This enterprise branch-stock bridge should only post configured raw
    // inventory mappings, otherwise a produced menu item would incorrectly
    // consume branch-store stock a second time.
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
  const outletItemIds = Array.from(new Set(items.map(outletItemIdFor).filter(Boolean))) as string[];
  if (outletItemIds.length) {
    const { data: outletItems, error: outletItemsError } = await supabase
      .from('pos_outlet_items')
      .select('id, name, sku, current_stock, track_stock')
      .eq('outlet_id', outletId)
      .in('id', outletItemIds);

    if (outletItemsError) throw outletItemsError;

    const outletItemById = new Map<string, JsonRecord>();
    for (const outletItem of outletItems || []) {
      outletItemById.set(String(outletItem.id), outletItem);
    }

    const outletShortfalls: string[] = [];
    for (const item of items) {
      const outletItemId = outletItemIdFor(item);
      const soldQty = itemQuantity(item);
      if (!outletItemId || soldQty <= 0) continue;
      const outletItem = outletItemById.get(outletItemId);
      if (!outletItem || outletItem.track_stock === false) continue;
      const currentStock = numberValue(outletItem.current_stock);
      
      // Allow negative stock (overselling) for POS - track in stock but don't block sale
      // This allows continuous operations even when stock runs out
      if (currentStock < soldQty) {
        logger.warn(`⚠️ Low/Negative stock warning: ${outletItem.name || outletItem.sku} has ${currentStock}, selling ${soldQty}`);
        // Don't add to shortfalls - allow the sale to proceed
        // outletShortfalls.push(
        //   `${outletItem.name || outletItem.sku || outletItemId} has ${currentStock}, needs ${soldQty}`
        // );
      }
    }

    // Commented out to allow sales even with insufficient stock
    // Stock will go negative, which can be reconciled during stock take
    // if (outletShortfalls.length > 0) {
    //   throw new AppError(`POS outlet stock unavailable: ${outletShortfalls.join(', ')}`, 409);
    // }
  }

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
  
  // Allow negative stock for POS operations - log warning but don't block
  if (shortfalls.length > 0) {
    logger.warn(`⚠️ Branch stock shortfalls detected but allowing sale: ${shortfalls.map((row) => `${row.itemSku} needs ${row.quantity}`).join(', ')}`);
    // Don't throw error - allow sale to proceed with negative stock
    // Stock can be reconciled during stock take or restock
    // throw new AppError(
    //   `Out of stock: ${shortfalls.map((row) => `${row.itemSku} needs ${row.quantity}`).join(', ')}`,
    //   409
    // );
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
      
      // Allow negative stock - log warning but don't block POS sale
      if (numberValue(stock?.quantity) < row.quantity) {
        logger.warn(`⚠️ Insufficient stock for ${row.itemSku}: has ${numberValue(stock?.quantity)}, needs ${row.quantity}. Allowing sale with negative stock.`);
        // Don't throw error - allow sale to proceed
        // throw new AppError(`Out of stock: ${row.itemSku} needs ${row.quantity}`, 409);
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
    .select('*, outlet_item:pos_outlet_items(id, name, sku)')
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const rows = data || [];
  const skus = [...new Set(rows.map((r) => String(r.item_sku)).filter(Boolean))];
  const { data: items } = skus.length
    ? await supabase.from('simple_items').select('sku, item_name, unit_of_measure, cost_price').in('sku', skus)
    : { data: [] as JsonRecord[] };
  const bySku = new Map((items || []).map((i: any) => [String(i.sku), i]));
  return rows.map((r) => ({ ...r, item: bySku.get(String(r.item_sku)) || null }));
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
  if (isMissingDepartmentLedgerTable(error)) {
    logger.warn('Department consumption ledger unavailable; returning empty list until enterprise inventory migration is applied.');
    return [];
  }
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
  if (isMissingDepartmentLedgerTable(error)) {
    logger.warn('Department issue journal ledger unavailable; returning empty list until enterprise inventory migration is applied.');
    return [];
  }
  if (error) throw error;
  if (!ledgerRows?.length) return [];

  const ledgerIds = ledgerRows.map((row) => String(row.id));

  const [{ data: auditRows }, { data: stockMoves }] = await Promise.all([
    supabase
      .from('inventory_audit_logs')
      .select('*')
      .eq('branch_id', input.branchId)
      .eq('action_type', 'department_issue')
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
    .from('inventory_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(input.limit || 100, 1), 500));

  if (input.branchId) query = query.eq('branch_id', input.branchId);
  if (input.action) query = query.eq('action_type', input.action);

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
  if (ledgerError && !isMissingDepartmentLedgerTable(ledgerError)) throw ledgerError;
  if (ledgerError && isMissingDepartmentLedgerTable(ledgerError)) {
    logger.warn('Enterprise inventory analytics ledger unavailable; continuing without department consumption rows.');
  }
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
  const safeLedgerRows = ledgerError ? [] : (ledgerRows || []);
  for (const ledger of safeLedgerRows) {
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

  if (input.approved) {
    // 1. Fetch items from stock_take_lines
    const { data: takeLines } = await supabase
      .from('stock_take_lines')
      .select('item_sku, physical_quantity, system_closing_stock, system_quantity, explanation, action_taken')
      .eq('stock_count_id', input.stockCountId);

    // 2. Fetch items from stock_count_items
    const { data: countItems } = await supabase
      .from('stock_count_items')
      .select('item_sku, physical_quantity, system_closing_stock, system_quantity, explanation, action_taken')
      .eq('stock_count_id', input.stockCountId);

    const itemsToCheck = (takeLines && takeLines.length > 0) ? takeLines : (countItems || []);

    interface StockTakeCheckItem {
      item_sku?: string;
      physical_quantity?: number;
      system_closing_stock?: number;
      system_quantity?: number;
      explanation?: string;
      action_taken?: string;
    }

    const unexplained = (itemsToCheck as StockTakeCheckItem[]).filter((item: StockTakeCheckItem) => {
      const system = Number(item.system_closing_stock ?? item.system_quantity ?? 0);
      const physical = Number(item.physical_quantity ?? 0);
      const variance = physical - system;
      return variance !== 0 && (!item.explanation || !item.action_taken);
    });

    if (unexplained.length > 0) {
      throw new AppError(`All item variances must have an explanation and an action taken before approval. Missing for: ${unexplained.map(i => i.item_sku).join(', ')}`, 400);
    }
  }

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

async function syncIssuedStockToBar(branchId: number, itemSku: string, quantity: number, itemName: string, userId: string) {
  const { data: drink } = await supabase
    .from('bar_drinks')
    .select('id, item_name')
    .eq('branch_id', branchId)
    .eq('item_sku', itemSku)
    .maybeSingle();

  if (drink?.id) {
    const { data: currentStock } = await supabase
      .from('bar_stock')
      .select('current_stock')
      .eq('branch_id', branchId)
      .eq('drink_id', drink.id)
      .maybeSingle();
      
    const newStock = Number(currentStock?.current_stock || 0) + quantity;
    
    await supabase
      .from('bar_stock')
      .upsert({
        branch_id: branchId,
        drink_id: drink.id,
        current_stock: newStock,
        par_level: 10,
        unit: 'Unit',
        last_updated: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'branch_id,drink_id' });

    const { data: outlets } = await supabase
      .from('pos_outlets')
      .select('id')
      .eq('branch_id', branchId)
      .in('outlet_type', ['bar', 'restaurant_bar']);
      
    if (outlets && outlets.length > 0) {
      for (const outlet of outlets) {
        const { data: posStock } = await supabase
          .from('pos_outlet_items')
          .select('current_stock')
          .eq('outlet_id', outlet.id)
          .eq('item_sku', itemSku)
          .maybeSingle();
          
        const newPosStock = Number(posStock?.current_stock || 0) + quantity;
        
        await supabase
          .from('pos_outlet_items')
          .upsert({
            outlet_id: outlet.id,
            item_sku: itemSku,
            item_name: drink.item_name || itemName,
            current_stock: newPosStock,
            price: 0,
            last_updated: new Date().toISOString()
          }, { onConflict: 'outlet_id,item_sku' });
      }
    }

    await supabase
      .from('bar_stock_ledger')
      .insert({
        branch_id: branchId,
        item_sku: itemSku,
        item_name: drink.item_name || itemName,
        transaction_type: 'RECEIPT',
        reference_type: 'STOCK_OUT',
        reference_id: null,
        opening_balance: Number(currentStock?.current_stock || 0),
        quantity_in: quantity,
        quantity_out: 0,
        closing_balance: newStock,
        unit_of_measure: 'Unit',
        user_id: userId,
        notes: `Issued from branch store`
      });
  }
}

async function syncIssuedStockToKitchen(branchId: number, itemSku: string, quantity: number, itemName: string, userId: string) {
  const { data: currentStock } = await supabase
    .from('kitchen_stock')
    .select('current_balance')
    .eq('branch_id', branchId)
    .eq('item_sku', itemSku)
    .maybeSingle();
    
  const newBalance = Number(currentStock?.current_balance || 0) + quantity;
  
  await supabase
    .from('kitchen_stock')
    .upsert({
      branch_id: branchId,
      item_sku: itemSku,
      item_name: itemName,
      current_balance: newBalance,
      last_updated: new Date().toISOString()
    }, { onConflict: 'branch_id,item_sku' });
    
  await supabase
    .from('kitchen_stock_ledger')
    .insert({
      branch_id: branchId,
      item_sku: itemSku,
      item_name: itemName,
      transaction_type: 'RECEIPT',
      reference_type: 'STOCK_OUT',
      reference_id: null,
      opening_balance: Number(currentStock?.current_balance || 0),
      quantity_in: quantity,
      quantity_out: 0,
      closing_balance: newBalance,
      unit_of_measure: 'Unit',
      user_id: userId,
      notes: `Issued from branch store`
    });
}
