/**
 * smtp.config.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all email / SMTP configuration.
 *
 * Security principles enforced here:
 *  • All secrets come ONLY from environment variables – never hardcoded.
 *  • TLS is always enforced (rejectUnauthorized: true in production).
 *  • Startup validation fails fast so a misconfigured server never runs silently.
 *  • fromEmail must pass a basic format check to prevent header-injection.
 *  • Nothing sensitive is ever logged – only a masked hint is printed.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { logger } from '../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SmtpConfig {
  /** SMTP relay hostname (Brevo: smtp-relay.brevo.com) */
  host: string;
  /** SMTP port — 587 (STARTTLS) or 465 (TLS) */
  port: number;
  /** true only for port 465 (implicit TLS); port 587 uses STARTTLS upgrade */
  secure: boolean;
  auth: {
    /** Brevo login: the email address of your Brevo account */
    user: string;
    /** Brevo SMTP key (NOT the API key – generate in Brevo → SMTP & API → SMTP) */
    pass: string;
  };
  tls: {
    /** Reject self-signed / invalid certificates — always true in production */
    rejectUnauthorized: boolean;
    /** Minimum TLS version */
    minVersion: 'TLSv1.2' | 'TLSv1.3';
    /** Explicit cipher list for forward-secrecy */
    ciphers: string;
  };
  /** Sender details */
  from: {
    email: string;
    name: string;
  };
  /** Brevo Transactional API key (used by brevo-email.service.ts directly) */
  apiKey: string;
  /** Max concurrent email connections to Brevo */
  pool: boolean;
  maxConnections: number;
  maxMessages: number;
}

export interface SmtpValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Brevo SMTP relay – this is the public endpoint, not a secret */
const BREVO_SMTP_HOST = 'smtp-relay.brevo.com';

/** Minimum safe port list for Brevo */
const ALLOWED_PORTS = [587, 465] as const;

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * Validates a basic email format without leaking the actual value in logs.
 * Returns a masked string like  b***@famousgatehotels.com  for safe logging.
 */
function validateAndMaskEmail(raw: string, field: string): { valid: boolean; masked: string } {
  const trimmed = raw.trim();
  // RFC-5322 simplified check – good enough for a server-side guard
  const EMAIL_RE = /^[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]{2,}$/;
  if (!EMAIL_RE.test(trimmed)) {
    return { valid: false, masked: `[INVALID ${field}]` };
  }
  const [local, domain] = trimmed.split('@');
  const masked = `${local[0]}${'*'.repeat(Math.max(0, local.length - 1))}@${domain}`;
  return { valid: true, masked };
}

/**
 * Returns a masked version of any secret string for safe logging.
 * e.g.  "xsmtp-abc123xyz"  →  "xsmt…xyz"
 */
function maskSecret(secret: string): string {
  if (secret.length <= 6) return '***';
  return `${secret.slice(0, 4)}…${secret.slice(-3)}`;
}

// ─── Config builder ───────────────────────────────────────────────────────────

/**
 * Builds and validates the SMTP configuration from environment variables.
 * Throws on critical errors so the process fails at startup rather than at send-time.
 */
export function buildSmtpConfig(): SmtpConfig {
  const isProd = process.env.NODE_ENV === 'production';

  // ── Required vars ──────────────────────────────────────────────────────────
  const smtpUser = process.env.BREVO_SMTP_USER || process.env.SMTP_USER || '';
  const smtpPass = process.env.BREVO_SMTP_KEY  || process.env.SMTP_PASS || '';
  const apiKey   = process.env.BREVO_API_KEY   || '';
  const fromEmailRaw = process.env.SMTP_FROM_EMAIL || 'info@famousgatehotels.com';
  const fromName     = process.env.SMTP_FROM_NAME  || 'Famous Gate Hotels';

  // ── Port resolution ────────────────────────────────────────────────────────
  const rawPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const port: 587 | 465 = ALLOWED_PORTS.includes(rawPort as any) ? (rawPort as 587 | 465) : 587;
  // Port 465 = implicit TLS (secure: true); 587 = STARTTLS (secure: false, upgraded via STARTTLS)
  const secure = (port === 465);

  // ── Validation ─────────────────────────────────────────────────────────────
  const { valid: emailOk, masked: maskedFrom } = validateAndMaskEmail(fromEmailRaw, 'SMTP_FROM_EMAIL');

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!smtpUser)  errors.push('BREVO_SMTP_USER (or SMTP_USER) is not set');
  if (!smtpPass)  errors.push('BREVO_SMTP_KEY (or SMTP_PASS) is not set');
  if (!apiKey)    warnings.push('BREVO_API_KEY is not set – Brevo API (non-SMTP) calls will fail');
  if (!emailOk)   errors.push(`SMTP_FROM_EMAIL "${fromEmailRaw}" is not a valid email address`);

  // In production, all required vars must be present
  if (isProd && errors.length > 0) {
    const msg = `[smtp.config] FATAL – SMTP misconfigured:\n${errors.join('\n')}`;
    logger.error(msg);
    throw new Error(msg);
  }

  // In development, warn but continue
  errors.forEach(e => logger.error(`[smtp.config] ERROR: ${e}`));
  warnings.forEach(w => logger.warn(`[smtp.config] WARNING: ${w}`));

  const config: SmtpConfig = {
    host: BREVO_SMTP_HOST,
    port,
    secure,
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    tls: {
      // Always reject invalid/self-signed certs. In dev this may need to be
      // temporarily set to false only for local testing without a real cert.
      rejectUnauthorized: isProd ? true : (process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'),
      minVersion: 'TLSv1.2',
      // Forward-secrecy cipher suites (ECDHE preferred)
      ciphers: 'ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-CHACHA20-POLY1305'
    },
    from: {
      email: fromEmailRaw.trim(),
      name: fromName.trim()
    },
    apiKey,
    pool: true,         // Reuse SMTP connections (more efficient, fewer auth round-trips)
    maxConnections: 5,  // Brevo free-tier limit is 300 emails/day; 5 conns is safe
    maxMessages: 100    // Max emails per connection before reconnect
  };

  // Safe startup log — no secrets, no full addresses
  logger.info('[smtp.config] Brevo SMTP configured:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    pool: config.pool,
    tlsMinVersion: config.tls.minVersion,
    rejectUnauthorized: config.tls.rejectUnauthorized,
    fromEmail: maskedFrom,
    fromName: config.from.name,
    smtpUser: smtpUser ? maskSecret(smtpUser) : 'NOT SET',
    smtpKeySet: !!smtpPass,
    apiKeySet: !!apiKey
  });

  return config;
}

/**
 * Validates the config without building it (useful for tests / health-checks).
 */
export function validateSmtpConfig(): SmtpValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!process.env.BREVO_SMTP_USER && !process.env.SMTP_USER)
    errors.push('BREVO_SMTP_USER is missing');
  if (!process.env.BREVO_SMTP_KEY && !process.env.SMTP_PASS)
    errors.push('BREVO_SMTP_KEY is missing');
  if (!process.env.BREVO_API_KEY)
    warnings.push('BREVO_API_KEY is missing – API mode unavailable');
  if (!process.env.SMTP_FROM_EMAIL)
    warnings.push('SMTP_FROM_EMAIL not set – will use default');

  return { valid: errors.length === 0, errors, warnings };
}
