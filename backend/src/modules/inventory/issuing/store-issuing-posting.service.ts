import { InventoryPostingService } from '../shared/inventory-posting.service';

export class StoreIssuingPostingService {
  static async postDepartmentIssue(input: {
    actorId: string;
    branchId: number;
    departmentCode: string;
    departmentName: string;
    documentNumber: string;
    idempotencyKey: string;
    itemName?: string | null;
    itemSku: string;
    notes?: string | null;
    quantity: number;
    unitCost?: number | null;
  }) {
    return InventoryPostingService.postDocument({
      actorId: input.actorId,
      branchId: input.branchId,
      documentType: 'MIN',
      idempotencyKey: input.idempotencyKey,
      lines: [
        {
          itemName: input.itemName || input.itemSku,
          itemSku: input.itemSku,
          quantity: input.quantity,
          sourceLocation: {
            branchId: input.branchId,
            locationType: 'branch_store',
          },
          destinationLocation: {
            branchId: input.branchId,
            departmentCode: input.departmentCode,
            locationName: input.departmentName,
            locationType: 'department',
          },
          unitCost: Number(input.unitCost || 0),
        },
      ],
      metadata: {
        department_code: input.departmentCode,
        department_name: input.departmentName,
      },
      reason: input.notes || `Department issue ${input.documentNumber}`,
      sourceId: null,
      sourceTable: 'department_inventory_ledger',
    });
  }
}
