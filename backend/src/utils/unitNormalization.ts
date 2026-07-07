import { supabase } from '../config/supabase';

export function normalizeUnit(unit: string): string {
  if (!unit) return '';
  const trimmed = unit.trim().toLowerCase();
  if (trimmed === 'g' || trimmed === 'gram' || trimmed === 'grams') return 'g';
  if (trimmed === 'kg' || trimmed === 'kilogram' || trimmed === 'kilograms') return 'kg';
  if (trimmed === 'ml' || trimmed === 'milliliter' || trimmed === 'milliliters' || trimmed === 'millilitres') return 'ml';
  if (trimmed === 'l' || trimmed === 'liter' || trimmed === 'liters' || trimmed === 'litre' || trimmed === 'litres') return 'l';
  if (trimmed === 'pcs' || trimmed === 'piece' || trimmed === 'pieces' || trimmed === 'pc') return 'pieces';
  return trimmed;
}

export async function normalizeQty(
  qty: number,
  fromUnit: string,
  baseUnit: string,
  itemId: string,
  branchId: number
): Promise<number> {
  const normFrom = normalizeUnit(fromUnit);
  const normBase = normalizeUnit(baseUnit);

  if (normFrom === normBase) {
    return qty;
  }

  // 1. Metric standard conversions
  if (normFrom === 'kg' && normBase === 'g') return qty * 1000;
  if (normFrom === 'g' && normBase === 'kg') return qty / 1000;
  if (normFrom === 'l' && normBase === 'ml') return qty * 1000;
  if (normFrom === 'ml' && normBase === 'l') return qty / 1000;

  // 2. Query unit_conversions for item-specific and branch-specific rules
  const { data: convs } = await supabase
    .from('unit_conversions')
    .select('*')
    .eq('active', true);

  if (convs && convs.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const findMatch = (bId: number | null, iId: string | null): any => {
      return convs.find(c => 
        normalizeUnit(c.from_unit) === normFrom && 
        normalizeUnit(c.to_unit) === normBase && 
        c.branch_id === bId && 
        c.stock_item_id === iId
      );
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const findMatchInverse = (bId: number | null, iId: string | null): any => {
      return convs.find(c => 
        normalizeUnit(c.from_unit) === normBase && 
        normalizeUnit(c.to_unit) === normFrom && 
        c.branch_id === bId && 
        c.stock_item_id === iId
      );
    };

    const match = findMatch(branchId, itemId) || findMatch(null, itemId) || findMatch(branchId, null) || findMatch(null, null);
    if (match) {
      return qty * Number(match.conversion_factor);
    }

    const inverseMatch = findMatchInverse(branchId, itemId) || findMatchInverse(null, itemId) || findMatchInverse(branchId, null) || findMatchInverse(null, null);
    if (inverseMatch) {
      return qty / Number(inverseMatch.conversion_factor);
    }
  }

  return qty;
}
