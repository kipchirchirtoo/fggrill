"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { BranchProvider } from "@/lib/branch-context";
import { DownloadManager } from "@/components/ui/download-manager";
import { ApiUrlFetchGuard } from "@/components/common/api-url-fetch-guard";
import { notifyApiError } from "@/lib/error-utils";

function GlobalErrorListener() {
  useEffect(() => {
    const shouldNotify = () => window.location.pathname.includes("/dashboard");

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!shouldNotify()) return;
      notifyApiError(event.reason || "Unexpected background error", {
        title: "Something failed in this module",
      });
    };

    const handleRuntimeError = (event: ErrorEvent) => {
      if (!shouldNotify()) return;
      notifyApiError(event.error || event.message || "Unexpected page error", {
        title: "Dashboard error",
      });
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleRuntimeError);

    return () => {
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
      window.removeEventListener("error", handleRuntimeError);
    };
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <>
      <ApiUrlFetchGuard />
      <GlobalErrorListener />
      <QueryClientProvider client={queryClient}>
        <BranchProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "white",
                color: "#000",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              },
            }}
          />
          <DownloadManager />
        </BranchProvider>
      </QueryClientProvider>
    </>
  );
}
