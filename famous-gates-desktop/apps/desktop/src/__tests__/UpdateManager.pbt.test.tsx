// Property-based tests for UpdateManager component
// Feature: tauri2-enterprise-systems
// Property 5: Update check network error is silent

import { render, screen, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import { check } from '@tauri-apps/plugin-updater';
import { UpdateManager } from '../components/UpdateManager';

// ── Arbitrary: network-like errors ───────────────────────────────────────────

const arbitraryNetworkError = () =>
  fc.oneof(
    fc.constant(new Error('Network request failed')),
    fc.constant(new Error('Failed to fetch')),
    fc.constant(new Error('ECONNREFUSED')),
    fc.constant(new Error('timeout of 15000ms exceeded')),
    fc.constant(new Error('ERR_INTERNET_DISCONNECTED')),
  );

// ── Property 5: Update check network error is silent ─────────────────────────
// For any network failure during checkUpdate(), UpdateManager must NOT render a modal
// and must NOT throw an unhandled error.
// Validates: Requirement 3.5

test('Property 5: UpdateManager is silent on network errors from checkUpdate', async () => {
  await fc.assert(
    fc.asyncProperty(arbitraryNetworkError(), async (err) => {
      vi.mocked(check).mockRejectedValue(err);

      const { unmount } = render(<UpdateManager />);

      // Wait for the useEffect to settle
      await waitFor(() => {
        // No modal dialog should be rendered
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      unmount();
    }),
    { numRuns: 50 }
  );
});
