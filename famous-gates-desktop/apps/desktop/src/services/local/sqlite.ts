// Local SQLite access layer — wraps tauri-plugin-sql for the frontend

import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:famous_gates.db');
  }
  return db;
}

// ── Generic helpers ───────────────────────────────────────────────────────────

export async function sqlQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const conn = await getDb();
  return conn.select<T[]>(sql, params);
}

export async function sqlExecute(sql: string, params: unknown[] = []): Promise<void> {
  const conn = await getDb();
  await conn.execute(sql, params);
}

// ── Outbox helpers ────────────────────────────────────────────────────────────

export interface OutboxEntry {
  id: string;
  entity: string;
  operation: string;
  endpoint: string;
  method: string;
  payload: string;
  status: string;
  retry_count: number;
  last_error: string | null;
  created_at: number;
}

export async function addToOutbox(entry: Omit<OutboxEntry, 'retry_count' | 'last_error' | 'created_at' | 'status'>): Promise<void> {
  await sqlExecute(
    `INSERT INTO outbox (id, entity, operation, endpoint, method, payload, status)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
    [entry.id, entry.entity, entry.operation, entry.endpoint, entry.method, entry.payload]
  );
}

export async function getPendingOutbox(): Promise<OutboxEntry[]> {
  return sqlQuery<OutboxEntry>(
    `SELECT * FROM outbox WHERE status IN ('PENDING', 'RETRYING') ORDER BY created_at ASC`
  );
}

export async function markOutboxSynced(id: string): Promise<void> {
  await sqlExecute(
    `UPDATE outbox SET status = 'SYNCED', synced_at = unixepoch() WHERE id = ?`,
    [id]
  );
}

export async function markOutboxFailed(id: string, error: string, retryCount: number): Promise<void> {
  const status = retryCount >= 5 ? 'FAILED' : 'RETRYING';
  await sqlExecute(
    `UPDATE outbox SET status = ?, retry_count = ?, last_error = ?, updated_at = unixepoch() WHERE id = ?`,
    [status, retryCount, error, id]
  );
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

export async function setCacheEntry(key: string, entity: string, value: string, ttlSeconds?: number): Promise<void> {
  const expiresAt = ttlSeconds ? Math.floor(Date.now() / 1000) + ttlSeconds : null;
  await sqlExecute(
    `INSERT INTO cache_metadata (key, entity, value, expires_at, fetched_at)
     VALUES (?, ?, ?, ?, unixepoch())
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at, fetched_at = unixepoch()`,
    [key, entity, value, expiresAt]
  );
}

export async function getCacheEntry(key: string): Promise<string | null> {
  const rows = await sqlQuery<{ value: string }>(
    `SELECT value FROM cache_metadata WHERE key = ? AND (expires_at IS NULL OR expires_at > unixepoch())`,
    [key]
  );
  return rows[0]?.value ?? null;
}
