import { supabase } from './src/config/supabase';

async function main() {
  const query = `
    SELECT 
      event_object_table AS table_name,
      trigger_name,
      action_statement,
      action_timing
    FROM information_schema.triggers
    WHERE event_object_table IN ('purchase_orders', 'store_purchase_orders')
    ORDER BY event_object_table, trigger_name
  `.trim();

  try {
    const { data, error } = await supabase.rpc('run_dynamic_query', { query });
    if (error) {
      console.error("Supabase RPC error:", error);
    } else {
      console.log("Triggers:", JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("Exception:", err);
  } finally {
    process.exit(0);
  }
}

main();
