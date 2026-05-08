export interface FriendlyApiError {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
  raw?: unknown;
}

const NOTIFY_DEDUPE_MS = 3500;
const recentNotifications = new Map<string, number>();

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function flattenDetails(value: unknown): string | undefined {
  if (!value) return undefined;

  if (typeof value === "string") return value.trim() || undefined;

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => flattenDetails(item))
      .filter(Boolean)
      .slice(0, 4);
    return parts.length ? parts.join("; ") : undefined;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    const direct = firstString(
      record.message,
      record.error,
      record.detail,
      record.reason,
      record.description,
    );
    if (direct) return direct;

    const fieldMessages = Object.entries(record)
      .flatMap(([field, fieldValue]) => {
        if (typeof fieldValue === "string") return [`${field}: ${fieldValue}`];
        if (Array.isArray(fieldValue)) {
          return fieldValue
            .map((item) =>
              typeof item === "string"
                ? `${field}: ${item}`
                : flattenDetails(item),
            )
            .filter(Boolean) as string[];
        }
        return [];
      })
      .slice(0, 4);

    return fieldMessages.length ? fieldMessages.join("; ") : undefined;
  }

  return undefined;
}

function statusPrefix(status?: number): string {
  switch (status) {
    case 400:
      return "Request needs correction";
    case 401:
      return "Session expired";
    case 403:
      return "Access denied";
    case 404:
      return "Record not found";
    case 409:
      return "Conflict";
    case 422:
      return "Validation failed";
    case 429:
      return "Too many requests";
    case 500:
    case 502:
    case 503:
    case 504:
      return "Server error";
    default:
      return status && status >= 400
        ? `Request failed (${status})`
        : "Request failed";
  }
}

function fallbackMessage(status?: number): string {
  switch (status) {
    case 400:
      return "Please check the highlighted information and try again.";
    case 401:
      return "Please sign in again to continue.";
    case 403:
      return "You do not have permission to perform this action.";
    case 404:
      return "The requested record could not be found. It may have been moved or deleted.";
    case 409:
      return "This action conflicts with the current record state. Refresh and try again.";
    case 422:
      return "Some required information is missing or invalid.";
    case 429:
      return "Please wait a moment and try again.";
    case 500:
    case 502:
    case 503:
    case 504:
      return "The server could not complete the request. Try again, or contact support if it continues.";
    default:
      return "The request could not be completed. Please try again.";
  }
}

export function normalizeApiError(
  input: unknown,
  status?: number,
  statusText?: string,
): FriendlyApiError {
  if (input instanceof Error) {
    return {
      message: input.message || fallbackMessage(status),
      status,
      raw: input,
    };
  }

  if (typeof input === "object" && input !== null) {
    const payload = input as Record<string, unknown>;
    const payloadStatus =
      typeof payload.status === "number" ? payload.status : status;
    const message = firstString(
      payload.message,
      payload.error,
      payload.detail,
      payload.reason,
      flattenDetails(payload.errors),
      flattenDetails(payload.data),
      statusText,
    );

    return {
      message: message || fallbackMessage(payloadStatus),
      status: payloadStatus,
      code: firstString(payload.code, payload.errorCode, payload.error_code),
      details: payload.errors ?? payload.data ?? payload.details,
      raw: input,
    };
  }

  if (typeof input === "string" && input.trim()) {
    return { message: input.trim(), status, raw: input };
  }

  return {
    message: statusText || fallbackMessage(status),
    status,
    raw: input,
  };
}

export function formatApiError(
  input: unknown,
  status?: number,
  statusText?: string,
): string {
  const normalized = normalizeApiError(input, status, statusText);
  const prefix = statusPrefix(normalized.status ?? status);
  const message =
    normalized.message || fallbackMessage(normalized.status ?? status);

  if (message.toLowerCase().startsWith(prefix.toLowerCase())) return message;
  return `${prefix}: ${message}`;
}

export function notifyApiError(
  input: unknown,
  options?: {
    status?: number;
    statusText?: string;
    endpoint?: string;
    title?: string;
    silent?: boolean;
  },
) {
  if (options?.silent || typeof window === "undefined") return;

  const message = formatApiError(input, options?.status, options?.statusText);
  const key = message;
  const now = Date.now();
  const previous = recentNotifications.get(key) || 0;

  if (now - previous < NOTIFY_DEDUPE_MS) return;
  recentNotifications.set(key, now);

  import("sonner").then(({ toast }) => {
    toast.error(options?.title || message, {
      description: options?.title ? message : undefined,
      duration: 7000,
    });
  });
}
