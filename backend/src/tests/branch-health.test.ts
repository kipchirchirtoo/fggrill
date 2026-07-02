import {
  buildFallbackDiagnosis,
  getAIHealthDiagnosis,
  StructuralFindings,
  BranchContext,
} from '../services/branch-health.service';

const FINDINGS_WITH_BAR_PROBLEMS: StructuralFindings = {
  outlet_items_by_type: [
    { outlet_type: 'restaurant', total_items: 50, active_items: 48, missing_source_link: 0 },
  ],
  bar_items_linked_to_restaurant_menu: 5,
  bar_drinks_total: 0,
  bar_drinks_missing_inventory_link: 7,
  recipes_active_count: 10,
  recipe_items_missing_inventory_link: 0,
  kitchen_stocktake_items_missing_inventory_link_30d: 0,
  bar_stock_zero_par_level: 12,
  dispatch_out_without_receive: 0,
  menu_items_active_total: 50,
  menu_items_missing_cost_price: 0,
};

const CLEAN_FINDINGS: StructuralFindings = {
  ...FINDINGS_WITH_BAR_PROBLEMS,
  bar_items_linked_to_restaurant_menu: 0,
  bar_drinks_missing_inventory_link: 0,
  bar_stock_zero_par_level: 0,
};

function makeContext(overrides: Partial<BranchContext> = {}): BranchContext {
  return {
    branch_id: 99,
    branch_name: 'Test Branch',
    configured_outlet_types: ['restaurant', 'cashier'],
    days_live: 180,
    total_orders: 5000,
    ...overrides,
  };
}

describe('buildFallbackDiagnosis', () => {
  it('excludes bar findings for a branch with no bar-type outlet configured', () => {
    const { issues } = buildFallbackDiagnosis(FINDINGS_WITH_BAR_PROBLEMS, makeContext());
    expect(issues.filter((i) => i.affected_area === 'Bar')).toHaveLength(0);
  });

  it('includes bar findings when a bar outlet is configured', () => {
    const { issues } = buildFallbackDiagnosis(
      FINDINGS_WITH_BAR_PROBLEMS,
      makeContext({ configured_outlet_types: ['restaurant', 'main_bar', 'cashier'] })
    );
    const barIssues = issues.filter((i) => i.affected_area === 'Bar');
    expect(barIssues.length).toBeGreaterThanOrEqual(2); // wrong links + missing inventory links
  });

  it('softens severities for a newly launched branch', () => {
    const mature = buildFallbackDiagnosis(
      FINDINGS_WITH_BAR_PROBLEMS,
      makeContext({ configured_outlet_types: ['main_bar'], days_live: 180 })
    );
    const fresh = buildFallbackDiagnosis(
      FINDINGS_WITH_BAR_PROBLEMS,
      makeContext({ configured_outlet_types: ['main_bar'], days_live: 3 })
    );
    expect(mature.issues.some((i) => i.severity === 'critical')).toBe(true);
    expect(fresh.issues.some((i) => i.severity === 'critical')).toBe(false);
    expect(fresh.health_score).toBeGreaterThan(mature.health_score);
  });

  it('returns 100 with no issues for clean findings', () => {
    const result = buildFallbackDiagnosis(CLEAN_FINDINGS, makeContext());
    expect(result.health_score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.is_ai_interpreted).toBe(false);
  });

  it('applies the documented score formula (100 - 25c - 10h - 5m - 2l, floor 0)', () => {
    const { issues, health_score } = buildFallbackDiagnosis(
      FINDINGS_WITH_BAR_PROBLEMS,
      makeContext({ configured_outlet_types: ['main_bar'] })
    );
    const weight = { critical: 25, high: 10, medium: 5, low: 2 } as const;
    const expected = Math.max(0, 100 - issues.reduce((s, i) => s + weight[i.severity], 0));
    expect(health_score).toBe(expected);
  });

  it('sorts issues most severe first', () => {
    const { issues } = buildFallbackDiagnosis(
      FINDINGS_WITH_BAR_PROBLEMS,
      makeContext({ configured_outlet_types: ['main_bar'] })
    );
    const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    const ranks = issues.map((i) => rank[i.severity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});

describe('getAIHealthDiagnosis', () => {
  const realFetch = global.fetch;
  const realKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(() => {
    global.fetch = realFetch;
    process.env.ANTHROPIC_API_KEY = realKey;
  });

  function mockAnthropicResponse(text: string) {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text }],
        usage: { input_tokens: 1000, output_tokens: 300 },
      }),
    }) as any;
  }

  it('uses the AI response when it matches the schema', async () => {
    mockAnthropicResponse(
      JSON.stringify({
        health_score: 72,
        issues: [
          {
            severity: 'high',
            title: 'Menu costs missing',
            plain_explanation: 'Some items have no cost.',
            suggested_action: 'Set costs.',
            affected_area: 'Menu',
          },
        ],
      })
    );
    const result = await getAIHealthDiagnosis(CLEAN_FINDINGS, makeContext());
    expect(result.is_ai_interpreted).toBe(true);
    expect(result.health_score).toBe(72);
    expect(result.issues).toHaveLength(1);
  });

  it('tolerates markdown fences around otherwise valid JSON', async () => {
    mockAnthropicResponse('```json\n{"health_score": 90, "issues": []}\n```');
    const result = await getAIHealthDiagnosis(CLEAN_FINDINGS, makeContext());
    expect(result.is_ai_interpreted).toBe(true);
    expect(result.health_score).toBe(90);
  });

  it('falls back to deterministic issues when the AI returns non-JSON', async () => {
    mockAnthropicResponse('Sorry, I cannot help with that.');
    const result = await getAIHealthDiagnosis(
      FINDINGS_WITH_BAR_PROBLEMS,
      makeContext({ configured_outlet_types: ['restaurant', 'main_bar', 'cashier'] })
    );
    expect(result.is_ai_interpreted).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('falls back when the AI JSON violates the schema (bad severity)', async () => {
    mockAnthropicResponse(
      JSON.stringify({
        health_score: 80,
        issues: [
          {
            severity: 'catastrophic',
            title: 'x',
            plain_explanation: 'x',
            suggested_action: 'x',
            affected_area: 'Menu',
          },
        ],
      })
    );
    const result = await getAIHealthDiagnosis(CLEAN_FINDINGS, makeContext());
    expect(result.is_ai_interpreted).toBe(false);
  });

  it('falls back when health_score is out of range', async () => {
    mockAnthropicResponse(JSON.stringify({ health_score: 140, issues: [] }));
    const result = await getAIHealthDiagnosis(CLEAN_FINDINGS, makeContext());
    expect(result.is_ai_interpreted).toBe(false);
  });

  it('falls back when the API errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'server error',
    }) as any;
    const result = await getAIHealthDiagnosis(CLEAN_FINDINGS, makeContext());
    expect(result.is_ai_interpreted).toBe(false);
  });

  it('falls back without calling fetch when no API key is configured', async () => {
    process.env.ANTHROPIC_API_KEY = '';
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as any;
    const result = await getAIHealthDiagnosis(CLEAN_FINDINGS, makeContext());
    expect(result.is_ai_interpreted).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
