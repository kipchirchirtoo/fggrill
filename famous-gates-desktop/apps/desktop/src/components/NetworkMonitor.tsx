// NetworkMonitor — polls network status and updates app state

import { useEffect } from 'react';
import { useAppState } from '../state/AppStateProvider';

export function NetworkMonitor() {
  const { refreshNetwork } = useAppState();

  useEffect(() => {
    // Initial check
    refreshNetwork();

    // Poll every 30 seconds
    const interval = setInterval(refreshNetwork, 30_000);

    // Browser events
    const handleOnline = () => refreshNetwork();
    const handleOffline = () => refreshNetwork();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshNetwork]);

  return null; // purely side-effect component
}
