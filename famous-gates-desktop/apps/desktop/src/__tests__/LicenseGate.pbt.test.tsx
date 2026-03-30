// Property-based tests for LicenseGate component
// Feature: tauri2-enterprise-systems
// Property 3: LicenseGate blocks children without valid license
// Property 4: LicenseGate passes children with valid persisted license

import { render, screen, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import { load } from '@tauri-apps/plugin-store';
import { LicenseGate } from '../components/LicenseGate';

const CHILD_TEXT = 'APP_CONTENT';

interface LicenseRecord {
  key: string;
  branch_id: number;
  verified_at: string;
}

function makeStoreMock(record: LicenseRecord | null) {
  return {
    get: vi.fn().mockResolvedValue(record),
    set: vi.fn(),
    save: vi.fn(),
  };
}

// ── Arbitrary: valid LicenseRecord ───────────────────────────────────────────

const arbitraryLicenseRecord = () =>
  fc.record({
    key: fc.stringMatching(/^[a-zA-Z0-9]{8,32}$/),
    branch_id: fc.integer({ min: 1, max: 9999 }),
    verified_at: fc.constant(new Date().toISOString()),
  });

// ── Property 3: LicenseGate blocks children without valid license ─────────────
// For any app state where license.dat has no valid record, children must NOT render.
// Validates: Requirements 6.3, 6.7

test('Property 3: LicenseGate blocks children when no license is stored', async () => {
  await fc.assert(
    fc.asyncProperty(fc.constant(null), async () => {
      vi.mocked(load).mockResolvedValue(makeStoreMock(null) as never);

      const { unmount } = render(
        <LicenseGate>
          <div>{CHILD_TEXT}</div>
        </LicenseGate>
      );

      await waitFor(() => {
        expect(screen.queryByText(CHILD_TEXT)).not.toBeInTheDocument();
      });

      unmount();
    }),
    { numRuns: 20 }
  );
});

// ── Property 4: LicenseGate passes children with valid persisted license ──────
// For any app state where license.dat has a valid record, children MUST render.
// Validates: Requirements 6.1, 6.2, 6.9

test('Property 4: LicenseGate renders children when valid license is stored', async () => {
  await fc.assert(
    fc.asyncProperty(arbitraryLicenseRecord(), async (record) => {
      vi.mocked(load).mockResolvedValue(makeStoreMock(record) as never);

      const { unmount } = render(
        <LicenseGate>
          <div>{CHILD_TEXT}</div>
        </LicenseGate>
      );

      await waitFor(() => {
        expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument();
      });

      unmount();
    }),
    { numRuns: 50 }
  );
});
