'use client';

import { useEffect } from 'react';
import { API_URL } from '@/lib/config';

declare global {
  interface Window {
    __fgApiFetchGuardInstalled?: boolean;
  }
}

const API_HOST = 'api.hirall.com';

function normalizeApiRequestUrl(rawUrl: string): string {
  const trimmedUrl = rawUrl.trim();

  if (trimmedUrl.startsWith(`${API_HOST}/`)) {
    return `https://${trimmedUrl}`;
  }

  if (trimmedUrl.startsWith(`//${API_HOST}/`)) {
    return `https:${trimmedUrl}`;
  }

  if (typeof window === 'undefined') {
    return rawUrl;
  }

  try {
    const parsedUrl = new URL(trimmedUrl, window.location.origin);
    const malformedApiMarker = `/${API_HOST}/`;

    if (
      parsedUrl.hostname === window.location.hostname &&
      parsedUrl.pathname.includes(malformedApiMarker)
    ) {
      const apiPath = parsedUrl.pathname.slice(
        parsedUrl.pathname.indexOf(malformedApiMarker) + malformedApiMarker.length - 1,
      );

      return `${API_URL}${apiPath}${parsedUrl.search}${parsedUrl.hash}`;
    }
  } catch {
    return rawUrl;
  }

  return rawUrl;
}

export function ApiUrlFetchGuard() {
  useEffect(() => {
    if (window.__fgApiFetchGuardInstalled) return;

    const originalFetch = window.fetch.bind(window);

    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === 'string') {
        return originalFetch(normalizeApiRequestUrl(input), init);
      }

      if (input instanceof URL) {
        return originalFetch(normalizeApiRequestUrl(input.toString()), init);
      }

      if (input instanceof Request) {
        const normalizedUrl = normalizeApiRequestUrl(input.url);
        if (normalizedUrl !== input.url) {
          return originalFetch(new Request(normalizedUrl, input), init);
        }
      }

      return originalFetch(input, init);
    };

    window.__fgApiFetchGuardInstalled = true;
  }, []);

  return null;
}
