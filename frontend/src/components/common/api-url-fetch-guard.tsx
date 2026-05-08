"use client";

import { useEffect } from "react";
import { API_URL } from "@/lib/config";
import { notifyApiError } from "@/lib/error-utils";

declare global {
  interface Window {
    __fgApiFetchGuardInstalled?: boolean;
  }
}

const API_HOST = "api.hirall.com";
const SUPPRESS_ERROR_TOAST_HEADER = "x-fg-silent-error-toast";

function normalizeApiRequestUrl(rawUrl: string): string {
  const trimmedUrl = rawUrl.trim();

  if (trimmedUrl.startsWith(`${API_HOST}/`)) {
    return `https://${trimmedUrl}`;
  }

  if (trimmedUrl.startsWith(`//${API_HOST}/`)) {
    return `https:${trimmedUrl}`;
  }

  if (typeof window === "undefined") {
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
        parsedUrl.pathname.indexOf(malformedApiMarker) +
          malformedApiMarker.length -
          1,
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

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      let normalizedInput: RequestInfo | URL = input;
      let normalizedInit = init;
      let suppressErrorToast = false;
      let requestUrl = "";

      const removeSuppressHeader = (headers: Headers) => {
        suppressErrorToast = headers.get(SUPPRESS_ERROR_TOAST_HEADER) === "1";
        headers.delete(SUPPRESS_ERROR_TOAST_HEADER);
      };

      if (normalizedInit?.headers) {
        const headers = new Headers(normalizedInit.headers);
        removeSuppressHeader(headers);
        normalizedInit = { ...normalizedInit, headers };
      }

      if (typeof input === "string") {
        requestUrl = normalizeApiRequestUrl(input);
        normalizedInput = requestUrl;
      } else if (input instanceof URL) {
        requestUrl = normalizeApiRequestUrl(input.toString());
        normalizedInput = requestUrl;
      } else if (input instanceof Request) {
        const headers = new Headers(input.headers);
        removeSuppressHeader(headers);
        requestUrl = normalizeApiRequestUrl(input.url);
        normalizedInput =
          requestUrl !== input.url ? new Request(requestUrl, input) : input;
      }

      const response = await originalFetch(normalizedInput, normalizedInit);

      const responseUrl = response.url || requestUrl;
      const isApiRequest =
        responseUrl.includes(`://${API_HOST}/api`) ||
        responseUrl.includes(`${window.location.origin}/api`);

      if (
        !response.ok &&
        !suppressErrorToast &&
        isApiRequest &&
        window.location.pathname.includes("/dashboard")
      ) {
        const clonedResponse = response.clone();
        let payload: unknown = null;

        try {
          const contentType = clonedResponse.headers.get("content-type") || "";
          payload = contentType.includes("application/json")
            ? await clonedResponse.json()
            : await clonedResponse.text();
        } catch {
          payload = { message: response.statusText };
        }

        notifyApiError(payload, {
          status: response.status,
          statusText: response.statusText,
          endpoint: requestUrl || responseUrl,
        });
      }

      return response;
    };

    window.__fgApiFetchGuardInstalled = true;
  }, []);

  return null;
}
