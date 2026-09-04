import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// ------------------------------------------------------------------
// POS TERMINAL REGISTRATION
// A POS computer is registered (device-bound) to exactly ONE branch. The
// branch a terminal reports is server-authoritative: it is derived from the
// authenticated device, never trusted from the client. This is the foundation
// for branch-aware PIN login (same PIN allowed in different branches).
//
// Phase 0: admin creates terminals + one-time enrollment codes.
// Phase 1: the installer's device verifies a code, registers its Ed25519
//          public key, and authenticates with signed challenges.
// ------------------------------------------------------------------

const ENROLLMENT_TTL_MINUTES = 30;
const DEVICE_TOKEN_TTL_HOURS = 12;
const CHALLENGE_TTL_SECONDS = 120;
const MAX_ENROLLMENT_ATTEMPTS = 8;

const KNOWN_TERMINAL_TYPES = new Set([
  'cashier', 'restaurant', 'main_bar', 'executive_bar', 'non_consumables',
  'choma_zone', 'spa', 'sports_bar', 'reception', 'pool', 'carwash',
  'global',
]);

const jwtSecret = (): string =>
  process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'fallback-secret-key';

// Peppered HMAC so a DB leak never reveals enrollment codes, while lookup stays O(1).
const enrollmentPepper = (): string =>
  process.env.POS_ENROLLMENT_PEPPER || process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'fallback-pepper';

const hashCode = (code: string): string =>
  crypto.createHmac('sha256', enrollmentPepper()).update(code.trim()).digest('hex');

const generateNumericCode = (): string =>
  String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

const branchIdNum = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const userId = (req: Request): string | null => (req as any).user?.id || null;

// Reconstruct an Ed25519 public key from either a raw 32-byte base64 key or a
// full PEM/SPKI, so the Flutter side can send whichever is simplest for it.
const ed25519PublicKey = (value: string): crypto.KeyObject => {
  const raw = String(value || '').trim();
  if (raw.includes('BEGIN PUBLIC KEY')) {
    return crypto.createPublicKey(raw);
  }
  const keyBytes = Buffer.from(raw, 'base64');
  if (keyBytes.length !== 32) {
    throw new AppError('Invalid device public key (expected a 32-byte Ed25519 key or PEM)', 400);
  }
  // Ed25519 SPKI DER prefix + the 32-byte raw key.
  const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), keyBytes]);
  return crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
};

const verifyEd25519 = (publicKey: string, message: string, signatureB64: string): boolean => {
  try {
    return crypto.verify(null, Buffer.from(message), ed25519PublicKey(publicKey), Buffer.from(signatureB64, 'base64'));
  } catch (err) {
    logger.warn('Ed25519 verify failed', { error: (err as Error).message });
    return false;
  }
};

const normalizeTerminal = (row: any): Record<string, unknown> => ({
  id: String(row.id),
  terminalCode: row.terminal_code,
  branchId: row.branch_id ?? null,
  terminalName: row.terminal_name,
  terminalType: row.terminal_type,
  status: row.status,
  hasDevice: !!row.device_public_key,
  deviceFingerprint: row.device_fingerprint || null,
  deviceRegisteredAt: row.device_registered_at ?? null,
  lastSeenAt: row.last_seen_at ?? null,
  lastIp: row.last_ip || null,
  appVersion: row.app_version || null,
  osVersion: row.os_version || null,
  registeredBy: row.registered_by || null,
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
});

const generateTerminalCode = async (branchId: number): Promise<string> => {
  for (let i = 0; i < 6; i += 1) {
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
    const code = `FG-B${branchId}-${rand}`;
    const { data } = await supabase.from('pos_terminals').select('id').eq('terminal_code', code).maybeSingle();
    if (!data) return code;
  }
  return `FG-B${branchId}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
};

// Issues a fresh one-time enrollment code for a terminal, invalidating any
// prior unused ones. Returns the plaintext code (shown to the admin exactly once).
const issueEnrollmentCode = async (
  terminalId: string,
  branchId: number,
  createdBy: string | null
): Promise<{ code: string; expiresAt: string }> => {
  // Clear this terminal's old codes + globally expired ones (keeps the code
  // space sparse so the unique-hash index rarely collides).
  await supabase.from('pos_terminal_enrollments').delete().eq('terminal_id', terminalId).is('used_at', null);
  await supabase.from('pos_terminal_enrollments').delete().lt('expires_at', new Date(Date.now() - 86400000).toISOString());

  const expiresAt = new Date(Date.now() + ENROLLMENT_TTL_MINUTES * 60 * 1000).toISOString();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateNumericCode();
    const { error } = await supabase.from('pos_terminal_enrollments').insert({
      terminal_id: terminalId,
      branch_id: branchId,
      enrollment_code_hash: hashCode(code),
      code_hint: `••${code.slice(-2)}`,
      expires_at: expiresAt,
      created_by: createdBy,
    });
    if (!error) return { code, expiresAt };
    if (error.code !== '23505') throw new AppError(error.message, 500); // not a hash collision
  }
  throw new AppError('Could not generate a unique enrollment code, please retry', 500);
};

// ================================================================
// PHASE 0 — ADMIN
// ================================================================

// POST /pos-terminals — create a pending terminal + first enrollment code.
export const createTerminal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branchId = branchIdNum(req.body.branch_id ?? req.body.branchId);
    const terminalName = String(req.body.terminal_name ?? req.body.terminalName ?? '').trim();
    const terminalType = String(req.body.terminal_type ?? req.body.terminalType ?? '').trim().toLowerCase();

    if (!branchId) throw new AppError('branch_id is required', 400);
    if (!terminalName) throw new AppError('terminal_name is required', 400);
    if (!terminalType) throw new AppError('terminal_type is required', 400);
    if (!KNOWN_TERMINAL_TYPES.has(terminalType)) {
      logger.warn('Unrecognised terminal_type for new POS terminal', { terminalType });
    }

    const { data: branch } = await supabase.from('branches').select('id').eq('id', branchId).maybeSingle();
    if (!branch) throw new AppError('Branch not found', 404);

    const requestedCode = String(req.body.terminal_code ?? req.body.terminalCode ?? '').trim().toUpperCase();
    const terminalCode = requestedCode || await generateTerminalCode(branchId);

    const { data: terminal, error } = await supabase
      .from('pos_terminals')
      .insert({
        terminal_code: terminalCode,
        branch_id: branchId,
        terminal_name: terminalName,
        terminal_type: terminalType,
        status: 'pending_registration',
        created_by: userId(req),
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') throw new AppError(`Terminal code ${terminalCode} already exists`, 409);
      throw new AppError(error.message, 500);
    }

    const enrollment = await issueEnrollmentCode(terminal.id, branchId, userId(req));
    logger.info('POS terminal created', { terminalCode, branchId, terminalType });

    res.status(201).json({
      success: true,
      data: {
        terminal: normalizeTerminal(terminal),
        enrollment_code: enrollment.code,        // shown once to the admin
        expires_at: enrollment.expiresAt,
      },
      message: 'Terminal created. Share the enrollment code with the installer — it is shown only once.',
    });
  } catch (error) {
    next(error);
  }
};

// GET /pos-terminals — list terminals (optionally by branch).
export const listTerminals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let query = supabase.from('pos_terminals').select('*').order('branch_id').order('terminal_name');
    const branchId = branchIdNum(req.query.branch_id ?? req.query.branchId);
    if (branchId) query = query.eq('branch_id', branchId);
    const status = String(req.query.status || '').trim().toLowerCase();
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: (data || []).map(normalizeTerminal) });
  } catch (error) {
    next(error);
  }
};

// GET /pos-terminals/:id — single terminal detail.
export const getTerminal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabase.from('pos_terminals').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw new AppError(error.message, 500);
    if (!data) throw new AppError('Terminal not found', 404);
    res.json({ success: true, data: normalizeTerminal(data) });
  } catch (error) {
    next(error);
  }
};

// POST /pos-terminals/:id/enrollment-code — regenerate the one-time code.
export const regenerateEnrollmentCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data: terminal, error } = await supabase.from('pos_terminals').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw new AppError(error.message, 500);
    if (!terminal) throw new AppError('Terminal not found', 404);
    if (terminal.status === 'revoked') throw new AppError('Terminal is revoked — transfer or recreate it instead', 400);

    const enrollment = await issueEnrollmentCode(terminal.id, terminal.branch_id, userId(req));
    res.json({
      success: true,
      data: { enrollment_code: enrollment.code, expires_at: enrollment.expiresAt },
      message: 'New enrollment code issued (shown once).',
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /pos-terminals/:id — rename / retype / suspend / activate.
export const updateTerminal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const patch: Record<string, unknown> = {};
    if (req.body.terminal_name ?? req.body.terminalName) patch.terminal_name = String(req.body.terminal_name ?? req.body.terminalName).trim();
    if (req.body.terminal_type ?? req.body.terminalType) patch.terminal_type = String(req.body.terminal_type ?? req.body.terminalType).trim().toLowerCase();
    if (req.body.status) {
      const status = String(req.body.status).trim().toLowerCase();
      if (!['active', 'suspended'].includes(status)) throw new AppError('status must be active or suspended (use revoke/transfer for others)', 400);
      patch.status = status;
    }
    if (!Object.keys(patch).length) throw new AppError('Nothing to update', 400);

    const { data, error } = await supabase.from('pos_terminals').update(patch).eq('id', req.params.id).select().single();
    if (error) throw new AppError(error.message, 500);
    res.json({ success: true, data: normalizeTerminal(data) });
  } catch (error) {
    next(error);
  }
};

// POST /pos-terminals/:id/revoke — kill the device binding (theft / decommission).
export const revokeTerminal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('pos_terminals')
      .update({
        status: 'revoked',
        device_public_key: null,
        device_fingerprint: null,
        device_registered_at: null,
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw new AppError(error.message, 500);
    await supabase.from('pos_terminal_enrollments').delete().eq('terminal_id', req.params.id);
    logger.warn('POS terminal revoked', { terminalId: req.params.id, by: userId(req) });
    res.json({ success: true, data: normalizeTerminal(data), message: 'Terminal revoked; device can no longer authenticate.' });
  } catch (error) {
    next(error);
  }
};

// POST /pos-terminals/:id/transfer — move a terminal to another branch.
// Keeps the existing device registration active and updates the terminal's branch.
export const transferTerminal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const toBranch = branchIdNum(req.body.branch_id ?? req.body.branchId);
    if (!toBranch) throw new AppError('Target branch_id is required', 400);
    const { data: branch } = await supabase.from('branches').select('id, name').eq('id', toBranch).maybeSingle();
    if (!branch) throw new AppError('Target branch not found', 404);

    const { data: terminal, error } = await supabase
      .from('pos_terminals')
      .update({ branch_id: toBranch })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw new AppError(error.message, 500);

    logger.warn('POS terminal transferred', { terminalId: req.params.id, toBranch, by: userId(req) });
    res.json({
      success: true,
      data: { terminal: normalizeTerminal(terminal), branch_name: branch.name },
      message: `Terminal transferred to ${branch.name || `branch ${toBranch}`}. No re-registration required.`,
    });
  } catch (error) {
    next(error);
  }
};

// GET /pos-terminals/device/status — check whether a terminal ID is active and its current branch.
// Public endpoint used by devices on startup / resume / heartbeat.
export const checkDeviceStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const terminalId = String(req.query.terminal_id ?? req.query.terminalId ?? '').trim();
    if (!terminalId) throw new AppError('terminal_id is required', 400);

    const { data: terminal, error } = await supabase
      .from('pos_terminals')
      .select('id, terminal_code, terminal_name, terminal_type, branch_id, status, device_public_key')
      .eq('id', terminalId)
      .maybeSingle();

    if (error) throw new AppError(error.message, 500);
    if (!terminal) {
      res.json({ success: true, data: { registered: false, status: 'not_found' } });
      return;
    }

    const isActive = terminal.status === 'active' && Boolean(terminal.device_public_key);
    res.json({
      success: true,
      data: {
        registered: isActive,
        status: terminal.status,
        terminal_id: terminal.id,
        terminal_code: terminal.terminal_code,
        terminal_name: terminal.terminal_name,
        terminal_type: terminal.terminal_type,
        branch_id: terminal.branch_id,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ================================================================
// PHASE 1 — DEVICE (no user auth; protected by the code / device signature)
// ================================================================

const loadValidEnrollment = async (code: string) => {
  const { data: enrollment } = await supabase
    .from('pos_terminal_enrollments')
    .select('*')
    .eq('enrollment_code_hash', hashCode(code))
    .maybeSingle();
  if (!enrollment) throw new AppError('Invalid enrollment code', 401);
  if (enrollment.used_at) throw new AppError('This enrollment code has already been used', 409);
  if (new Date(enrollment.expires_at).getTime() < Date.now()) throw new AppError('This enrollment code has expired', 410);
  if (Number(enrollment.attempts || 0) >= MAX_ENROLLMENT_ATTEMPTS) throw new AppError('Too many attempts on this code — ask the administrator for a new one', 429);
  return enrollment;
};

// POST /pos-terminals/enroll/verify — validate a code and show what it binds to.
// Does NOT consume the code. Increments the attempt counter.
export const verifyEnrollmentCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const code = String(req.body.code ?? req.body.enrollment_code ?? '').replace(/\s+/g, '').trim();
    if (!/^\d{6}$/.test(code)) throw new AppError('Enter the 6-digit enrollment code', 400);

    const enrollment = await loadValidEnrollment(code).catch(async (err) => {
      // Count a failed attempt against whatever row (if any) this hash points to.
      const { data: row } = await supabase.from('pos_terminal_enrollments').select('id, attempts').eq('enrollment_code_hash', hashCode(code)).maybeSingle();
      if (row) await supabase.from('pos_terminal_enrollments').update({ attempts: Number(row.attempts || 0) + 1 }).eq('id', row.id);
      throw err;
    });

    const { data: terminal } = await supabase.from('pos_terminals').select('*').eq('id', enrollment.terminal_id).maybeSingle();
    if (!terminal) throw new AppError('Terminal not found for this code', 404);
    if (terminal.status === 'revoked') throw new AppError('This terminal has been revoked', 403);

    const { data: branch } = await supabase.from('branches').select('id, name').eq('id', terminal.branch_id).maybeSingle();

    res.json({
      success: true,
      data: {
        terminal_id: terminal.id,
        terminal_code: terminal.terminal_code,
        terminal_name: terminal.terminal_name,
        terminal_type: terminal.terminal_type,
        branch_id: terminal.branch_id,
        branch_name: branch?.name || null,
        already_registered: !!terminal.device_public_key,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /pos-terminals/enroll/register — consume the code, bind the device key.
export const registerTerminal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const code = String(req.body.code ?? req.body.enrollment_code ?? '').replace(/\s+/g, '').trim();
    const devicePublicKey = String(req.body.device_public_key ?? req.body.devicePublicKey ?? '').trim();
    const deviceFingerprint = String(req.body.device_fingerprint ?? req.body.deviceFingerprint ?? '').trim();
    if (!/^\d{6}$/.test(code)) throw new AppError('A valid 6-digit enrollment code is required', 400);
    if (!devicePublicKey) throw new AppError('device_public_key is required', 400);
    if (!deviceFingerprint) throw new AppError('device_fingerprint is required', 400);
    // Validate the key is a usable Ed25519 key before we commit anything.
    ed25519PublicKey(devicePublicKey);

    const enrollment = await loadValidEnrollment(code);
    const { data: terminal } = await supabase.from('pos_terminals').select('*').eq('id', enrollment.terminal_id).maybeSingle();
    if (!terminal) throw new AppError('Terminal not found for this code', 404);
    if (terminal.status === 'revoked') throw new AppError('This terminal has been revoked', 403);

    const { data: updated, error: updErr } = await supabase
      .from('pos_terminals')
      .update({
        device_public_key: devicePublicKey,
        device_fingerprint: deviceFingerprint,
        device_registered_at: new Date().toISOString(),
        status: 'active',
        registered_by: enrollment.created_by || null,
        app_version: String(req.body.app_version ?? req.body.appVersion ?? '').trim() || null,
        os_version: String(req.body.os_version ?? req.body.osVersion ?? '').trim() || null,
        last_ip: req.ip || null,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', terminal.id)
      .select()
      .single();
    if (updErr) throw new AppError(updErr.message, 500);

    // Consume the code (single-use).
    await supabase.from('pos_terminal_enrollments').update({ used_at: new Date().toISOString() }).eq('id', enrollment.id);
    await supabase.from('pos_terminal_enrollments').delete().eq('terminal_id', terminal.id).is('used_at', null);

    logger.info('POS terminal registered', { terminalCode: terminal.terminal_code, branchId: terminal.branch_id });
    res.status(201).json({
      success: true,
      data: {
        terminal_id: updated.id,
        terminal_code: updated.terminal_code,
        terminal_name: updated.terminal_name,
        terminal_type: updated.terminal_type,
        branch_id: updated.branch_id,
        status: updated.status,
      },
      message: 'Terminal registered. This device is now bound to its branch.',
    });
  } catch (error) {
    next(error);
  }
};

// POST /pos-terminals/device/challenge — issue a short-lived nonce to sign.
// Stateless: the nonce is itself a signed JWT bound to the terminal, so no
// server-side storage is needed and it cannot be replayed after it expires.
export const deviceChallenge = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const terminalId = String(req.body.terminal_id ?? req.body.terminalId ?? '').trim();
    if (!terminalId) throw new AppError('terminal_id is required', 400);
    const { data: terminal } = await supabase.from('pos_terminals').select('id, status, device_public_key').eq('id', terminalId).maybeSingle();
    if (!terminal || !terminal.device_public_key) throw new AppError('Terminal is not registered', 404);
    if (terminal.status !== 'active') throw new AppError(`Terminal is ${terminal.status}`, 403);

    const nonceValue = crypto.randomBytes(24).toString('base64url');
    const challenge = jwt.sign(
      { kind: 'pos_device_challenge', terminal_id: terminalId, nonce: nonceValue },
      jwtSecret(),
      { expiresIn: `${CHALLENGE_TTL_SECONDS}s` }
    );
    res.json({ success: true, data: { challenge, nonce: nonceValue, expires_in: CHALLENGE_TTL_SECONDS } });
  } catch (error) {
    next(error);
  }
};

// POST /pos-terminals/device/token — verify the signed challenge, mint a device JWT.
export const deviceToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const challenge = String(req.body.challenge ?? '').trim();
    const signature = String(req.body.signature ?? '').trim();
    if (!challenge || !signature) throw new AppError('challenge and signature are required', 400);

    let decoded: any;
    try {
      decoded = jwt.verify(challenge, jwtSecret());
    } catch {
      throw new AppError('Challenge is invalid or expired — request a new one', 401);
    }
    if (decoded?.kind !== 'pos_device_challenge' || !decoded?.terminal_id) throw new AppError('Malformed challenge', 400);

    const { data: terminal } = await supabase.from('pos_terminals').select('*').eq('id', decoded.terminal_id).maybeSingle();
    if (!terminal || !terminal.device_public_key) throw new AppError('Terminal is not registered', 404);
    if (terminal.status !== 'active') throw new AppError(`Terminal is ${terminal.status}`, 403);

    // The device signs the exact challenge string it received.
    if (!verifyEd25519(terminal.device_public_key, challenge, signature)) {
      throw new AppError('Device signature verification failed', 401);
    }

    await supabase.from('pos_terminals').update({ last_seen_at: new Date().toISOString(), last_ip: req.ip || null }).eq('id', terminal.id);

    const deviceToken = jwt.sign(
      {
        kind: 'pos_terminal',
        terminal_id: terminal.id,
        terminal_code: terminal.terminal_code,
        branch_id: terminal.branch_id,
        terminal_type: terminal.terminal_type,
      },
      jwtSecret(),
      { expiresIn: `${DEVICE_TOKEN_TTL_HOURS}h` }
    );

    res.json({
      success: true,
      data: {
        device_token: deviceToken,
        expires_in_hours: DEVICE_TOKEN_TTL_HOURS,
        terminal_id: terminal.id,
        terminal_code: terminal.terminal_code,
        terminal_name: terminal.terminal_name,
        terminal_type: terminal.terminal_type,
        branch_id: terminal.branch_id,
      },
    });
  } catch (error) {
    next(error);
  }
};
