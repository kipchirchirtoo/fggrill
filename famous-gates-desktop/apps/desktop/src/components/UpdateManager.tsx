// UpdateManager — checks for app updates on mount and prompts the user

import { useEffect, useState } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from 'sonner';

export function UpdateManager() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    check()
      .then((available) => {
        if (available) {
          setUpdate(available);
          setShowModal(true);
        }
      })
      .catch((err: unknown) => {
        // Silently suppress network errors — no modal, no throw (Requirement 3.5)
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes('signature')) {
          toast.error('Update failed, contact support');
        }
        // All other errors (network, timeout, etc.) are silently ignored
      });
  }, []);

  async function handleUpdateNow() {
    if (!update) return;
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('signature')) {
        toast.error('Update failed, contact support');
      }
      // Partial failure — relaunch so download is retried next launch (Requirement 3.7)
      await relaunch();
    }
  }

  function handleLater() {
    setShowModal(false);
  }

  if (!showModal || !update) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: '2rem',
          minWidth: 320,
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        }}
      >
        <h2 id="update-title" style={{ marginTop: 0 }}>
          Update Available
        </h2>
        <p>Version <strong>{update.version}</strong> is ready to install.</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button onClick={handleLater} style={{ padding: '0.5rem 1rem' }}>
            Later
          </button>
          <button
            onClick={handleUpdateNow}
            style={{ padding: '0.5rem 1rem', fontWeight: 600 }}
          >
            Update now
          </button>
        </div>
      </div>
    </div>
  );
}
