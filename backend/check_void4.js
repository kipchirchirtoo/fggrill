const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  // Test void_acknowledged requests - find the real order to check amounts
  const { data: voidAck } = await supabase
    .from("pos_item_void_requests")
    .select("id, item_name, unit_price, qty_to_void, order_id, cashier_acknowledged_at, created_at")
    .eq("status", "void_acknowledged")
    .limit(2);
  
  for (const r of (voidAck || [])) {
    console.log("\n--- void_acknowledged request ---");
    console.log("item_name:", r.item_name, "qty_to_void:", r.qty_to_void, "unit_price:", r.unit_price);
    console.log("cashier_acknowledged_at:", r.cashier_acknowledged_at);
    const { data: order } = await supabase
      .from("pos_shift_orders")
      .select("id, total_amount, balance_amount, items")
      .eq("id", r.order_id)
      .single();
    if (order) {
      console.log("order total_amount:", order.total_amount, "balance_amount:", order.balance_amount);
      const item = (order.items || [])[0];
      console.log("item[0] active_qty:", item?.active_qty, "voided_qty:", item?.voided_qty, "void_pending_approval:", item?.void_pending_approval);
    }
  }
  
  // Check void log has bill_code field
  const { data: logs } = await supabase.from("pos_item_void_log").select("*").limit(2);
  console.log("\npos_item_void_log sample:", JSON.stringify(logs?.[0], null, 2));
}
main().catch(console.error);
