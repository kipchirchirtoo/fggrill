require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function introspect() {
  const { data: sample } = await supabase.from('pos_outlet_items').select('*').limit(1);
  console.log("Sample columns:", Object.keys(sample[0]));
  
  // Verify outlet
  const { data: outlet } = await supabase.from('pos_outlets').select('*').eq('id', '9ebb1fc0-1716-4db7-80e8-6c727a05213c').single();
  console.log("Kaplong Restaurant Outlet verified:", outlet);
}

introspect().catch(console.error);
