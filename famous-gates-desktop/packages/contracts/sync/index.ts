// ── Sync Mutation Envelopes ───────────────────────────────────────────────────

export type SyncOperation = 'create' | 'update' | 'delete';

export interface MutationEnvelope {
  id: string;
  entity: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  idempotency_key: string;
  client_timestamp: string;
}

export interface SyncAck {
  id: string;
  status: 'accepted' | 'rejected' | 'conflict';
  server_id?: string;
  conflict_data?: Record<string, unknown>;
  error?: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';
