jest.mock('../config/database', () => ({ supabase: {} }));
jest.mock('../utils/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));

import { destinationConfirmDecision, sourceDeductionAllowed } from '../services/central-count-guard.service';

const DAY = 24 * 60 * 60 * 1000;
const CUTOFF = new Date('2026-11-05T00:00:00.000Z'); // the count
const before = (days: number) => new Date(CUTOFF.getTime() - days * DAY).toISOString();
const after = (hours: number) => new Date(CUTOFF.getTime() + hours * 3600_000).toISOString();
const INACTIVE = { cutoff: null };
const ACTIVE = { cutoff: CUTOFF };

describe('count guard is INACTIVE until the cutoff setting exists', () => {
  it('lets every note deduct at the source', () => {
    expect(sourceDeductionAllowed(before(1), INACTIVE)).toBe(true);
    expect(sourceDeductionAllowed(before(90), INACTIVE)).toBe(true);
    expect(sourceDeductionAllowed(null, INACTIVE)).toBe(true);
  });
  it('lets every note be confirmed, Kyogong and old notes included', () => {
    expect(destinationConfirmDecision({ created_at: before(1), to_branch_id: 1 }, INACTIVE).allowed).toBe(true);
    expect(destinationConfirmDecision({ created_at: before(90), to_branch_id: 2 }, INACTIVE).allowed).toBe(true);
  });
});

describe('count guard - source deduction (cutoff set)', () => {
  it('never deducts for a note dated before the count', () => {
    expect(sourceDeductionAllowed(before(1), ACTIVE)).toBe(false);
    expect(sourceDeductionAllowed(before(30), ACTIVE)).toBe(false);
  });
  it('deducts as normal for a note dated on or after the count', () => {
    expect(sourceDeductionAllowed(CUTOFF, ACTIVE)).toBe(true);
    expect(sourceDeductionAllowed(after(3), ACTIVE)).toBe(true);
  });
  it('does not deduct when the note date is missing', () => {
    expect(sourceDeductionAllowed(null, ACTIVE)).toBe(false);
  });
});

describe('count guard - destination confirm (cutoff set)', () => {
  it('refuses a pre-count note going to Kyogong, with a clear reason', () => {
    const d = destinationConfirmDecision({ created_at: before(1), to_branch_id: 1, dispatch_number: 'DN-KYO-1' }, ACTIVE);
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.rule).toBe('kyogong');
      expect(d.reason).toContain('DN-KYO-1');
      expect(d.reason).toContain('Kyogong');
      expect(d.reason).toContain('2026-11-05');
    }
  });
  it('allows another branch to confirm a note inside the 7 days before the count', () => {
    expect(destinationConfirmDecision({ created_at: before(3), to_branch_id: 2 }, ACTIVE).allowed).toBe(true);
    expect(destinationConfirmDecision({ created_at: before(6.9), to_branch_id: 8 }, ACTIVE).allowed).toBe(true);
  });
  it('refuses a note more than 7 days before the count, with a clear reason', () => {
    const d = destinationConfirmDecision({ created_at: before(8), to_branch_id: 2, dispatch_number: 'DN-BTN-9' }, ACTIVE);
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.rule).toBe('older_than_window');
      expect(d.reason).toContain('superseded by stock take');
      expect(d.reason).toContain('DN-BTN-9');
    }
  });
  it('confirms notes dated on or after the count normally, Kyogong included', () => {
    expect(destinationConfirmDecision({ created_at: after(2), to_branch_id: 1 }, ACTIVE).allowed).toBe(true);
    expect(destinationConfirmDecision({ created_at: CUTOFF, to_branch_id: 5 }, ACTIVE).allowed).toBe(true);
  });
  it('treats a Kyogong string id the same as a number', () => {
    expect(destinationConfirmDecision({ created_at: before(2), to_branch_id: '1' }, ACTIVE).allowed).toBe(false);
  });
});
