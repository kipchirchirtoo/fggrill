// NOTE: The following tables MUST have Supabase Realtime enabled in the Supabase Dashboard:
// - public.restaurant_orders
// - public.restaurant_order_items
// - public.pos_shift_orders
// - public.pos_item_void_requests
// - public.notifications (see backend/database/migrations/20260813_enable_notifications_realtime.sql)

class RealtimeChannelKeys {
  static String ordersChannel(int branchId) => 'branch_${branchId}_orders';
  static String voidsChannel(int branchId) => 'branch_${branchId}_voids';
  static String notificationsChannel(String userId) => 'user_${userId}_notifications';

  static const String restaurantOrdersTable = 'restaurant_orders';
  static const String restaurantOrderItemsTable = 'restaurant_order_items';
  static const String posShiftOrdersTable = 'pos_shift_orders';
  static const String posItemVoidRequestsTable = 'pos_item_void_requests';
  static const String notificationsTable = 'notifications';
}
