import db from '../db';
import { logger } from '../utils/logger';

type SessionRegistration = {
  userId: string;
  sessionId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceInfo?: Record<string, any> | null;
  expiresAt?: string | null;
};

let sessionTableAvailable: boolean | null = null;

const isMissingRelationError = (error: unknown): boolean => {
  const code = (error as any)?.code;
  return code === '42P01';
};

async function ensureSessionTable(): Promise<boolean> {
  if (sessionTableAvailable !== null) return sessionTableAvailable;
  try {
    await db.query('SELECT 1 FROM active_sessions LIMIT 1');
    sessionTableAvailable = true;
  } catch (error) {
    if (isMissingRelationError(error)) {
      sessionTableAvailable = false;
      logger.warn('active_sessions table not available yet; session registry running in compatibility mode');
      return false;
    }
    throw error;
  }
  return true;
}

export async function registerManagedSession(input: SessionRegistration): Promise<void> {
  if (!(await ensureSessionTable())) return;

  await db.query(
    `
      INSERT INTO active_sessions (
        user_id,
        session_token,
        ip_address,
        user_agent,
        device_info,
        expires_at,
        last_activity,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz, NOW(), TRUE)
      ON CONFLICT (session_token)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        ip_address = EXCLUDED.ip_address,
        user_agent = EXCLUDED.user_agent,
        device_info = EXCLUDED.device_info,
        expires_at = EXCLUDED.expires_at,
        last_activity = NOW(),
        is_active = TRUE
    `,
    [
      input.userId,
      input.sessionId,
      input.ipAddress ?? null,
      input.userAgent ?? null,
      JSON.stringify(input.deviceInfo || {}),
      input.expiresAt ?? null
    ]
  );
}

export async function revokeManagedSession(sessionId: string | null | undefined): Promise<void> {
  if (!sessionId || !(await ensureSessionTable())) return;

  await db.query(
    `
      UPDATE active_sessions
      SET is_active = FALSE, last_activity = NOW()
      WHERE session_token = $1
    `,
    [sessionId]
  );
}

export async function isManagedSessionActive(sessionId: string, userId: string): Promise<boolean | null> {
  if (!(await ensureSessionTable())) return null;

  const result = await db.query(
    `
      SELECT is_active, expires_at
      FROM active_sessions
      WHERE session_token = $1
        AND user_id = $2
      LIMIT 1
    `,
    [sessionId, userId]
  );

  const row = result.rows[0];
  if (!row) return false;
  if (row.is_active !== true) return false;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return false;
  return true;
}

export async function touchManagedSession(sessionId: string | null | undefined): Promise<void> {
  if (!sessionId || !(await ensureSessionTable())) return;

  await db.query(
    `
      UPDATE active_sessions
      SET last_activity = NOW()
      WHERE session_token = $1
        AND is_active = TRUE
    `,
    [sessionId]
  );
}
