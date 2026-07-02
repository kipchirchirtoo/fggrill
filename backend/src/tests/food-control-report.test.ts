import {
  computeControlsRow,
  computeRawSystemSales,
  rolloverWarning,
  YieldRule,
} from '../services/food-control-report.service';

/**
 * Acceptance fixtures verified against the real manual sheet
 * (JUNE_STORE_STOCKSHEET.xlsx tab "1st") — exact reproduction required,
 * not approximate matching.
 */

describe('computeControlsRow — verified sheet fixtures', () => {
  it('SAMOSA (directly-tracked): O.P 38 + ADDED 62, C.STOCK 17, REJECTS 2 ⇒ VAR −2, Shorts.v −120', () => {
    const row = computeControlsRow({
      item_name: 'SAMOSA',
      kind: 'direct',
      opening: 38,
      added: 62,
      closing: 17,
      rejects: 2,
      system_sales: 79, // actual POS qty, no conversion
      selling_price: 60,
    });
    expect(row.totals).toBe(100);
    expect(row.expected).toBe(81); // 100 − 17 − 2
    expect(row.variance).toBe(-2); // 79 − 81
    expect(row.shorts_value).toBe(-120); // −2 × 60
  });

  it('MBUZI (yield-converted raw): O.P 2.5 + ADDED 3.74, C.STOCK 0.25, no rejects ⇒ VAR −0.99, Shorts.v −346.50', () => {
    const row = computeControlsRow({
      item_name: 'MBUZI',
      item_sku: 'MBUZI',
      kind: 'yield',
      opening: 2.5,
      added: 3.74,
      closing: 0.25,
      rejects: 0, // REJECTS treated as 0 when not logged
      system_sales: 5, // kg-equivalent from yield conversion
      selling_price: 350,
    });
    expect(row.totals).toBe(6.24);
    expect(row.expected).toBe(5.99); // 6.24 − 0.25 − 0
    expect(row.variance).toBe(-0.99); // 5 − 5.99
    expect(row.shorts_value).toBe(-346.5); // −0.99 × 350
  });

  it('positive variance keeps the sign convention (surplus)', () => {
    const row = computeControlsRow({
      item_name: 'CHAPATI',
      kind: 'direct',
      opening: 10,
      added: 90,
      closing: 30,
      rejects: 0,
      system_sales: 75,
      selling_price: 30,
    });
    expect(row.expected).toBe(70);
    expect(row.variance).toBe(5);
    expect(row.shorts_value).toBe(150);
  });
});

describe('computeRawSystemSales — yield conversion', () => {
  const rules: YieldRule[] = [
    // 1 raw kg yields 4 portions
    { raw_item_sku: 'MBUZI', raw_quantity: 1, produced_item_name: 'Mbuzi Wet Fry', produced_quantity: 4, pos_outlet_item_id: 'out-1' },
    // 1 raw kg yields 2 specials
    { raw_item_sku: 'MBUZI', raw_quantity: 1, produced_item_name: 'Mbuzi Special', produced_quantity: 2, pos_outlet_item_id: null },
    // unrelated raw item — must not contribute
    { raw_item_sku: 'BEEF', raw_quantity: 1, produced_item_name: 'Beef Fry', produced_quantity: 5, pos_outlet_item_id: null },
  ];

  it('sums raw-equivalents across all yield lines (Type D reconciliation)', () => {
    const byOutletId = new Map<string, number>([['out-1', 16]]); // 16 portions ⇒ 4 kg
    const byName = new Map<string, number>([['mbuzi special', 2]]); // 2 specials ⇒ 1 kg
    expect(computeRawSystemSales('MBUZI', rules, byOutletId, byName)).toBe(5);
  });

  it('prefers the exact POS outlet-item link over name matching', () => {
    const byOutletId = new Map<string, number>([['out-1', 8]]); // 2 kg
    // Name map ALSO has an entry for the linked item — must be ignored for that rule.
    const byName = new Map<string, number>([
      ['mbuzi wet fry', 999],
      ['mbuzi special', 0],
    ]);
    expect(computeRawSystemSales('MBUZI', rules, byOutletId, byName)).toBe(2);
  });

  it('returns 0 when nothing sold', () => {
    expect(computeRawSystemSales('MBUZI', rules, new Map(), new Map())).toBe(0);
  });
});

describe('rolloverWarning — opening-stock auto-rollover guard', () => {
  it('fires on the real reference inconsistency (Day 1 MBUZI closing 0.25 vs Day 2 opening 2.5)', () => {
    const warning = rolloverWarning(2.5, 0.25, 'MBUZI');
    expect(warning).toContain('MBUZI');
    expect(warning).toContain('2.5');
    expect(warning).toContain('0.25');
  });

  it('stays silent when opening matches prior closing within tolerance', () => {
    expect(rolloverWarning(0.25, 0.25, 'MBUZI')).toBeNull();
    expect(rolloverWarning(0.251, 0.25, 'MBUZI')).toBeNull();
  });

  it('stays silent when there is no prior day to roll from', () => {
    expect(rolloverWarning(38, null, 'SAMOSA')).toBeNull();
  });
});
