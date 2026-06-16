require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  try {
    const { data, error } = await supabase.rpc('list_tables');
    if (error) {
      // Fallback: query information_schema
      const { data: tables, error: e2 } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .ilike('table_name', '%stock%');
      if (e2) console.error('Error:', e2.message);
      else tables.forEach(t => console.log(t.table_name));
    } else {
      data.forEach(t => console.log(t));
    }
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

test();
