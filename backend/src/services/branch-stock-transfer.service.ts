import { supabase } from '../config/supabase';
import { updateBranchStock, resolveBranchStockSource } from './branch-inventory.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface TransferItem {
  item_sku: string;
  dispatched_quantity: number;
}

export interface ReceiptItem {
  id?: string;
  item_id?: string;
  item_sku?: string;
  sku?: string;
  quantity_received?: number;
  received_quantity?: number;
}

/**
 * Initiate a branch-to-branch stock transfer
 */
export async function initiateTransfer(
  fromBranchId: number,
  toBranchId: number,
  userId: string,
  items: TransferItem[],
  notes?: string,
  urgency?: 'NORMAL' | 'URGENT'
): Promise<Record<string, unknown>> {
  if (fromBranchId === toBranchId) {
    throw new AppError('Cannot transfer stock to the same branch', 400);
  }

  // Get destination branch code
  const { data: toBranch, error: branchError } = await supabase
    .from('branches')
    .select('code')
    .eq('id', toBranchId)
    .single();

  if (branchError || !toBranch?.code) {
    throw new AppError('Destination branch not found', 404);
  }

  const branchCode = toBranch.code;
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const transferNumber = `TX-${branchCode}-${dateStr}-${Date.now().toString().slice(-4)}`;

  // Start by inserting the header record
  const { data: transfer, error: txError } = await supabase
    .from('branch_stock_transfers')
    .insert({
      from_branch_id: fromBranchId,
      to_branch_id: toBranchId,
      initiated_by: userId,
      status: 'DISPATCHED',
      urgency: urgency || 'NORMAL',
      note: notes,
      transfer_number: transferNumber
    })
    .select()
    .single();

  if (txError) {
    logger.error('Failed to create branch transfer header:', txError);
    throw txError;
  }

  const transferItems: Record<string, unknown>[] = [];

  try {
    for (const item of items) {
      const sku = String(item.item_sku).trim();
      const qty = Number(item.dispatched_quantity);

      if (!sku || isNaN(qty) || qty <= 0) {
        throw new AppError(`Invalid item SKU or quantity: ${sku} (${qty})`, 400);
      }

      // Check available stock at source branch
      const stockSource = await resolveBranchStockSource(fromBranchId, sku);
      if (stockSource.available < qty) {
        throw new AppError(`Insufficient stock for item ${sku}. Available: ${stockSource.available}, Requested: ${qty}`, 400);
      }

      // Deduct stock immediately
      await updateBranchStock(
        fromBranchId,
        sku,
        -qty,
        'BRANCH_TRANSFER_DISPATCH',
        userId,
        'branch_stock_transfers',
        transfer.id,
        transferNumber,
        `Branch transfer ${transferNumber} to branch #${toBranchId}`
      );

      transferItems.push({
        transfer_id: transfer.id,
        item_sku: sku,
        quantity_dispatched: qty
      });
    }

    const { error: itemsError } = await supabase
      .from('branch_stock_transfer_items')
      .insert(transferItems);

    if (itemsError) {
      logger.error('Failed to insert branch transfer items:', itemsError);
      throw itemsError;
    }

    logger.info(`Branch stock transfer ${transferNumber} initiated by ${userId}`);
    return { ...transfer, items: transferItems };
  } catch (error) {
    // If any item fails, update transfer to show it had error (in a transaction system we would roll back,
    // but since we deduct stock incrementally, we update status to document issues)
    await supabase
      .from('branch_stock_transfers')
      .update({ status: 'DISCREPANCY_FLAGGED', note: `Failed during dispatch: ${(error as any).message}` })
      .eq('id', transfer.id);
    throw error;
  }
}

/**
 * Confirm receipt of a branch stock transfer
 */
export async function confirmTransferReceipt(
  transferId: string,
  userId: string,
  itemsReceived: ReceiptItem[],
  notes?: string
): Promise<Record<string, unknown>> {
  // Fetch transfer and its items
  const { data: transfer, error: fetchError } = await supabase
    .from('branch_stock_transfers')
    .select('*, items:branch_stock_transfer_items(*)')
    .eq('id', transferId)
    .single();

  if (fetchError || !transfer) {
    throw new AppError('Transfer not found', 404);
  }

  if (transfer.status !== 'DISPATCHED') {
    throw new AppError(`Transfer has already been processed (current status: ${transfer.status})`, 400);
  }

  let hasDiscrepancy = false;
  const updates = [];
  const varianceLogs = [];

  for (const item of transfer.items) {
    const rec = itemsReceived.find(r => 
      (r.id && String(r.id) === String(item.id)) ||
      (r.item_id && String(r.item_id) === String(item.id)) ||
      (r.item_sku && String(r.item_sku) === String(item.item_sku)) ||
      (r.sku && String(r.sku) === String(item.item_sku))
    );
    const qtyReceived = rec ? Number(rec.quantity_received ?? rec.received_quantity ?? 0) : 0;

    // Update received qty in transfer items table
    updates.push(
      supabase
        .from('branch_stock_transfer_items')
        .update({ quantity_received: qtyReceived })
        .eq('id', item.id)
    );

    // Add stock to destination branch immediately
    await updateBranchStock(
      transfer.to_branch_id,
      item.item_sku,
      qtyReceived,
      'BRANCH_TRANSFER_RECEIPT',
      userId,
      'branch_stock_transfers',
      transfer.id,
      transfer.transfer_number,
      `Branch transfer receipt ${transfer.transfer_number} from branch #${transfer.from_branch_id}`
    );

    // If quantity received differs from dispatched, log discrepancies
    if (qtyReceived !== Number(item.quantity_dispatched)) {
      hasDiscrepancy = true;
      const diff = Number(item.quantity_dispatched) - qtyReceived;

      // Discrepancy exception for sender branch
      varianceLogs.push({
        branch_id: transfer.from_branch_id,
        exception_type: 'INTER_BRANCH_TRANSFER',
        severity: 'medium',
        description: `Discrepancy in transfer ${transfer.transfer_number} to branch #${transfer.to_branch_id} for item ${item.item_sku}: Dispatched ${item.quantity_dispatched}, Received ${qtyReceived} (Diff: ${diff})`,
        amount: 0,
        reference_type: 'branch_stock_transfers',
        reference_id: transfer.id,
        status: 'open',
        detected_at: new Date().toISOString()
      });

      // Discrepancy exception for receiver branch
      varianceLogs.push({
        branch_id: transfer.to_branch_id,
        exception_type: 'INTER_BRANCH_TRANSFER',
        severity: 'medium',
        description: `Discrepancy in transfer ${transfer.transfer_number} from branch #${transfer.from_branch_id} for item ${item.item_sku}: Dispatched ${item.quantity_dispatched}, Received ${qtyReceived} (Diff: ${diff})`,
        amount: 0,
        reference_type: 'branch_stock_transfers',
        reference_id: transfer.id,
        status: 'open',
        detected_at: new Date().toISOString()
      });
    }
  }

  // Commit items updates
  await Promise.all(updates);

  // Write exceptions/variance logs
  if (varianceLogs.length > 0) {
    const { error: varError } = await supabase
      .from('audit_exceptions')
      .insert(varianceLogs);
    if (varError) {
      logger.error('Failed to log inter-branch variances into audit_exceptions:', varError);
    }
  }

  // Update header status
  const finalStatus = hasDiscrepancy ? 'DISCREPANCY_FLAGGED' : 'RECEIVED';
  const { data: updatedTx, error: updateTxError } = await supabase
    .from('branch_stock_transfers')
    .update({
      status: finalStatus,
      confirmed_at: new Date().toISOString(),
      confirmed_by: userId,
      note: notes ? `${transfer.note || ''}\nReceipt Notes: ${notes}`.trim() : transfer.note
    })
    .eq('id', transferId)
    .select()
    .single();

  if (updateTxError) {
    logger.error('Failed to confirm receipt on branch transfer header:', updateTxError);
    throw updateTxError;
  }

  logger.info(`Branch stock transfer ${transfer.transfer_number} confirmed received by ${userId} with status ${finalStatus}`);
  return updatedTx;
}
