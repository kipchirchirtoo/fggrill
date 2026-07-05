-- =====================================================
-- HARD PURGE: FOOD CONTROL / DAILY CONTROL SYSTEM
-- Migration: 20260704_drop_food_control_system.sql
-- =====================================================

DROP TRIGGER IF EXISTS trigger_gen_catering_event_number ON catering_events;
DROP TRIGGER IF EXISTS trigger_update_buffet_updated_at ON buffets;
DROP TRIGGER IF EXISTS trigger_update_catering_event_updated_at ON catering_events;

DROP FUNCTION IF EXISTS generate_catering_event_number();
DROP FUNCTION IF EXISTS update_buffet_updated_at();
DROP FUNCTION IF EXISTS update_catering_event_updated_at();
DROP FUNCTION IF EXISTS get_stock_item_food_control_type(integer, text);

DROP VIEW IF EXISTS food_control_health_overview;
DROP VIEW IF EXISTS daily_control_summary;

DROP TABLE IF EXISTS variance_anomaly_flags CASCADE;
DROP TABLE IF EXISTS food_control_processing_runs CASCADE;
DROP TABLE IF EXISTS daily_control_snapshots CASCADE;
DROP TABLE IF EXISTS kitchen_shift_controls CASCADE;
DROP TABLE IF EXISTS food_control_variance CASCADE;
DROP TABLE IF EXISTS shift_financials CASCADE;
DROP TABLE IF EXISTS branch_food_control_config CASCADE;
DROP TABLE IF EXISTS food_control_direct_items CASCADE;
DROP TABLE IF EXISTS food_control_exempt_items CASCADE;
DROP TABLE IF EXISTS catering_stock_allocations CASCADE;
DROP TABLE IF EXISTS catering_menu_items CASCADE;
DROP TABLE IF EXISTS catering_events CASCADE;
DROP TABLE IF EXISTS buffet_menu_items CASCADE;
DROP TABLE IF EXISTS buffets CASCADE;
DROP TABLE IF EXISTS kitchen_food_control_logs CASCADE;
DROP TABLE IF EXISTS kitchen_food_controls CASCADE;
