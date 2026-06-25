import crypto from 'crypto';
import db from '../db';
import { logger } from '../utils/logger';

type BeginRequestInput = {
  branchId?: number | null;
  deviceId?: string | null;
  idempotencyKey: string;
  method: string;
  path: string;
  requestBody: unknown;
  scope: string;
  userId?: string | null;
};

type BeginRequestResult =
  | { mode: 'disabled' }
  | { mode: 'replay'; responseStatus: number; responseBody: any }
  | { mode: 'acquired'; rowId: string };

let tableAvailable: boolean | null = null;

const MISSING_RELATION = '42P01';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
  return `{${entries.join(',')}}`;
}

function digestRequest(input: Omit<BeginRequestInput, 'idempotencyKey' | 'scope'>): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        branchId: input.branchId ?? null,
        method: input.method.toUpperCase(),
        path: input.path,
        requestBody: stableStringify(input.requestBody),
        userId: input.userId ?? null
      })
    )
    .digest('hex');
}

async function ensureTable(): Promise<boolean> {
  if (tableAvailable !== null) return tableAvailable;
  try {
    await db.query('SELECT 1 FROM request_idempotency_keys LIMIT 1');
    tableAvailable = true;
  } catch (error: any) {
    if (error?.code === MISSING_RELATION) {
      tableAvailable = false;
      logger.warn('request_idempotency_keys table not available yet; idempotency middleware running in compatibility mode');
      return false;
    }
    throw error;
  }
  return true;
}

export async function beginIdempotentRequest(input: BeginRequestInput): Promise<BeginRequestResult> {
  if (!(await ensureTable())) {
    return { mode: 'disabled' };
  }

  const requestHash = digestRequest(input);
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    const insertResult = await client.query(
      `
        INSERT INTO request_idempotency_keys (
          request_scope,
          idempotency_key,
          request_method,
          request_path,
          request_hash,
          user_id,
          branch_id,
          device_id,
          status,
          locked_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::uuid, $7, $8, 'processing', NOW())
        ON CONFLICT (request_scope, idempotency_key) DO NOTHING
      `,
      [
        input.scope,
        input.idempotencyKey,
        input.method.toUpperCase(),
        input.path,
        requestHash,
        input.userId ?? null,
        input.branchId ?? null,
        input.deviceId ?? null
      ]
    );

    const result = await client.query(
      `
        SELECT *
        FROM request_idempotency_keys
        WHERE request_scope = $1
          AND idempotency_key = $2
        FOR UPDATE
      `,
      [input.scope, input.idempotencyKey]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to claim idempotency key');
    }

    if (row.request_hash !== requestHash) {
      throw Object.assign(new Error('Idempotency key was reused with a different payload'), { statusCode: 409 });
    }

    if (row.status === 'completed' && row.response_status && row.response_body) {
      await client.query('COMMIT');
      return {
        mode: 'replay',
        responseStatus: Number(row.response_status),
        responseBody: row.response_body
      };
    }

    const insertedNow = (insertResult.rowCount ?? 0) > 0;

    if (!insertedNow && row.status === 'processing' && row.locked_at) {
      const lockAgeMs = Date.now() - new Date(row.locked_at).getTime();
      if (lockAgeMs < 2 * 60 * 1000) {
        throw Object.assign(new Error('A matching request is already being processed'), { statusCode: 409 });
      }
    }

    await client.query(
      `
        UPDATE request_idempotency_keys
        SET
          request_method = $3,
          request_path = $4,
          request_hash = $5,
          user_id = $6::uuid,
          branch_id = $7,
          device_id = $8,
          status = 'processing',
          locked_at = NOW(),
          last_error = NULL
        WHERE id = $1
      `,
      [
        row.id,
        input.idempotencyKey,
        input.method.toUpperCase(),
        input.path,
        requestHash,
        input.userId ?? null,
        input.branchId ?? null,
        input.deviceId ?? null
      ]
    );

    await client.query('COMMIT');
    return { mode: 'acquired', rowId: row.id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function finalizeIdempotentRequest(input: {
  resourceId?: string | null;
  resourceType?: string | null;
  responseBody: any;
  responseStatus: number;
  rowId: string;
}): Promise<void> {
  if (!(await ensureTable())) return;

  await db.query(
    `
      UPDATE request_idempotency_keys
      SET
        status = 'completed',
        response_status = $2,
        response_body = $3::jsonb,
        resource_type = $4,
        resource_id = $5,
        finalized_at = NOW(),
        locked_at = NULL,
        expires_at = NOW() + INTERVAL '7 days'
      WHERE id = $1
    `,
    [
      input.rowId,
      input.responseStatus,
      JSON.stringify(input.responseBody ?? null),
      input.resourceType ?? null,
      input.resourceId ?? null
    ]
  );
}

export async function failIdempotentRequest(rowId: string, errorMessage: string): Promise<void> {
  if (!(await ensureTable())) return;

  await db.query(
    `
      UPDATE request_idempotency_keys
      SET
        status = 'failed',
        last_error = $2,
        locked_at = NULL,
        finalized_at = NOW()
      WHERE id = $1
    `,
    [rowId, errorMessage.slice(0, 1000)]
  );
}
