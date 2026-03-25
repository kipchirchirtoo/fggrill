import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { router } from './routes/router';
import { AppStateProvider } from './state/AppStateProvider';
import { NetworkMonitor } from './components/NetworkMonitor';
import './assets/styles/globals.css';

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
        <NetworkMonitor />
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors closeButton />
      </AppStateProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
