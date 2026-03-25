// Network detection — online/offline monitoring

import { bridge } from '../../bridge';

type NetworkListener = (isOnline: boolean) => void;
const listeners: NetworkListener[] = [];

let _isOnline = navigator.onLine;

export function isOnline(): boolean {
  return _isOnline;
}

export function onNetworkChange(fn: NetworkListener): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

function notify(online: boolean) {
  _isOnline = online;
  listeners.forEach((fn) => fn(online));
}

// Browser-level events
window.addEventListener('online', async () => {
  const status = await bridge.network.getStatus().catch(() => null);
  notify(status?.is_online ?? true);
});

window.addEventListener('offline', () => notify(false));

// Poll every 30s to verify actual API reachability
setInterval(async () => {
  try {
    const status = await bridge.network.getStatus();
    if (status.is_online !== _isOnline) {
      notify(status.is_online);
    }
  } catch {
    // ignore
  }
}, 30_000);
