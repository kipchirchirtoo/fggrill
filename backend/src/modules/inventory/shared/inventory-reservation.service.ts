import { PoolClient } from 'pg';
import { InventoryDocumentService } from '../documents/inventory-document.service';

export class InventoryReservationService {
  static async createReservation(
    client: PoolClient,
    input: {
      actorId: string;
      documentNumber?: string | null;
      itemId: string;
      locationId: string;
      quantity: number;
      reason: string;
      sourceDocumentReference: string;
      sourceDocumentType: string;
    },
  ) {
    const reservationNumber = await InventoryDocumentService.nextMovementNumber(client, 'RSV');
    const result = await client.query<{ id: string }>(
      `
        INSERT INTO inventory_reservations (
          reservation_number,
          item_id,
          location_id,
          quantity,
          source_document_type,
          source_document_reference,
          source_document_number,
          reason,
          reserved_by
        )
        VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9::uuid)
        RETURNING id
      `,
      [
        reservationNumber,
        input.itemId,
        input.locationId,
        input.quantity,
        input.sourceDocumentType,
        input.sourceDocumentReference,
        input.documentNumber ?? null,
        input.reason,
        input.actorId,
      ],
    );
    return result.rows[0]?.id || null;
  }
}
