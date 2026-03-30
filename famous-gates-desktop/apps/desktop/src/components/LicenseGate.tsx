// LicenseGate — blocks app render until a valid branch license is confirmed

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';

interface LicenseRecord {
  key: string;
  branch_id: number;
  verified_at: string;
}

type Status = 'loading' | 'valid' | 'invalid';

interface Props {
  children: React.ReactNode;
}

export function LicenseGate({ children }: Props) {
  const [status, setStatus] = useState<Status>('loading');
  const [key, setKey] = useState('');
  const [branchId, setBranchId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load('license.dat', { autoSave: false })
      .then((store) => store.get<LicenseRecord>('license'))
      .then((record) => {
        if (record && record.key && record.branch_id) {
          setStatus('valid');
        } else {
          setStatus('invalid');
        }
      })
      .catch(() => {
        // Store read failure — treat as no license (Requirement 6.1 error path)
        setStatus('invalid');
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await invoke('cmd_verify_license', {
        key,
        branch_id: parseInt(branchId, 10),
      });
      setStatus('valid');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid license key or branch ID');
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading') return null;

  if (status === 'valid') return <>{children}</>;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="license-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f4f8',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: '2.5rem',
          minWidth: 360,
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        }}
      >
        <h2 id="license-title" style={{ marginTop: 0, marginBottom: '0.5rem' }}>
          Activate Famous Gates Hotels
        </h2>
        <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Enter your branch license key to continue.
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="license-key" style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
              License Key
            </label>
            <input
              id="license-key"
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
              autoComplete="off"
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', borderRadius: 4, border: '1px solid #ccc' }}
            />
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="branch-id" style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
              Branch ID
            </label>
            <input
              id="branch-id"
              type="number"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', borderRadius: 4, border: '1px solid #ccc' }}
            />
          </div>
          {error && (
            <p role="alert" style={{ color: '#c0392b', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            style={{ width: '100%', padding: '0.625rem', fontWeight: 600, borderRadius: 4, cursor: submitting ? 'not-allowed' : 'pointer' }}
          >
            {submitting ? 'Verifying…' : 'Activate'}
          </button>
        </form>
      </div>
    </div>
  );
}
