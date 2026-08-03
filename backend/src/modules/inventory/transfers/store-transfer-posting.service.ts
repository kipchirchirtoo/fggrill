import { InventoryPostingResult } from '../shared/inventory-posting.types';
import { InventoryPostingService } from '../shared/inventory-posting.service';

type TransferLine = {
  dispatched_quantity?: number | null;
  item_name?: string | null;
  item_sku?: string | null;
  quantity?: number | null;
  quantity_received?: number | null;
  received_quantity?: number | null;
};

export class StoreTransferPostingService {
  static async postDispatchToTransit(input: {
    actorId: string;
    destinationBranchId?: number | null;
    dispatchId: string;
    dispatchNumber: string;
    fromBranchId: number;
    idempotencyKey: string;
    items: TransferLine[];
    notes?: string | null;
    sourceTable?: string;
    sourceTableId?: string | null;
    sourceType?: 'branch_store' | 'central_store';
  }): Promise<InventoryPostingResult> {
    return InventoryPostingService.postDocument({
      actorId: input.actorId,
      branchId: input.fromBranchId,
      documentType: 'TRF',
      idempotencyKey: input.idempotencyKey,
      lines: input.items
        .map((item) => ({
          itemName: item.item_name || item.item_sku || null,
          itemSku: String(item.item_sku || '').trim(),
          metadata: {
            dispatch_id: input.dispatchId,
            dispatch_number: input.dispatchNumber,
          },
          quantity: Number(item.dispatched_quantity ?? item.quantity ?? 0),
          sourceLocation: {
            branchId: input.fromBranchId,
            locationCode:
              input.sourceType === 'branch_store'
                ? `BRANCH-${input.fromBranchId}-STORE`
                : `CENTRAL-${input.fromBranchId}-STORE`,
            locationName:
              input.sourceType === 'branch_store'
                ? `Branch Store ${input.fromBranchId}`
                : `Central Store ${input.fromBranchId}`,
            locationType: input.sourceType || 'central_store',
          },
          destinationLocation: {
            branchId: input.destinationBranchId ?? null,
            locationCode: `TRANSIT-${input.dispatchId}`,
            locationName: `In transit ${input.dispatchNumber}`,
            locationType: 'transit' as const,
            metadata: {
              dispatch_id: input.dispatchId,
              destination_branch_id: input.destinationBranchId ?? null,
            },
          },
          unitCost: 0,
        }))
        .filter((item) => item.itemSku && item.quantity > 0),
      metadata: {
        destination_branch_id: input.destinationBranchId ?? null,
        dispatch_id: input.dispatchId,
        dispatch_number: input.dispatchNumber,
        notes: input.notes || null,
      },
      reason: input.notes || `Dispatch ${input.dispatchNumber}`,
      sourceId: input.sourceTableId ?? input.dispatchId,
      sourceTable: input.sourceTable || 'dispatch_notes',
    });
  }

  static async postTransitReceipt(input: {
    actorId: string;
    dispatchId: string;
    dispatchNumber: string;
    idempotencyKey: string;
    items: TransferLine[];
    notes?: string | null;
    receivingBranchId: number;
    sourceTable?: string;
    sourceTableId?: string | null;
  }): Promise<InventoryPostingResult> {
    return InventoryPostingService.postDocument({
      actorId: input.actorId,
      branchId: input.receivingBranchId,
      documentType: 'TRF',
      idempotencyKey: input.idempotencyKey,
      lines: input.items
        .map((item) => ({
          itemName: item.item_name || item.item_sku || null,
          itemSku: String(item.item_sku || '').trim(),
          metadata: {
            dispatch_id: input.dispatchId,
            dispatch_number: input.dispatchNumber,
          },
          quantity: Number(item.quantity_received ?? item.received_quantity ?? item.quantity ?? 0),
          sourceLocation: {
            branchId: input.receivingBranchId,
            locationCode: `TRANSIT-${input.dispatchId}`,
            locationName: `In transit ${input.dispatchNumber}`,
            locationType: 'transit' as const,
            metadata: {
              dispatch_id: input.dispatchId,
            },
          },
          destinationLocation: {
            branchId: input.receivingBranchId,
            locationType: 'branch_store' as const,
          },
          unitCost: 0,
        }))
        .filter((item) => item.itemSku && item.quantity > 0),
      metadata: {
        dispatch_id: input.dispatchId,
        dispatch_number: input.dispatchNumber,
        notes: input.notes || null,
        receiving_branch_id: input.receivingBranchId,
      },
      reason: input.notes || `Receipt ${input.dispatchNumber}`,
      sourceId: input.sourceTableId ?? input.dispatchId,
      sourceTable: input.sourceTable || 'dispatch_notes',
    });
  }
}
