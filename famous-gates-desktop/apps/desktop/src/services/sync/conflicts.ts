// Conflict resolution — detects and resolves local vs remote divergence

import { sqlExecute, sqlQuery } from '../local/sqlite';
import { v4 as uuidv4 } from 'uuid';

export type Resolution = 'LOCAL_WINS' | 'REMOTE_WINS' | 'MERGED';

export interface ConflictRecord {
  id: string;
  entity: string;
  outbox_id: string | null;
  local_payload: string;
  remote_payload: string;
  detected_at: number;
  resolved: boolean;
  resolution: Resolution | null;
}

export async function recordConflict(
  entity: string,
  outboxId: string | null,
  localPayload: unknown,
  remotePayload: unknown
): Promise<string> {
  const id = uuidv4();
  await sqlExecute(
    `INSERT INTO conflict_log (id, entity, outbox_id, local_payload, remote_payload)
     VALUES (?, ?, ?, ?, ?)`,
    [id, entity, outboxId, JSON.stringify(localPayload), JSON.stringify(remotePayload)]
  );
  return id;
}

export async function resolveConflict(id: string, resolution: Resolution): Promise<void> {
  await sqlExecute(
    `UPDATE conflict_log SET resolved = 1, resolution = ? WHERE id = ?`,
    [resolution, id]
  );
}

export async function getUnresolvedConflicts(): Promise<ConflictRecord[]> {
  return sqlQuery<ConflictRecord>(
    `SELECT * FROM conflict_log WHERE resolved = 0 ORDER BY detected_at DESC`
  );
}

/**
 * Default strategy: remote wins for most entities.
 * Override per-entity as needed.
 */
export function defaultResolutionStrategy(_entity: string): Resolution {
  return 'REMOTE_WINS';
}
