// Retry logic — exponential backoff for failed outbox entries

export function backoffDelay(retryCount: number): number {
  return Math.min(1000 * Math.pow(2, retryCount), 300_000); // max 5 min
}

export function shouldRetry(retryCount: number, maxRetries = 5): boolean {
  return retryCount < maxRetries;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error = new Error('Unknown error');
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        onRetry?.(attempt + 1, lastError);
        await new Promise((r) => setTimeout(r, backoffDelay(attempt)));
      }
    }
  }
  throw lastError;
}
