// Outbox sync — reads pending mutations and replays them against the Node API

import { nodeClient } from '../api/nodeClient';
import {
  getPendingOutbox,
  markOutboxSynced,
  markOutboxFailed,
  OutboxEntry,
} from '../local/sqlite';

export interface SyncReport {
  synced: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export async function replayOutbox(): Promise<SyncReport> {
  const pending = await getPendingOutbox();
  const report: SyncReport = { synced: 0, failed: 0, skipped: 0, errors: [] };

  for (const entry of pending) {
    try {
      const payload = JSON.parse(entry.payload);
      await callEndpoint(entry.method, entry.endpoint, payload);
      await markOutboxSynced(entry.id);
      report.synced++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await markOutboxFailed(entry.id, msg, entry.retry_count + 1);
      report.failed++;
      report.errors.push(`[${entry.entity}] ${msg}`);
    }
  }

  return report;
}

async function callEndpoint(method: string, endpoint: string, payload: unknown): Promise<unknown> {
  switch (method.toUpperCase()) {
    case 'POST':   return nodeClient.post(endpoint, payload);
    case 'PUT':    return nodeClient.put(endpoint, payload);
    case 'PATCH':  return nodeClient.patch(endpoint, payload);
    case 'DELETE': return nodeClient.delete(endpoint);
    default:       return nodeClient.post(endpoint, payload);
  }
}
