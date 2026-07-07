import { supabase } from '../config/supabase';

export async function isRawInputUsedInBatchProduction(
  branchId: number,
  itemId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('production_recipe_ratios')
    .select('id')
    .eq('branch_id', branchId)
    .eq('raw_item_id', itemId)
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return true;
}
