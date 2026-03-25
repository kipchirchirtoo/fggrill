import React from 'react';
import { bridge } from '../bridge';
import { toast } from 'sonner';

interface SyncStatusBarProps {
  isOnline: boolean;
  outboxCount: number;
  isSyncing: boolean;
}

export function SyncStatusBar({ isOnline, outboxCount, isSyncing }: SyncStatusBarProps) {
  const handleForceSync = async () => {
    try {
      const result = await bridge.sync.forceSync();
      toast.success(`Synced ${result.synced} items`);
    } catch (err) {
      toast.error('Sync failed — will retry automatically');
    }
  };

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <span>Offline mode — changes saved locally and will sync when connected</span>
        {outboxCount > 0 && (
          <span className="ml-auto font-medium">{outboxCount} pending</span>
        )}
      </div>
    );
  }

  if (outboxCount > 0) {
    return (
      <div className="flex items-center gap-2 bg-blue-500/10 border-b border-blue-500/20 px-4 py-2 text-sm text-blue-700 dark:text-blue-400">
        {isSyncing ? (
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-blue-500" />
        )}
        <span>{isSyncing ? 'Syncing...' : `${outboxCount} changes pending sync`}</span>
        {!isSyncing && (
          <button
            onClick={handleForceSync}
            className="ml-auto text-xs underline hover:no-underline"
          >
            Sync now
          </button>
        )}
      </div>
    );
  }

  return null;
}
