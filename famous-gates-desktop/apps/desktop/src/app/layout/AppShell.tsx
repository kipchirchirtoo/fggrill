import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../../components/Sidebar';
import { TopBar } from '../../components/TopBar';
import { SyncStatusBar } from '../../components/SyncStatusBar';
import { useAppState } from '../../state/AppStateProvider';

export function AppShell() {
  const { sync, network } = useAppState();

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />

        {/* Offline / sync status banner */}
        {(!network.is_online || sync.outbox_count > 0) && (
          <SyncStatusBar
            isOnline={network.is_online}
            outboxCount={sync.outbox_count}
            isSyncing={sync.is_syncing}
          />
        )}

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
