import crypto from 'crypto';
import { PoolClient } from 'pg';
import { InventoryPostingDocumentType } from '../shared/inventory-posting.types';

type CreateDocumentInput = {
  actorId: string;
  branchId?: number | null;
  documentDate?: string | null;
  documentType: InventoryPostingDocumentType;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  reason: string;
  reversalOfDocumentId?: string | null;
  sourceId?: string | null;
  sourceTable: string;
};

const yearFor = (documentDate?: string | null): number => {
  const raw = documentDate ? new Date(documentDate) : new Date();
  return Number.isNaN(raw.getTime()) ? new Date().getUTCFullYear() : raw.getUTCFullYear();
};

const branchToken = (code?: string | null, branchId?: number | null): string => {
  const text = String(code || '').trim().toUpperCase();
  if (text) return text.replace(/[^A-Z0-9]+/g, '');
  if (branchId != null) return `B${branchId}`;
  return 'SYS';
};

export class InventoryDocumentService {
  static async createDocument(client: PoolClient, input: CreateDocumentInput) {
    const branch = input.branchId == null
      ? null
      : await client.query<{ code: string | null }>(
          'SELECT code FROM branches WHERE id = $1',
          [input.branchId],
        );
    const branchCode = branchToken(branch?.rows?.[0]?.code, input.branchId ?? null);
    const number = await this.nextDocumentNumber(
      client,
      input.documentType,
      branchCode,
      yearFor(input.documentDate),
    );

    const sourceId = input.sourceId || crypto.randomUUID();
    const insert = await client.query<{
      id: string;
      document_number: string;
      posted_at: string;
      posting_status: 'posted' | 'reversed';
      reversal_of_document_id: string | null;
    }>(
      `
        INSERT INTO inventory_documents (
          document_type,
          document_number,
          source_table,
          source_id,
          branch_id,
          status,
          generated_by,
          generated_at,
          metadata,
          posting_status,
          posted_at,
          posted_by,
          document_date,
          reversal_of_document_id,
          idempotency_key,
          posting_reason,
          is_immutable
        )
        VALUES (
          $1,
          $2,
          $3,
          $4::uuid,
          $5,
          'generated',
          $6::uuid,
          NOW(),
          $7::jsonb,
          $8,
          NOW(),
          $6::uuid,
          COALESCE($9::date, CURRENT_DATE),
          $10::uuid,
          $11,
          $12,
          TRUE
        )
        RETURNING id, document_number, posted_at, posting_status, reversal_of_document_id
      `,
      [
        input.documentType,
        number,
        input.sourceTable,
        sourceId,
        input.branchId ?? null,
        input.actorId,
        JSON.stringify(input.metadata || {}),
        input.documentType === 'REV' ? 'reversed' : 'posted',
        input.documentDate ?? null,
        input.reversalOfDocumentId ?? null,
        input.idempotencyKey,
        input.reason,
      ],
    );

    return insert.rows[0];
  }

  static async createDocumentLine(
    client: PoolClient,
    input: {
      destinationLocationId: string;
      documentId: string;
      itemId: string;
      lineNumber: number;
      metadata?: Record<string, unknown>;
      quantity: number;
      sourceLocationId: string;
      unitCost: number;
    },
  ) {
    const result = await client.query<{ id: string }>(
      `
        INSERT INTO inventory_document_lines (
          document_id,
          line_number,
          item_id,
          source_location_id,
          destination_location_id,
          quantity,
          unit_cost,
          metadata
        )
        VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5::uuid, $6, $7, $8::jsonb)
        RETURNING id
      `,
      [
        input.documentId,
        input.lineNumber,
        input.itemId,
        input.sourceLocationId,
        input.destinationLocationId,
        input.quantity,
        input.unitCost,
        JSON.stringify(input.metadata || {}),
      ],
    );
    return result.rows[0]?.id || null;
  }

  static async nextMovementNumber(client: PoolClient, branchCode?: string | null) {
    return this.nextSequenceNumber(client, `MOV:${branchToken(branchCode, null)}`, `MOV-${branchToken(branchCode, null)}`);
  }

  private static async nextDocumentNumber(
    client: PoolClient,
    documentType: InventoryPostingDocumentType,
    branchCode: string,
    year: number,
  ): Promise<string> {
    const sequence = await this.incrementSequence(client, `${documentType}:${branchCode}`, year);
    return `${documentType}-${branchCode}-${year}-${String(sequence).padStart(6, '0')}`;
  }

  private static async nextSequenceNumber(client: PoolClient, key: string, prefix: string): Promise<string> {
    const year = new Date().getUTCFullYear();
    const sequence = await this.incrementSequence(client, key, year);
    return `${prefix}-${year}-${String(sequence).padStart(6, '0')}`;
  }

  private static async incrementSequence(client: PoolClient, sequenceKey: string, sequenceYear: number): Promise<number> {
    const result = await client.query<{ last_number: number }>(
      `
        INSERT INTO inventory_number_sequences (sequence_key, sequence_year, last_number)
        VALUES ($1, $2, 1)
        ON CONFLICT (sequence_key, sequence_year)
        DO UPDATE SET
          last_number = inventory_number_sequences.last_number + 1,
          updated_at = NOW()
        RETURNING last_number
      `,
      [sequenceKey, sequenceYear],
    );
    return Number(result.rows[0]?.last_number || 1);
  }
}
