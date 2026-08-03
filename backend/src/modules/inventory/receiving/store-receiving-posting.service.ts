import { InventoryPostingService } from '../shared/inventory-posting.service';

export class StoreReceivingPostingService {
  static async postSupplierReceipt(input: {
    actorId: string;
    branchId: number;
    grnId: string;
    grnNumber: string;
    idempotencyKey: string;
    items: Array<{
      item_name?: string | null;
      quantity_accepted?: number | null;
      quantity_received?: number | null;
      sku?: string | null;
      unit_price?: number | null;
    }>;
    remarks?: string | null;
    supplierId?: string | null;
  }) {
    return InventoryPostingService.postDocument({
      actorId: input.actorId,
      branchId: input.branchId,
      documentType: 'GRN',
      idempotencyKey: input.idempotencyKey,
      lines: input.items
        .map((item) => ({
          itemName: item.item_name || item.sku || null,
          itemSku: String(item.sku || '').trim(),
          quantity: Number(item.quantity_accepted ?? item.quantity_received ?? 0),
          sourceLocation: {
            branchId: input.branchId,
            locationCode: input.supplierId ? `SUPPLIER-${input.supplierId}` : 'SUPPLIER-EXTERNAL',
            locationName: 'Supplier',
            locationType: 'supplier' as const,
          },
          destinationLocation: {
            branchId: input.branchId,
            locationType: 'branch_store' as const,
          },
          unitCost: Number(item.unit_price || 0),
        }))
        .filter((item) => item.itemSku && item.quantity > 0),
      metadata: {
        remarks: input.remarks || null,
        supplier_id: input.supplierId || null,
      },
      reason: input.remarks || `Supplier receipt ${input.grnNumber}`,
      sourceId: input.grnId,
      sourceTable: 'store_grn',
    });
  }
}
