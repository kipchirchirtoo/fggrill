import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase';

// Shared helpers for reading POS terminal (device/branch) context and the
// branch-scoped-PIN feature flag. Kept in utils so both the auth controller
// (login) and the user controller (PIN assignment) can use them without
// importing the terminal controller (avoids a circular dependency).

const jwtSecret = (): string =>
  process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'fallback-secret-key';

/**
 * Master switch for branch-scoped POS PINs. OFF by default (grandfather mode):
 * PIN assignment stays globally unique and branch-blind login is still safe.
 * When ON, the same PIN may exist in different branches, and a POS login MUST
 * carry a registered terminal's device token so the branch is unambiguous.
 * Set POS_BRANCH_SCOPED_PINS=true|1|on|all to enable.
 */
export const isBranchScopedPinsEnabled = (): boolean => {
  const v = String(process.env.POS_BRANCH_SCOPED_PINS || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'on' || v === 'all';
};

export interface PosTerminalContext {
  terminalId: string;
  branchId: number;
  terminalType: string;
}

export const readPosTerminalToken = (req: Request): string | null => {
  const header = req.headers['x-pos-terminal-token'];
  const token = Array.isArray(header) ? header[0] : header;
  const trimmed = String(token || '').trim();
  return trimmed && trimmed.toLowerCase() !== 'null' ? trimmed : null;
};

const decodePosTerminalToken = (token: string): PosTerminalContext | null => {
  try {
    const decoded: any = jwt.verify(token, jwtSecret());
    if (decoded?.kind !== 'pos_terminal' || !decoded?.terminal_id || !decoded?.branch_id) return null;
    return {
      terminalId: String(decoded.terminal_id),
      branchId: Number(decoded.branch_id),
      terminalType: String(decoded.terminal_type || ''),
    };
  } catch {
    return null;
  }
};

/**
 * Verifies the device token AND that the terminal is still active (not
 * revoked/suspended). The branch is taken from the DB row, never trusted from
 * the token alone. Returns null when there is no valid, active terminal.
 */
export const resolvePosTerminalContext = async (req: Request): Promise<PosTerminalContext | null> => {
  const token = readPosTerminalToken(req);
  if (!token) return null;
  const ctx = decodePosTerminalToken(token);
  if (!ctx) return null;

  const { data } = await supabase
    .from('pos_terminals')
    .select('id, branch_id, status, terminal_type')
    .eq('id', ctx.terminalId)
    .maybeSingle();
  if (!data || data.status !== 'active') return null;

  return {
    terminalId: ctx.terminalId,
    branchId: Number(data.branch_id),
    terminalType: String(data.terminal_type || ctx.terminalType),
  };
};
