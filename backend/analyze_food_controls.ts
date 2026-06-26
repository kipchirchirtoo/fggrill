import { supabase } from './src/config/supabase';

async function run() {
  const { data: branchData } = await supabase
    .from('branches')
    .select('id, name')
    .ilike('name', '%bomet%')
    .limit(1)
    .single();

  const branchId = branchData.id;

  const { data: foodControls } = await supabase
    .from('kitchen_food_controls')
    .select('id, raw_item_name, produced_item_name, raw_quantity, raw_unit, produced_portions');

  const { data: outlets } = await supabase
    .from('pos_outlets')
    .select('id, name')
    .eq('branch_id', branchId)
    .ilike('outlet_type', '%restaurant%');
    
  let posItems = [];
  if (outlets && outlets.length > 0) {
    const outletIds = outlets.map(o => o.id);
    const { data: items } = await supabase
      .from('pos_outlet_items')
      .select('id, name, category, selling_price')
      .in('pos_outlet_id', outletIds)
      .eq('is_active', true);
    if (items) posItems = items;
  }

  const suggestions = foodControls.map(fc => {
      const matchStr = fc.produced_item_name.toLowerCase();
      // Simple heuristic
      const matches = posItems.filter(pi => {
          const piname = pi.name.toLowerCase();
          if (piname.includes('beef') && matchStr.includes('beef')) return true;
          if (piname.includes('mbuzi') && matchStr.includes('mbuzi')) return true;
          if (piname.includes('samosa') && matchStr.includes('samosa')) return true;
          if (piname.includes('chapati') && matchStr.includes('chapati')) return true;
          if (piname.includes('tea') && matchStr.includes('tea')) return true;
          if (piname.includes('ugali') && matchStr.includes('ugali')) return true;
          if (piname.includes('chicken') && matchStr.includes('chicken')) return true;
          if (piname.includes('chips') && matchStr.includes('chips')) return true;
          if (piname.includes('rice') && matchStr.includes('rice')) return true;
          if (piname.includes('pilau') && matchStr.includes('pilau')) return true;
          return false;
      });
      return {
          produced: fc.produced_item_name,
          matches: matches.map(m => m.name)
      };
  });

  console.log(JSON.stringify(suggestions, null, 2));
}
run();
