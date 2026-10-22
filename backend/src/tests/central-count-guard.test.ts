jest.mock('../config/database', () => ({ supabase: {} }));
jest.mock('../utils/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));

import { destinationConfirmDecision, sourceDeductionAllowed } from '../services/central-count-guard.service';

const day = (n: number) => new Date(Date.UTC(2026, 9, 22) - n * 24 * 60 * 60 * 1000).toISOString();
const NOT_LOADED = { loadedAt: null, plannedAt: null };
const PLANNED = { loadedAt: null, plannedAt: new Date(day(-10)) }; // count planned 10 days from "now"
const LOADED = { loadedAt: new Date(day(0)), plannedAt: null };

describe('central count guard - source deduction', () => {
  it('never deducts at source while the count is not loaded', () => {
    expect(sourceDeductionAllowed(day(0), NOT_LOADED)).toBe(false);
    expect(sourceDeductionAllowed(day(30), NOT_LOADED)).toBe(false);
  });
  it('does not deduct for a note dated before the count was loaded', () => {
    expect(sourceDeductionAllowed(day(1), LOADED)).toBe(false);
  });
  it('deducts as normal for a note dated after the count was loaded', () => {
    expect(sourceDeductionAllowed(new Date(Date.parse(day(0)) + 3600_000), LOADED)).toBe(true);
  });
  it('fails closed on a missing date', () => {
    expect(sourceDeductionAllowed(null, LOADED)).toBe(false);
  });
});

describe('central count guard - destination confirm', () => {
  it('never confirms a pre-count note going to Kyogong', () => {
    expect(destinationConfirmDecision({ created_at: day(1), to_branch_id: 1 }, NOT_LOADED).allowed).toBe(false);
    expect(destinationConfirmDecision({ created_at: day(1), to_branch_id: 1 }, LOADED).allowed).toBe(false);
  });
  it('allows another branch to confirm a note inside the 7 days before the count', () => {
    expect(destinationConfirmDecision({ created_at: day(3), to_branch_id: 2 }, NOT_LOADED).allowed).toBe(true);
    expect(destinationConfirmDecision({ created_at: day(6), to_branch_id: 8 }, LOADED).allowed).toBe(true);
  });
  it('refuses a note older than 7 days before the count', () => {
    expect(destinationConfirmDecision({ created_at: day(8), to_branch_id: 2 }, NOT_LOADED).allowed).toBe(false);
    expect(destinationConfirmDecision({ created_at: day(40), to_branch_id: 9 }, LOADED).allowed).toBe(false);
  });
  it('uses the planned count date to place the window', () => {
    // count planned in 10 days: a note from 5 days ago is 15 days before the count -> refused
    expect(destinationConfirmDecision({ created_at: day(5), to_branch_id: 2 }, PLANNED).allowed).toBe(false);
    // a note dated inside the 7 days before the planned count is allowed
    expect(destinationConfirmDecision({ created_at: day(-5), to_branch_id: 2 }, PLANNED).allowed).toBe(true);
  });
  it('lets notes dated after the count be confirmed normally, Kyogong included', () => {
    const after = new Date(Date.parse(day(0)) + 3600_000).toISOString();
    expect(destinationConfirmDecision({ created_at: after, to_branch_id: 1 }, LOADED).allowed).toBe(true);
  });
});
