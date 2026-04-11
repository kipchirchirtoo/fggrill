import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './routes/router';
import { AppStateProvider } from './state/AppStateProvider';
import { NetworkMonitor } from './components/NetworkMonitor';
import { LicenseGate } from './components/LicenseGate';
import { UpdateManager } from './components/UpdateManager';
import './assets/styles/globals.css';
// NOTE: No Toaster import here — the app is a full-screen iframe (SiteView).
// Toasts live inside the Next.js app loaded by that iframe, not in this shell.

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 min
      gcTime: 1000 * 60 * 30,     // 30 min
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppStateProvider>
        {/* LicenseGate disabled in dev — re-enable for production builds */}
        {/* <LicenseGate> */}
          <NetworkMonitor />
          <UpdateManager />
          <RouterProvider router={router} />
          {/* No <Toaster /> — it would be hidden under the full-screen SiteView iframe */}
        {/* </LicenseGate> */}
      </AppStateProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
