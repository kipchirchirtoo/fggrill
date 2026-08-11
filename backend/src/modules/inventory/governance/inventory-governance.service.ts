import { PoolClient } from 'pg';
import { logger } from '../../../utils/logger';

export class InventoryGovernanceService {
  static async createException(
    client: PoolClient,
    input: {
      actorId?: string | null;
      branchId?: number | null;
      code: string;
      details?: Record<string, unknown>;
      documentId?: string | null;
      message: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
    },
  ) {
    try {
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO inventory_governance_exceptions (
            branch_id,
            document_id,
            exception_code,
            severity,
            status,
            message,
            metadata,
            created_by
          )
          VALUES ($1, $2::uuid, $3, $4, 'open', $5, $6::jsonb, $7::uuid)
          RETURNING id
        `,
        [
          input.branchId ?? null,
          input.documentId ?? null,
          input.code,
          input.severity || 'high',
          input.message,
          JSON.stringify(input.details || {}),
          input.actorId ?? null,
        ],
      );
      return result.rows[0]?.id || null;
    } catch (err: any) {
      if (err?.code === '42P01') {
        logger.warn(`inventory_governance_exceptions table missing: ${err.message}`);
        return null;
      }
      throw err;
    }
  }

  static async assertPeriodOpen(
    client: PoolClient,
    input: {
      branchId?: number | null;
      businessDate?: string | null;
      shiftCode?: string | null;
    },
  ) {
    if (input.branchId == null) return;
    try {
      const result = await client.query(
        `
          SELECT id, lock_scope
          FROM inventory_period_locks
          WHERE branch_id = $1
            AND is_active = TRUE
            AND (
              (lock_scope = 'business_date' AND business_date = COALESCE($2::date, CURRENT_DATE))
              OR (lock_scope = 'shift' AND shift_code = $3)
              OR (lock_scope = 'accounting_period' AND COALESCE($2::date, CURRENT_DATE) BETWEEN period_start AND period_end)
            )
          LIMIT 1
        `,
        [input.branchId, input.businessDate ?? null, input.shiftCode ?? null],
      );

      if (!result.rowCount) return;
      const scope = String(result.rows[0].lock_scope || '');
      if (scope === 'shift') {
        const error: any = new Error('Inventory posting is blocked because the shift is closed');
        error.statusCode = 409;
        error.code = 'SHIFT_CLOSED';
        throw error;
      }
      const error: any = new Error('Inventory posting is blocked because the period is closed');
      error.statusCode = 409;
      error.code = 'PERIOD_CLOSED';
      throw error;
    } catch (err: any) {
      if (err?.code === '42P01') {
        logger.warn(`inventory_period_locks table missing: ${err.message}`);
        return;
      }
      throw err;
    }
  }
}
