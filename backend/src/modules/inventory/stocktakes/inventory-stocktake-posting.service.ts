import { InventoryPostingLocationInput, InventoryPostingResult } from '../shared/inventory-posting.types';
import { InventoryPostingService } from '../shared/inventory-posting.service';

type StocktakeApprovalLine = {
  itemName?: string | null;
  itemSku: string;
  metadata?: Record<string, unknown>;
  physicalQuantity: number;
  systemQuantity: number;
  unitCost?: number | null;
};

type StocktakeApprovalInput = {
  actorId: string;
  branchId: number;
  documentReason: string;
  idempotencyKey: string;
  lines: StocktakeApprovalLine[];
  location: InventoryPostingLocationInput;
  metadata?: Record<string, unknown>;
  scope: 'store' | 'bar' | 'kitchen';
  sourceId: string;
  sourceTable: string;
  stocktakeDate: string;
};

export class InventoryStocktakePostingService {
  static async postApproval(input: StocktakeApprovalInput): Promise<InventoryPostingResult | null> {
    const postingLines = input.lines
      .map((line) => {
        const systemQuantity = Number(line.systemQuantity || 0);
        const physicalQuantity = Number(line.physicalQuantity || 0);
        const variance = physicalQuantity - systemQuantity;
        if (Math.abs(variance) < 0.0001) return null;
        const adjustmentSource: InventoryPostingLocationInput = {
          branchId: input.branchId,
          locationCode: `${input.scope.toUpperCase()}-ADJUSTMENT-SOURCE`,
          locationName: `${input.scope} stocktake adjustment source`,
          locationType: 'external',
        };
        const adjustmentSink: InventoryPostingLocationInput = {
          branchId: input.branchId,
          locationCode: `${input.scope.toUpperCase()}-ADJUSTMENT-SINK`,
          locationName: `${input.scope} stocktake adjustment sink`,
          locationType: 'external',
        };

        if (variance > 0) {
          return {
            allowNegativeOverride: false,
            itemName: line.itemName,
            itemSku: line.itemSku,
            metadata: {
              ...(line.metadata || {}),
              stocktake_scope: input.scope,
              stocktake_source_id: input.sourceId,
              variance_direction: 'increase',
            },
            quantity: variance,
            sourceLocation: adjustmentSource,
            destinationLocation: input.location,
            unitCost: Number(line.unitCost || 0),
          };
        }

        return {
          allowNegativeOverride: false,
          itemName: line.itemName,
          itemSku: line.itemSku,
          metadata: {
            ...(line.metadata || {}),
            stocktake_scope: input.scope,
            stocktake_source_id: input.sourceId,
            variance_direction: 'decrease',
          },
          quantity: Math.abs(variance),
          sourceLocation: input.location,
          destinationLocation: adjustmentSink,
          unitCost: Number(line.unitCost || 0),
        };
      })
      .filter((line): line is NonNullable<typeof line> => Boolean(line));

    if (!postingLines.length) return null;

    return InventoryPostingService.postDocument({
      actorId: input.actorId,
      branchId: input.branchId,
      businessDate: input.stocktakeDate,
      documentDate: input.stocktakeDate,
      documentType: 'STK',
      idempotencyKey: input.idempotencyKey,
      lines: postingLines,
      metadata: {
        ...(input.metadata || {}),
        stocktake_scope: input.scope,
        stocktake_source_id: input.sourceId,
      },
      reason: input.documentReason,
      sourceId: input.sourceId,
      sourceTable: input.sourceTable,
    });
  }
}
