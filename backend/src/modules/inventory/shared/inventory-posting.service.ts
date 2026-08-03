import crypto from 'crypto';
import { PoolClient } from 'pg';
import db from '../../../db';
import { InventoryBalanceService } from '../balances/inventory-balance.service';
import { InventoryDocumentService } from '../documents/inventory-document.service';
import { InventoryGovernanceService } from '../governance/inventory-governance.service';
import {
  InventoryPostingInput,
  InventoryPostingLineInput,
  InventoryPostingMovementType,
  InventoryPostingResult,
} from './inventory-posting.types';
import { InventoryReservationService } from './inventory-reservation.service';

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(',')}}`;
};

const requestHash = (input: InventoryPostingInput): string =>
  crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        actorId: input.actorId,
        branchId: input.branchId ?? null,
        documentType: input.documentType,
        lines: stableStringify(input.lines),
        reason: input.reason,
        sourceId: input.sourceId ?? null,
        sourceTable: input.sourceTable,
      }),
    )
    .digest('hex');

const toMovementType = (
  documentType: InventoryPostingInput['documentType'],
  line: InventoryPostingLineInput,
): InventoryPostingMovementType => {
  if (line.movementType) return line.movementType;
  switch (documentType) {
    case 'GRN':
      return 'grn_posting';
    case 'MIN':
      return 'department_issue';
    case 'TRF':
      return 'transfer';
    case 'STK':
    case 'ADJ':
      return 'stock_take_adjustment';
    case 'SPL':
      return 'write_off';
    case 'REV':
      return 'return';
    case 'REQ':
    default:
      return 'reservation';
  }
};

const trackSource = (locationType: string) => InventoryBalanceService.tracksBalance(locationType);
const trackDestination = (locationType: string) => InventoryBalanceService.tracksBalance(locationType);

export class InventoryPostingService {
  static async postDocument(input: InventoryPostingInput): Promise<InventoryPostingResult> {
    if (!input.idempotencyKey?.trim()) {
      const error: any = new Error('Idempotency-Key header is required');
      error.statusCode = 400;
      error.code = 'IDEMPOTENCY_KEY_REQUIRED';
      throw error;
    }

    if (!input.lines?.length) {
      const error: any = new Error('At least one posting line is required');
      error.statusCode = 400;
      error.code = 'INVALID_DOCUMENT_LINES';
      throw error;
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await InventoryGovernanceService.assertPeriodOpen(client, {
        branchId: input.branchId ?? null,
        businessDate: input.businessDate ?? input.documentDate ?? null,
        shiftCode: input.shiftCode ?? null,
      });

      const replay = await this.beginIdempotentPosting(client, input);
      if (replay) {
        await client.query('COMMIT');
        return {
          ...replay,
          idempotentReplay: true,
        };
      }

      const document = await InventoryDocumentService.createDocument(client, {
        actorId: input.actorId,
        branchId: input.branchId ?? null,
        documentDate: input.documentDate ?? null,
        documentType: input.documentType,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata,
        reason: input.reason,
        sourceId: input.sourceId ?? null,
        sourceTable: input.sourceTable,
      });

      const postedLines: InventoryPostingResult['lines'] = [];
      let lineNumber = 1;
      for (const line of input.lines) {
        const item = await InventoryBalanceService.ensureCatalogItem(client, {
          itemSku: line.itemSku,
          itemName: line.itemName,
          unitCost: line.unitCost ?? 0,
        });
        const sourceLocation = await InventoryBalanceService.ensureLocation(client, line.sourceLocation);
        const destinationLocation = await InventoryBalanceService.ensureLocation(client, line.destinationLocation);

        if (trackSource(line.sourceLocation.locationType)) {
          await InventoryBalanceService.assertAvailability(client, {
            itemId: item.id,
            locationId: sourceLocation.id,
            quantity: Number(line.quantity || 0),
            allowOverride: !!line.allowNegativeOverride,
          });
        }

        const documentLineId = await InventoryDocumentService.createDocumentLine(client, {
          documentId: document.id,
          destinationLocationId: destinationLocation.id,
          itemId: item.id,
          lineNumber,
          metadata: {
            ...(line.metadata || {}),
            movement_type: toMovementType(input.documentType, line),
          },
          quantity: Number(line.quantity || 0),
          sourceLocationId: sourceLocation.id,
          unitCost: Number(line.unitCost || 0),
        });

        const movementNumber = await InventoryDocumentService.nextMovementNumber(client, null);
        const sourceBefore = trackSource(line.sourceLocation.locationType)
          ? await InventoryBalanceService.lockBalance(client, item.id, sourceLocation.id)
          : null;
        const destinationBefore = trackDestination(line.destinationLocation.locationType)
          ? await InventoryBalanceService.lockBalance(client, item.id, destinationLocation.id)
          : null;

        const movementInsert = await client.query<{ id: string }>(
          `
            INSERT INTO inventory_movements (
              movement_number,
              movement_type,
              item_id,
              source_location_id,
              destination_location_id,
              quantity,
              unit_cost,
              reason,
              document_type,
              document_reference,
              document_number,
              actor_id,
              reversible,
              metadata
            )
            VALUES (
              $1,
              $2,
              $3::uuid,
              $4::uuid,
              $5::uuid,
              $6,
              $7,
              $8,
              $9,
              $10,
              $11,
              $12::uuid,
              $13,
              $14::jsonb
            )
            RETURNING id
          `,
          [
            movementNumber,
            toMovementType(input.documentType, line),
            item.id,
            sourceLocation.id,
            destinationLocation.id,
            Number(line.quantity || 0),
            Number(line.unitCost || 0),
            input.reason,
            input.documentType,
            document.id,
            document.document_number,
            input.actorId,
            input.documentType !== 'REQ',
            JSON.stringify({
              ...(input.metadata || {}),
              ...(line.metadata || {}),
              document_line_id: documentLineId,
            }),
          ],
        );

        const movementId = movementInsert.rows[0].id;
        let sourceAfter = sourceBefore ? Number(sourceBefore.current_quantity || 0) : null;
        let destinationAfter = destinationBefore ? Number(destinationBefore.current_quantity || 0) : null;

        if (trackSource(line.sourceLocation.locationType)) {
          const sourceUpdate = await InventoryBalanceService.applyBalanceDelta(client, {
            itemId: item.id,
            locationId: sourceLocation.id,
            deltaCurrent: -Number(line.quantity || 0),
            lastMovementId: movementId,
            unitCost: Number(line.unitCost || 0),
          });
          sourceAfter = sourceUpdate.after;
        }

        if (trackDestination(line.destinationLocation.locationType)) {
          const destinationUpdate = await InventoryBalanceService.applyBalanceDelta(client, {
            itemId: item.id,
            locationId: destinationLocation.id,
            deltaCurrent: Number(line.quantity || 0),
            lastMovementId: movementId,
            unitCost: Number(line.unitCost || 0),
          });
          destinationAfter = destinationUpdate.after;
        }

        if (line.allowNegativeOverride) {
          await InventoryGovernanceService.createException(client, {
            actorId: input.actorId,
            branchId: input.branchId ?? null,
            code: 'NEGATIVE_OVERRIDE_USED',
            details: {
              item_sku: line.itemSku,
              quantity: line.quantity,
              source_location_code: sourceLocation.locationCode,
            },
            documentId: document.id,
            message: 'Negative stock override was used during inventory posting',
            severity: 'critical',
          });
        }

        if (line.reservation?.action === 'reserve') {
          await InventoryReservationService.createReservation(client, {
            actorId: input.actorId,
            documentNumber: document.document_number,
            itemId: item.id,
            locationId: sourceLocation.id,
            quantity: Number(line.reservation.quantity ?? line.quantity),
            reason: line.reservation.reason || input.reason,
            sourceDocumentReference: document.id,
            sourceDocumentType: input.documentType,
          });
          await InventoryBalanceService.applyBalanceDelta(client, {
            itemId: item.id,
            locationId: sourceLocation.id,
            deltaCurrent: 0,
            deltaReserved: Number(line.reservation.quantity ?? line.quantity),
          });
        }

        if (line.sourceLocation.locationType === 'branch_store') {
          await InventoryBalanceService.writeBranchStockProjection(client, {
            branchId: line.sourceLocation.branchId ?? input.branchId ?? null,
            deltaQuantity: -Number(line.quantity || 0),
            itemName: line.itemName,
            itemSku: line.itemSku,
            referenceId: document.id,
            referenceNumber: document.document_number,
            referenceType: input.documentType,
            userId: input.actorId,
          });
        }

        if (line.destinationLocation.locationType === 'branch_store') {
          await InventoryBalanceService.writeBranchStockProjection(client, {
            branchId: line.destinationLocation.branchId ?? input.branchId ?? null,
            deltaQuantity: Number(line.quantity || 0),
            itemName: line.itemName,
            itemSku: line.itemSku,
            referenceId: document.id,
            referenceNumber: document.document_number,
            referenceType: input.documentType,
            userId: input.actorId,
          });
        }

        await client.query(
          `
            INSERT INTO inventory_audit_logs (
              branch_id,
              actor_id,
              action_type,
              entity_type,
              entity_id,
              item_id,
              location_id,
              before_value,
              after_value,
              reason,
              source_document_type,
              source_document_reference,
              metadata
            )
            VALUES (
              $1,
              $2::uuid,
              'inventory_posted',
              'inventory_documents',
              $3,
              $4::uuid,
              $5::uuid,
              $6::jsonb,
              $7::jsonb,
              $8,
              $9,
              $10,
              $11::jsonb
            )
          `,
          [
            input.branchId ?? null,
            input.actorId,
            document.id,
            item.id,
            destinationLocation.id,
            JSON.stringify({
              source_quantity: Number(sourceBefore?.current_quantity || 0),
              destination_quantity: Number(destinationBefore?.current_quantity || 0),
            }),
            JSON.stringify({
              source_quantity: sourceAfter,
              destination_quantity: destinationAfter,
            }),
            input.reason,
            input.documentType,
            document.id,
            JSON.stringify({
              item_sku: line.itemSku,
              document_number: document.document_number,
              movement_id: movementId,
            }),
          ],
        );

        postedLines.push({
          item_sku: line.itemSku,
          movement_id: movementId,
          previous_source_quantity: sourceBefore ? Number(sourceBefore.current_quantity || 0) : null,
          new_source_quantity: sourceAfter,
          previous_destination_quantity: destinationBefore ? Number(destinationBefore.current_quantity || 0) : null,
          new_destination_quantity: destinationAfter,
          quantity: Number(line.quantity || 0),
        });
        lineNumber += 1;
      }

      const result: InventoryPostingResult = {
        document: {
          document_id: document.id,
          document_number: document.document_number,
          document_type: input.documentType,
          posted_at: document.posted_at,
          posting_status: document.posting_status,
          reversal_of_document_id: document.reversal_of_document_id,
        },
        lines: postedLines,
      };

      await client.query(
        `
          UPDATE inventory_idempotency_keys
          SET
            status = 'completed',
            response_payload = $2::jsonb,
            document_id = $3::uuid,
            finalized_at = NOW(),
            locked_at = NULL
          WHERE scope = 'inventory_posting'
            AND idempotency_key = $1
        `,
        [input.idempotencyKey, JSON.stringify(result), document.id],
      );

      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private static async beginIdempotentPosting(
    client: PoolClient,
    input: InventoryPostingInput,
  ): Promise<InventoryPostingResult | null> {
    const hash = requestHash(input);
    await client.query(
      `
        INSERT INTO inventory_idempotency_keys (
          scope,
          idempotency_key,
          request_hash,
          branch_id,
          actor_id,
          status,
          locked_at
        )
        VALUES ('inventory_posting', $1, $2, $3, $4::uuid, 'processing', NOW())
        ON CONFLICT (scope, idempotency_key) DO NOTHING
      `,
      [input.idempotencyKey, hash, input.branchId ?? null, input.actorId],
    );

    const existing = await client.query<{
      request_hash: string;
      response_payload: InventoryPostingResult | null;
      status: string;
    }>(
      `
        SELECT request_hash, response_payload, status
        FROM inventory_idempotency_keys
        WHERE scope = 'inventory_posting'
          AND idempotency_key = $1
        FOR UPDATE
      `,
      [input.idempotencyKey],
    );

    const row = existing.rows[0];
    if (!row) return null;
    if (row.request_hash !== hash) {
      const error: any = new Error('Idempotency key was reused with a different payload');
      error.statusCode = 409;
      error.code = 'IDEMPOTENT_REPLAY';
      throw error;
    }
    if (row.status === 'completed' && row.response_payload) {
      return row.response_payload;
    }
    return null;
  }
}
