# Missing Indexes Report

Generated: 2026-06-14T16:30:53.317Z

| DB |Table |Column(s) |Recommended Index |Reason |
| --- |--- |--- |--- |--- |
| DATABASE_URL |accounting_bank_transactions |bank_account_id |idx_accounting_bank_transactions_bank_account_id |FK accounting_bank_transactions_bank_account_id_fkey should have an index on the referencing side. |
| DATABASE_URL |accounting_budgets |account_id |idx_accounting_budgets_account_id |FK accounting_budgets_account_id_fkey should have an index on the referencing side. |
| DATABASE_URL |accounting_chart_of_accounts |parent_account_id |idx_accounting_chart_of_accounts_parent_account_id |FK accounting_chart_of_accounts_parent_account_id_fkey should have an index on the referencing side. |
| DATABASE_URL |accounting_journal_entries |branch_id |idx_accounting_journal_entries_branch_id |FK accounting_journal_entries_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |accounting_journal_lines |account_id |idx_accounting_journal_lines_account_id |FK accounting_journal_lines_account_id_fkey should have an index on the referencing side. |
| DATABASE_URL |accounting_journal_lines |journal_entry_id |idx_accounting_journal_lines_journal_entry_id |FK accounting_journal_lines_journal_entry_id_fkey should have an index on the referencing side. |
| DATABASE_URL |amenity_bookings |amenity_id |idx_amenity_bookings_amenity_id |FK amenity_bookings_amenity_id_fkey should have an index on the referencing side. |
| DATABASE_URL |amenity_bookings |booking_id |idx_amenity_bookings_booking_id |FK amenity_bookings_booking_id_fkey should have an index on the referencing side. |
| DATABASE_URL |audit_exceptions |audit_session_id |idx_audit_exceptions_audit_session_id |FK audit_exceptions_audit_session_id_fkey should have an index on the referencing side. |
| DATABASE_URL |audit_exceptions |branch_id |idx_audit_exceptions_branch_id |FK audit_exceptions_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |audit_findings |audit_plan_id |idx_audit_findings_audit_plan_id |FK audit_findings_audit_plan_id_fkey should have an index on the referencing side. |
| DATABASE_URL |audit_night_sessions |branch_id |idx_audit_night_sessions_branch_id |FK audit_night_sessions_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |automation_runs |branch_id |idx_automation_runs_branch_id |FK automation_runs_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |banking_transactions |approved_by |idx_banking_transactions_approved_by |FK banking_transactions_approved_by_fkey should have an index on the referencing side. |
| DATABASE_URL |banking_transactions |reconciled_by |idx_banking_transactions_reconciled_by |FK banking_transactions_reconciled_by_fkey should have an index on the referencing side. |
| DATABASE_URL |banking_transactions |recorded_by |idx_banking_transactions_recorded_by |FK banking_transactions_recorded_by_fkey should have an index on the referencing side. |
| DATABASE_URL |bar_drinks |branch_id |idx_bar_drinks_branch_id |FK fk_bar_drinks_branch should have an index on the referencing side. |
| DATABASE_URL |bar_order_items |order_id |idx_bar_order_items_order_id |FK bar_order_items_order_id_fkey should have an index on the referencing side. |
| DATABASE_URL |bar_orders |credit_bill_id |idx_bar_orders_credit_bill_id |FK bar_orders_credit_bill_id_fkey should have an index on the referencing side. |
| DATABASE_URL |bar_orders |matched_transaction_id |idx_bar_orders_matched_transaction_id |FK bar_orders_matched_transaction_id_fkey should have an index on the referencing side. |
| DATABASE_URL |bar_orders |outlet_id |idx_bar_orders_outlet_id |FK bar_orders_outlet_id_fkey should have an index on the referencing side. |
| DATABASE_URL |bar_orders |outlet_shift_id |idx_bar_orders_outlet_shift_id |FK bar_orders_outlet_shift_id_fkey should have an index on the referencing side. |
| DATABASE_URL |bar_orders |created_by |idx_bar_orders_created_by |FK fk_bar_orders_waiter should have an index on the referencing side. |
| DATABASE_URL |bar_stock |drink_id |idx_bar_stock_drink_id |FK bar_stock_drink_id_fkey should have an index on the referencing side. |
| DATABASE_URL |bar_stock_logs |drink_id |idx_bar_stock_logs_drink_id |FK bar_stock_logs_drink_id_fkey should have an index on the referencing side. |
| DATABASE_URL |bar_stock_logs |stock_id |idx_bar_stock_logs_stock_id |FK bar_stock_logs_stock_id_fkey should have an index on the referencing side. |
| DATABASE_URL |bar_stock_records |branch_id |idx_bar_stock_records_branch_id |FK bar_stock_records_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |bar_stock_records |drink_id |idx_bar_stock_records_drink_id |FK bar_stock_records_drink_id_fkey should have an index on the referencing side. |
| DATABASE_URL |bar_stock_records |inventory_item_id |idx_bar_stock_records_inventory_item_id |FK bar_stock_records_inventory_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |bar_tab_items |tab_id |idx_bar_tab_items_tab_id |FK bar_tab_items_tab_id_fkey should have an index on the referencing side. |
| DATABASE_URL |bar_tabs |branch_id |idx_bar_tabs_branch_id |FK fk_bar_tabs_branch should have an index on the referencing side. |
| DATABASE_URL |bar_tabs |closed_by |idx_bar_tabs_closed_by |FK fk_bar_tabs_closed_by should have an index on the referencing side. |
| DATABASE_URL |bar_tabs |created_by |idx_bar_tabs_created_by |FK fk_bar_tabs_created_by should have an index on the referencing side. |
| DATABASE_URL |branch_payment_receipts |generated_by |idx_branch_payment_receipts_generated_by |FK branch_payment_receipts_generated_by_fkey should have an index on the referencing side. |
| DATABASE_URL |branch_payments |created_by |idx_branch_payments_created_by |FK branch_payments_created_by_fkey should have an index on the referencing side. |
| DATABASE_URL |budget_adjustments |adjusted_by |idx_budget_adjustments_adjusted_by |FK budget_adjustments_adjusted_by_fkey should have an index on the referencing side. |
| DATABASE_URL |budget_adjustments |approved_by |idx_budget_adjustments_approved_by |FK budget_adjustments_approved_by_fkey should have an index on the referencing side. |
| DATABASE_URL |budget_categories |parent_id |idx_budget_categories_parent_id |FK budget_categories_parent_id_fkey should have an index on the referencing side. |
| DATABASE_URL |budgets |department_id |idx_budgets_department_id |FK budgets_department_id_fkey should have an index on the referencing side. |
| DATABASE_URL |buffet_menu_items |recipe_id |idx_buffet_menu_items_recipe_id |FK buffet_menu_items_recipe_id_fkey should have an index on the referencing side. |
| DATABASE_URL |cash_drawer_logs |shift_id |idx_cash_drawer_logs_shift_id |FK cash_drawer_logs_shift_id_fkey should have an index on the referencing side. |
| DATABASE_URL |cashier_shifts |reviewed_by |idx_cashier_shifts_reviewed_by |FK cashier_shifts_reviewed_by_fkey should have an index on the referencing side. |
| DATABASE_URL |cashier_transactions |outlet_id |idx_cashier_transactions_outlet_id |FK cashier_transactions_outlet_id_fkey should have an index on the referencing side. |
| DATABASE_URL |cashier_transactions |outlet_shift_id |idx_cashier_transactions_outlet_shift_id |FK cashier_transactions_outlet_shift_id_fkey should have an index on the referencing side. |
| DATABASE_URL |catering_events |catering_manager |idx_catering_events_catering_manager |FK catering_events_catering_manager_fkey should have an index on the referencing side. |
| DATABASE_URL |catering_events |created_by |idx_catering_events_created_by |FK catering_events_created_by_fkey should have an index on the referencing side. |
| DATABASE_URL |catering_events |lead_chef |idx_catering_events_lead_chef |FK catering_events_lead_chef_fkey should have an index on the referencing side. |
| DATABASE_URL |catering_menu_items |recipe_id |idx_catering_menu_items_recipe_id |FK catering_menu_items_recipe_id_fkey should have an index on the referencing side. |
| DATABASE_URL |catering_stock_allocations |allocated_by |idx_catering_stock_allocations_allocated_by |FK catering_stock_allocations_allocated_by_fkey should have an index on the referencing side. |
| DATABASE_URL |catering_stock_allocations |ingredient_id |idx_catering_stock_allocations_ingredient_id |FK catering_stock_allocations_ingredient_id_fkey should have an index on the referencing side. |
| DATABASE_URL |channel_messages |reply_to |idx_channel_messages_reply_to |FK channel_messages_reply_to_fkey should have an index on the referencing side. |
| DATABASE_URL |conference_hall_bookings |conference_hall_id |idx_conference_hall_bookings_conference_hall_id |FK conference_hall_bookings_conference_hall_id_fkey should have an index on the referencing side. |
| DATABASE_URL |conference_halls |branch_id |idx_conference_halls_branch_id |FK conference_halls_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |consumption_records |item_id |idx_consumption_records_item_id |FK consumption_records_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |customer_invoice_items |invoice_id |idx_customer_invoice_items_invoice_id |FK customer_invoice_items_invoice_id_fkey should have an index on the referencing side. |
| DATABASE_URL |customer_invoice_payments |invoice_id |idx_customer_invoice_payments_invoice_id |FK customer_invoice_payments_invoice_id_fkey should have an index on the referencing side. |
| DATABASE_URL |delivery_schedules |default_driver_id |idx_delivery_schedules_default_driver_id |FK delivery_schedules_default_driver_id_fkey should have an index on the referencing side. |
| DATABASE_URL |delivery_schedules |default_vehicle_id |idx_delivery_schedules_default_vehicle_id |FK delivery_schedules_default_vehicle_id_fkey should have an index on the referencing side. |
| DATABASE_URL |department_inventory_ledger |inventory_movement_id |idx_department_inventory_ledger_inventory_movement_id |FK department_inventory_ledger_inventory_movement_id_fkey should have an index on the referencing side. |
| DATABASE_URL |department_inventory_ledger |performed_by |idx_department_inventory_ledger_performed_by |FK department_inventory_ledger_performed_by_fkey should have an index on the referencing side. |
| DATABASE_URL |department_request_logs |department_account_id |idx_department_request_logs_department_account_id |FK department_request_logs_department_account_id_fkey should have an index on the referencing side. |
| DATABASE_URL |departments |branch_id |idx_departments_branch_id |FK departments_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |discrepancy_flags |accountant_id |idx_discrepancy_flags_accountant_id |FK discrepancy_flags_accountant_id_fkey should have an index on the referencing side. |
| DATABASE_URL |discrepancy_flags |auditor_id |idx_discrepancy_flags_auditor_id |FK discrepancy_flags_auditor_id_fkey should have an index on the referencing side. |
| DATABASE_URL |discrepancy_flags |director_id |idx_discrepancy_flags_director_id |FK discrepancy_flags_director_id_fkey should have an index on the referencing side. |
| DATABASE_URL |dispatch_items |dispatch_id |idx_dispatch_items_dispatch_id |FK dispatch_items_dispatch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |documents |guest_id |idx_documents_guest_id |FK documents_guest_id_fkey should have an index on the referencing side. |
| DATABASE_URL |documents |reservation_id |idx_documents_reservation_id |FK documents_reservation_id_fkey should have an index on the referencing side. |
| DATABASE_URL |employee_credit_payments |credit_bill_id |idx_employee_credit_payments_credit_bill_id |FK employee_credit_payments_credit_bill_id_fkey should have an index on the referencing side. |
| DATABASE_URL |employee_tasks |branch_id |idx_employee_tasks_branch_id |FK employee_tasks_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |employee_time_clock |branch_id |idx_employee_time_clock_branch_id |FK employee_time_clock_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |expense_categories |parent_category_id |idx_expense_categories_parent_category_id |FK expense_categories_parent_category_id_fkey should have an index on the referencing side. |
| DATABASE_URL |expenses |department_id |idx_expenses_department_id |FK expenses_department_id_fkey should have an index on the referencing side. |
| DATABASE_URL |finance_daily_log_lines |log_id |idx_finance_daily_log_lines_log_id |FK finance_daily_log_lines_log_id_fkey should have an index on the referencing side. |
| DATABASE_URL |financial_audit_logs |branch_id |idx_financial_audit_logs_branch_id |FK financial_audit_logs_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |float_history |transaction_id |idx_float_history_transaction_id |FK float_history_transaction_id_fkey should have an index on the referencing side. |
| DATABASE_URL |folios |guest_id |idx_folios_guest_id |FK folios_guest_id_fkey should have an index on the referencing side. |
| DATABASE_URL |folios |reservation_id |idx_folios_reservation_id |FK folios_reservation_id_fkey should have an index on the referencing side. |
| DATABASE_URL |food_control_variance |ingredient_id |idx_food_control_variance_ingredient_id |FK food_control_variance_ingredient_id_fkey should have an index on the referencing side. |
| DATABASE_URL |grn_items |grn_id |idx_grn_items_grn_id |FK grn_items_grn_id_fkey should have an index on the referencing side. |
| DATABASE_URL |grn_items |item_id |idx_grn_items_item_id |FK grn_items_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |guest_documents |guest_id |idx_guest_documents_guest_id |FK guest_documents_guest_id_fkey should have an index on the referencing side. |
| DATABASE_URL |guest_documents |reservation_id |idx_guest_documents_reservation_id |FK guest_documents_reservation_id_fkey should have an index on the referencing side. |
| DATABASE_URL |guest_feedback |booking_id |idx_guest_feedback_booking_id |FK guest_feedback_booking_id_fkey should have an index on the referencing side. |
| DATABASE_URL |guest_feedback |branch_id |idx_guest_feedback_branch_id |FK guest_feedback_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |guest_loyalty_transactions |booking_id |idx_guest_loyalty_transactions_booking_id |FK guest_loyalty_transactions_booking_id_fkey should have an index on the referencing side. |
| DATABASE_URL |guest_messages |booking_id |idx_guest_messages_booking_id |FK guest_messages_booking_id_fkey should have an index on the referencing side. |
| DATABASE_URL |guest_messages |branch_id |idx_guest_messages_branch_id |FK guest_messages_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |guest_messages |parent_id |idx_guest_messages_parent_id |FK guest_messages_parent_id_fkey should have an index on the referencing side. |
| DATABASE_URL |guest_requests |branch_id |idx_guest_requests_branch_id |FK guest_requests_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_booking_sync |room_id |idx_hk_booking_sync_room_id |FK hk_booking_sync_room_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_cart_inventory |branch_id |idx_hk_cart_inventory_branch_id |FK hk_cart_inventory_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_checklist_templates |branch_id |idx_hk_checklist_templates_branch_id |FK hk_checklist_templates_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_green_guests |room_id |idx_hk_green_guests_room_id |FK hk_green_guests_room_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_guest_preferences |room_id |idx_hk_guest_preferences_room_id |FK hk_guest_preferences_room_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_guest_requests |assigned_to |idx_hk_guest_requests_assigned_to |FK hk_guest_requests_assigned_to_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_guest_requests |branch_id |idx_hk_guest_requests_branch_id |FK hk_guest_requests_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_guest_service_requests |assigned_to |idx_hk_guest_service_requests_assigned_to |FK hk_guest_service_requests_assigned_to_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_guest_service_requests |branch_id |idx_hk_guest_service_requests_branch_id |FK hk_guest_service_requests_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_guest_service_requests |room_id |idx_hk_guest_service_requests_room_id |FK hk_guest_service_requests_room_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_inspections |branch_id |idx_hk_inspections_branch_id |FK hk_inspections_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_inspections |inspector_id |idx_hk_inspections_inspector_id |FK hk_inspections_inspector_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_leave_requests |staff_id |idx_hk_leave_requests_staff_id |FK hk_leave_requests_staff_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_linen_inventory |branch_id |idx_hk_linen_inventory_branch_id |FK hk_linen_inventory_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_linen_inventory |current_room_id |idx_hk_linen_inventory_current_room_id |FK hk_linen_inventory_current_room_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_linen_transactions |linen_type_id |idx_hk_linen_transactions_linen_type_id |FK hk_linen_transactions_linen_type_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_linen_transactions |room_id |idx_hk_linen_transactions_room_id |FK hk_linen_transactions_room_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_lost_found |branch_id |idx_hk_lost_found_branch_id |FK hk_lost_found_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_lost_found |found_by |idx_hk_lost_found_found_by |FK hk_lost_found_found_by_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_maintenance_requests |branch_id |idx_hk_maintenance_requests_branch_id |FK hk_maintenance_requests_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_maintenance_requests |reported_by |idx_hk_maintenance_requests_reported_by |FK hk_maintenance_requests_reported_by_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_quality_alerts |branch_id |idx_hk_quality_alerts_branch_id |FK hk_quality_alerts_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_room_patterns |room_id |idx_hk_room_patterns_room_id |FK hk_room_patterns_room_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_schedules |staff_id |idx_hk_schedules_staff_id |FK hk_schedules_staff_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_shift_definitions |branch_id |idx_hk_shift_definitions_branch_id |FK hk_shift_definitions_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_shift_swaps |requester_id |idx_hk_shift_swaps_requester_id |FK hk_shift_swaps_requester_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_shift_swaps |target_staff_id |idx_hk_shift_swaps_target_staff_id |FK hk_shift_swaps_target_staff_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_staff_achievements |achievement_id |idx_hk_staff_achievements_achievement_id |FK hk_staff_achievements_achievement_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_staff_achievements |branch_id |idx_hk_staff_achievements_branch_id |FK hk_staff_achievements_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_staff_points |branch_id |idx_hk_staff_points_branch_id |FK hk_staff_points_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_staff_predictions |branch_id |idx_hk_staff_predictions_branch_id |FK hk_staff_predictions_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_staff_profiles |current_task_id |idx_hk_staff_profiles_current_task_id |FK fk_current_task should have an index on the referencing side. |
| DATABASE_URL |hk_staff_profiles |branch_id |idx_hk_staff_profiles_branch_id |FK hk_staff_profiles_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_staff_schedules |branch_id |idx_hk_staff_schedules_branch_id |FK hk_staff_schedules_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_supply_predictions |branch_id |idx_hk_supply_predictions_branch_id |FK hk_supply_predictions_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_supply_predictions |supply_id |idx_hk_supply_predictions_supply_id |FK hk_supply_predictions_supply_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_sustainability_metrics |branch_id |idx_hk_sustainability_metrics_branch_id |FK hk_sustainability_metrics_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_sustainability_metrics |room_id |idx_hk_sustainability_metrics_room_id |FK hk_sustainability_metrics_room_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_task_checklists |task_id |idx_hk_task_checklists_task_id |FK hk_task_checklists_task_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_task_checklists |template_id |idx_hk_task_checklists_template_id |FK hk_task_checklists_template_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hk_tasks |branch_id |idx_hk_tasks_branch_id |FK hk_tasks_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |hotel_amenities |branch_id |idx_hotel_amenities_branch_id |FK hotel_amenities_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |housekeeping_logs |reservation_id |idx_housekeeping_logs_reservation_id |FK housekeeping_logs_reservation_id_fkey should have an index on the referencing side. |
| DATABASE_URL |housekeeping_supply_requests |supply_id |idx_housekeeping_supply_requests_supply_id |FK housekeeping_supply_requests_supply_id_fkey should have an index on the referencing side. |
| DATABASE_URL |housekeeping_supply_transactions |supply_id |idx_housekeeping_supply_transactions_supply_id |FK housekeeping_supply_transactions_supply_id_fkey should have an index on the referencing side. |
| DATABASE_URL |housekeeping_task_issues |task_id |idx_housekeeping_task_issues_task_id |FK housekeeping_task_issues_task_id_fkey should have an index on the referencing side. |
| DATABASE_URL |inter_branch_transfers |from_branch_id |idx_inter_branch_transfers_from_branch_id |FK inter_branch_transfers_from_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |inter_branch_transfers |to_branch_id |idx_inter_branch_transfers_to_branch_id |FK inter_branch_transfers_to_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_adjustments |item_id |idx_inventory_adjustments_item_id |FK inventory_adjustments_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_alerts |created_by |idx_inventory_alerts_created_by |FK inventory_alerts_created_by_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_alerts |item_id |idx_inventory_alerts_item_id |FK inventory_alerts_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_alerts |location_id |idx_inventory_alerts_location_id |FK inventory_alerts_location_id_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_audit_log |actor_id |idx_inventory_audit_log_actor_id |FK inventory_audit_log_actor_id_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_audit_logs |actor_id |idx_inventory_audit_logs_actor_id |FK inventory_audit_logs_actor_id_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_audit_logs |item_id |idx_inventory_audit_logs_item_id |FK inventory_audit_logs_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_audit_logs |location_id |idx_inventory_audit_logs_location_id |FK inventory_audit_logs_location_id_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_balances |last_movement_id |idx_inventory_balances_last_movement_id |FK inventory_balances_last_movement_id_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_core_batches |created_by |idx_inventory_core_batches_created_by |FK inventory_core_batches_created_by_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_count_items |count_id |idx_inventory_count_items_count_id |FK inventory_count_items_count_id_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_count_items |item_id |idx_inventory_count_items_item_id |FK inventory_count_items_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_governance_reviews |assigned_to |idx_inventory_governance_reviews_assigned_to |FK inventory_governance_reviews_assigned_to_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_governance_reviews |reviewed_by |idx_inventory_governance_reviews_reviewed_by |FK inventory_governance_reviews_reviewed_by_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_item_catalog |created_by |idx_inventory_item_catalog_created_by |FK inventory_item_catalog_created_by_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_items |supplier_id |idx_inventory_items_supplier_id |FK inventory_items_supplier_id_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_locations |branch_id |idx_inventory_locations_branch_id |FK inventory_locations_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_locations |created_by |idx_inventory_locations_created_by |FK inventory_locations_created_by_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_movements |actor_id |idx_inventory_movements_actor_id |FK inventory_movements_actor_id_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_movements |batch_id |idx_inventory_movements_batch_id |FK inventory_movements_batch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_movements |reverses_movement_id |idx_inventory_movements_reverses_movement_id |FK inventory_movements_reverses_movement_id_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_reservations |batch_id |idx_inventory_reservations_batch_id |FK inventory_reservations_batch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_reservations |released_by |idx_inventory_reservations_released_by |FK inventory_reservations_released_by_fkey should have an index on the referencing side. |
| DATABASE_URL |inventory_reservations |reserved_by |idx_inventory_reservations_reserved_by |FK inventory_reservations_reserved_by_fkey should have an index on the referencing side. |
| DATABASE_URL |kitchen_daily_variance |reason_id |idx_kitchen_daily_variance_reason_id |FK kitchen_daily_variance_reason_id_fkey should have an index on the referencing side. |
| DATABASE_URL |kitchen_expected_portions |food_control_rule_id |idx_kitchen_expected_portions_food_control_rule_id |FK kitchen_expected_portions_food_control_rule_id_fkey should have an index on the referencing side. |
| DATABASE_URL |kitchen_grn_items |ledger_entry_id |idx_kitchen_grn_items_ledger_entry_id |FK kitchen_grn_items_ledger_entry_id_fkey should have an index on the referencing side. |
| DATABASE_URL |kitchen_portion_tracking |receipt_id |idx_kitchen_portion_tracking_receipt_id |FK kitchen_portion_tracking_receipt_id_fkey should have an index on the referencing side. |
| DATABASE_URL |kitchen_production_batches |approved_by |idx_kitchen_production_batches_approved_by |FK kitchen_production_batches_approved_by_fkey should have an index on the referencing side. |
| DATABASE_URL |kitchen_production_batches |created_by |idx_kitchen_production_batches_created_by |FK kitchen_production_batches_created_by_fkey should have an index on the referencing side. |
| DATABASE_URL |kitchen_production_inputs |item_sku |idx_kitchen_production_inputs_item_sku |FK kitchen_production_inputs_item_sku_fkey should have an index on the referencing side. |
| DATABASE_URL |kitchen_store_issue_items |issue_id |idx_kitchen_store_issue_items_issue_id |FK kitchen_store_issue_items_issue_id_fkey should have an index on the referencing side. |
| DATABASE_URL |kitchen_store_issue_items |item_id |idx_kitchen_store_issue_items_item_id |FK kitchen_store_issue_items_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |kitchen_store_issue_items |recipe_id |idx_kitchen_store_issue_items_recipe_id |FK kitchen_store_issue_items_recipe_id_fkey should have an index on the referencing side. |
| DATABASE_URL |kitchen_store_issues |branch_id |idx_kitchen_store_issues_branch_id |FK kitchen_store_issues_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |kitchen_usage |ledger_entry_id |idx_kitchen_usage_ledger_entry_id |FK kitchen_usage_ledger_entry_id_fkey should have an index on the referencing side. |
| DATABASE_URL |kitchen_usage |linked_menu_item_id |idx_kitchen_usage_linked_menu_item_id |FK kitchen_usage_linked_menu_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |kitchen_usage |recipe_id |idx_kitchen_usage_recipe_id |FK kitchen_usage_recipe_id_fkey should have an index on the referencing side. |
| DATABASE_URL |kitchen_variances |branch_id |idx_kitchen_variances_branch_id |FK kitchen_variances_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |kitchen_variances |reason_id |idx_kitchen_variances_reason_id |FK kitchen_variances_reason_id_fkey should have an index on the referencing side. |
| DATABASE_URL |kitchen_variances |recipe_id |idx_kitchen_variances_recipe_id |FK kitchen_variances_recipe_id_fkey should have an index on the referencing side. |
| DATABASE_URL |kitchen_wastage |ledger_entry_id |idx_kitchen_wastage_ledger_entry_id |FK kitchen_wastage_ledger_entry_id_fkey should have an index on the referencing side. |
| DATABASE_URL |lina_remediation_executions |proposal_id |idx_lina_remediation_executions_proposal_id |FK lina_remediation_executions_proposal_id_fkey should have an index on the referencing side. |
| DATABASE_URL |lina_system_snapshots |branch_id |idx_lina_system_snapshots_branch_id |FK lina_system_snapshots_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |maintenance_asset_history |asset_id |idx_maintenance_asset_history_asset_id |FK maintenance_asset_history_asset_id_fkey should have an index on the referencing side. |
| DATABASE_URL |maintenance_equipment |category_id |idx_maintenance_equipment_category_id |FK maintenance_equipment_category_id_fkey should have an index on the referencing side. |
| DATABASE_URL |maintenance_issues |task_id |idx_maintenance_issues_task_id |FK maintenance_issues_task_id_fkey should have an index on the referencing side. |
| DATABASE_URL |maintenance_part_transactions |part_id |idx_maintenance_part_transactions_part_id |FK maintenance_part_transactions_part_id_fkey should have an index on the referencing side. |
| DATABASE_URL |maintenance_part_transactions |work_order_id |idx_maintenance_part_transactions_work_order_id |FK maintenance_part_transactions_work_order_id_fkey should have an index on the referencing side. |
| DATABASE_URL |maintenance_part_usage |task_id |idx_maintenance_part_usage_task_id |FK maintenance_part_usage_task_id_fkey should have an index on the referencing side. |
| DATABASE_URL |maintenance_parts_transactions |part_id |idx_maintenance_parts_transactions_part_id |FK maintenance_parts_transactions_part_id_fkey should have an index on the referencing side. |
| DATABASE_URL |maintenance_preventive_schedules |asset_id |idx_maintenance_preventive_schedules_asset_id |FK maintenance_preventive_schedules_asset_id_fkey should have an index on the referencing side. |
| DATABASE_URL |maintenance_schedules |equipment_id |idx_maintenance_schedules_equipment_id |FK maintenance_schedules_equipment_id_fkey should have an index on the referencing side. |
| DATABASE_URL |maintenance_task_history |task_id |idx_maintenance_task_history_task_id |FK maintenance_task_history_task_id_fkey should have an index on the referencing side. |
| DATABASE_URL |maintenance_work_order_tasks |work_order_id |idx_maintenance_work_order_tasks_work_order_id |FK maintenance_work_order_tasks_work_order_id_fkey should have an index on the referencing side. |
| DATABASE_URL |menu_item_branch_pricing |updated_by |idx_menu_item_branch_pricing_updated_by |FK menu_item_branch_pricing_updated_by_fkey should have an index on the referencing side. |
| DATABASE_URL |mpesa_transaction_logs |branch_id |idx_mpesa_transaction_logs_branch_id |FK mpesa_transaction_logs_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |outside_catering_bookings |branch_id |idx_outside_catering_bookings_branch_id |FK outside_catering_bookings_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |payroll_policies |branch_id |idx_payroll_policies_branch_id |FK payroll_policies_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |payroll_records |branch_id |idx_payroll_records_branch_id |FK payroll_records_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |petty_cash_ledger |branch_id |idx_petty_cash_ledger_branch_id |FK petty_cash_ledger_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |pos_inventory_mappings |created_by |idx_pos_inventory_mappings_created_by |FK pos_inventory_mappings_created_by_fkey should have an index on the referencing side. |
| DATABASE_URL |pos_outlet_shifts |branch_id |idx_pos_outlet_shifts_branch_id |FK pos_outlet_shifts_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |pos_shift_orders |staff_credit_bill_id |idx_pos_shift_orders_staff_credit_bill_id |FK pos_shift_orders_staff_credit_bill_id_fkey should have an index on the referencing side. |
| DATABASE_URL |pos_shift_payments |order_id |idx_pos_shift_payments_order_id |FK pos_shift_payments_order_id_fkey should have an index on the referencing side. |
| DATABASE_URL |pos_shift_payments |outlet_id |idx_pos_shift_payments_outlet_id |FK pos_shift_payments_outlet_id_fkey should have an index on the referencing side. |
| DATABASE_URL |pos_shift_payments |shift_id |idx_pos_shift_payments_shift_id |FK pos_shift_payments_shift_id_fkey should have an index on the referencing side. |
| DATABASE_URL |pos_shift_stock_counts |outlet_id |idx_pos_shift_stock_counts_outlet_id |FK pos_shift_stock_counts_outlet_id_fkey should have an index on the referencing side. |
| DATABASE_URL |pos_transaction_items |product_id |idx_pos_transaction_items_product_id |FK pos_transaction_items_product_id_fkey should have an index on the referencing side. |
| DATABASE_URL |pos_transaction_items |transaction_id |idx_pos_transaction_items_transaction_id |FK pos_transaction_items_transaction_id_fkey should have an index on the referencing side. |
| DATABASE_URL |pos_transactions |outlet_id |idx_pos_transactions_outlet_id |FK pos_transactions_outlet_id_fkey should have an index on the referencing side. |
| DATABASE_URL |pos_transactions |outlet_shift_id |idx_pos_transactions_outlet_shift_id |FK pos_transactions_outlet_shift_id_fkey should have an index on the referencing side. |
| DATABASE_URL |pos_void_requests |outlet_id |idx_pos_void_requests_outlet_id |FK pos_void_requests_outlet_id_fkey should have an index on the referencing side. |
| DATABASE_URL |pos_void_requests |shift_id |idx_pos_void_requests_shift_id |FK pos_void_requests_shift_id_fkey should have an index on the referencing side. |
| DATABASE_URL |purchase_order_items |item_id |idx_purchase_order_items_item_id |FK purchase_order_items_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |quotation_items |quotation_id |idx_quotation_items_quotation_id |FK quotation_items_quotation_id_fkey should have an index on the referencing side. |
| DATABASE_URL |quotations |converted_to_invoice_id |idx_quotations_converted_to_invoice_id |FK quotations_converted_to_invoice_id_fkey should have an index on the referencing side. |
| DATABASE_URL |quotations |customer_id |idx_quotations_customer_id |FK quotations_customer_id_fkey should have an index on the referencing side. |
| DATABASE_URL |recipe_change_log |branch_id |idx_recipe_change_log_branch_id |FK recipe_change_log_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |report_jobs |branch_id |idx_report_jobs_branch_id |FK report_jobs_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |requisition_items |item_id |idx_requisition_items_item_id |FK requisition_items_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |requisition_items |requisition_id |idx_requisition_items_requisition_id |FK requisition_items_requisition_id_fkey should have an index on the referencing side. |
| DATABASE_URL |requisitions |purchase_order_id |idx_requisitions_purchase_order_id |FK requisitions_purchase_order_id_fkey should have an index on the referencing side. |
| DATABASE_URL |reservation_guests |guest_id |idx_reservation_guests_guest_id |FK reservation_guests_guest_id_fkey should have an index on the referencing side. |
| DATABASE_URL |reservation_guests |reservation_id |idx_reservation_guests_reservation_id |FK reservation_guests_reservation_id_fkey should have an index on the referencing side. |
| DATABASE_URL |reservations |rate_plan_id |idx_reservations_rate_plan_id |FK reservations_rate_plan_id_fkey should have an index on the referencing side. |
| DATABASE_URL |reservations |room_id |idx_reservations_room_id |FK reservations_room_id_fkey should have an index on the referencing side. |
| DATABASE_URL |reservations |room_type_id |idx_reservations_room_type_id |FK reservations_room_type_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_bar_inventory |supplier_id |idx_restaurant_bar_inventory_supplier_id |FK restaurant_bar_inventory_supplier_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_bill_payments |reversal_payment_id |idx_restaurant_bill_payments_reversal_payment_id |FK restaurant_bill_payments_reversal_payment_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_bill_splits |order_id |idx_restaurant_bill_splits_order_id |FK restaurant_bill_splits_order_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_bills |merged_into |idx_restaurant_bills_merged_into |FK restaurant_bills_merged_into_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_combo_items |combo_id |idx_restaurant_combo_items_combo_id |FK restaurant_combo_items_combo_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_combo_items |menu_item_id |idx_restaurant_combo_items_menu_item_id |FK restaurant_combo_items_menu_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_customer_feedback |order_id |idx_restaurant_customer_feedback_order_id |FK restaurant_customer_feedback_order_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_delivery_zones |branch_id |idx_restaurant_delivery_zones_branch_id |FK restaurant_delivery_zones_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_food_safety_checks |branch_id |idx_restaurant_food_safety_checks_branch_id |FK restaurant_food_safety_checks_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_inventory_batches |inventory_item_id |idx_restaurant_inventory_batches_inventory_item_id |FK restaurant_inventory_batches_inventory_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_inventory_batches |supplier_id |idx_restaurant_inventory_batches_supplier_id |FK restaurant_inventory_batches_supplier_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_inventory_items |supplier_id |idx_restaurant_inventory_items_supplier_id |FK restaurant_inventory_items_supplier_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_orders |credit_bill_id |idx_restaurant_orders_credit_bill_id |FK restaurant_orders_credit_bill_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_orders |delivery_driver_id |idx_restaurant_orders_delivery_driver_id |FK restaurant_orders_delivery_driver_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_orders |delivery_zone_id |idx_restaurant_orders_delivery_zone_id |FK restaurant_orders_delivery_zone_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_orders |discount_id |idx_restaurant_orders_discount_id |FK restaurant_orders_discount_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_orders |matched_transaction_id |idx_restaurant_orders_matched_transaction_id |FK restaurant_orders_matched_transaction_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_orders |outlet_id |idx_restaurant_orders_outlet_id |FK restaurant_orders_outlet_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_orders |outlet_shift_id |idx_restaurant_orders_outlet_shift_id |FK restaurant_orders_outlet_shift_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_pool_token_sales |branch_id |idx_restaurant_pool_token_sales_branch_id |FK restaurant_pool_token_sales_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_prep_stations |branch_id |idx_restaurant_prep_stations_branch_id |FK restaurant_prep_stations_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_purchase_order_items |inventory_item_id |idx_restaurant_purchase_order_items_inventory_item_id |FK restaurant_purchase_order_items_inventory_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_purchase_order_items |purchase_order_id |idx_restaurant_purchase_order_items_purchase_order_id |FK restaurant_purchase_order_items_purchase_order_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_purchase_orders |supplier_id |idx_restaurant_purchase_orders_supplier_id |FK restaurant_purchase_orders_supplier_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_recipe_ingredients |inventory_item_id |idx_restaurant_recipe_ingredients_inventory_item_id |FK restaurant_recipe_ingredients_inventory_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_recipe_ingredients |recipe_id |idx_restaurant_recipe_ingredients_recipe_id |FK restaurant_recipe_ingredients_recipe_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_recipes |menu_item_id |idx_restaurant_recipes_menu_item_id |FK restaurant_recipes_menu_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_reservations |branch_id |idx_restaurant_reservations_branch_id |FK restaurant_reservations_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_reservations |table_id |idx_restaurant_reservations_table_id |FK restaurant_reservations_table_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_sections |branch_id |idx_restaurant_sections_branch_id |FK restaurant_sections_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_server_sections |section_id |idx_restaurant_server_sections_section_id |FK restaurant_server_sections_section_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_split_payments |bill_split_id |idx_restaurant_split_payments_bill_split_id |FK restaurant_split_payments_bill_split_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_supplier_quality_ratings |supplier_id |idx_restaurant_supplier_quality_ratings_supplier_id |FK restaurant_supplier_quality_ratings_supplier_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_table_assignments |table_id |idx_restaurant_table_assignments_table_id |FK restaurant_table_assignments_table_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_tips |order_id |idx_restaurant_tips_order_id |FK restaurant_tips_order_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_voids_refunds |order_id |idx_restaurant_voids_refunds_order_id |FK restaurant_voids_refunds_order_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_voids_refunds |order_item_id |idx_restaurant_voids_refunds_order_item_id |FK restaurant_voids_refunds_order_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_waitlist |branch_id |idx_restaurant_waitlist_branch_id |FK restaurant_waitlist_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_waste_log |batch_id |idx_restaurant_waste_log_batch_id |FK restaurant_waste_log_batch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_waste_log |branch_id |idx_restaurant_waste_log_branch_id |FK restaurant_waste_log_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |restaurant_waste_log |inventory_item_id |idx_restaurant_waste_log_inventory_item_id |FK restaurant_waste_log_inventory_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |room_blocks |room_id |idx_room_blocks_room_id |FK room_blocks_room_id_fkey should have an index on the referencing side. |
| DATABASE_URL |rooms |assigned_attendant_id |idx_rooms_assigned_attendant_id |FK rooms_assigned_attendant_id_fkey should have an index on the referencing side. |
| DATABASE_URL |rooms |current_guest |idx_rooms_current_guest |FK rooms_current_guest_fkey should have an index on the referencing side. |
| DATABASE_URL |sales_payment_reconciliation |branch_id |idx_sales_payment_reconciliation_branch_id |FK sales_payment_reconciliation_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |sales_payment_reconciliation |receipt_id |idx_sales_payment_reconciliation_receipt_id |FK sales_payment_reconciliation_receipt_id_fkey should have an index on the referencing side. |
| DATABASE_URL |scheduled_reports |branch_id |idx_scheduled_reports_branch_id |FK scheduled_reports_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |service_bookings |service_id |idx_service_bookings_service_id |FK service_bookings_service_id_fkey should have an index on the referencing side. |
| DATABASE_URL |shift_swaps |original_shift_id |idx_shift_swaps_original_shift_id |FK shift_swaps_original_shift_id_fkey should have an index on the referencing side. |
| DATABASE_URL |shift_templates |branch_id |idx_shift_templates_branch_id |FK shift_templates_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |shift_transactions |sales_point_id |idx_shift_transactions_sales_point_id |FK shift_transactions_sales_point_id_fkey should have an index on the referencing side. |
| DATABASE_URL |simple_transfer_items |branch_id |idx_simple_transfer_items_branch_id |FK simple_transfer_items_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |sku_registry |category_code |idx_sku_registry_category_code |FK sku_registry_category_code_fkey should have an index on the referencing side. |
| DATABASE_URL |staff_advances |approved_by |idx_staff_advances_approved_by |FK staff_advances_approved_by_fkey should have an index on the referencing side. |
| DATABASE_URL |staff_credit_bill_payments |shift_id |idx_staff_credit_bill_payments_shift_id |FK staff_credit_bill_payments_shift_id_fkey should have an index on the referencing side. |
| DATABASE_URL |staff_credit_bills |paid_via_payroll_run_id |idx_staff_credit_bills_paid_via_payroll_run_id |FK staff_credit_bills_paid_via_payroll_run_id_fkey should have an index on the referencing side. |
| DATABASE_URL |staff_credit_bills |source_pos_payment_id |idx_staff_credit_bills_source_pos_payment_id |FK staff_credit_bills_source_pos_payment_id_fkey should have an index on the referencing side. |
| DATABASE_URL |staff_payroll_items |policy_id |idx_staff_payroll_items_policy_id |FK staff_payroll_items_policy_id_fkey should have an index on the referencing side. |
| DATABASE_URL |staff_shifts |shift_template_id |idx_staff_shifts_shift_template_id |FK staff_shifts_shift_template_id_fkey should have an index on the referencing side. |
| DATABASE_URL |stock_counts |verified_by |idx_stock_counts_verified_by |FK fk_stock_counts_verified_by should have an index on the referencing side. |
| DATABASE_URL |stock_issues |ingredient_id |idx_stock_issues_ingredient_id |FK stock_issues_ingredient_id_fkey should have an index on the referencing side. |
| DATABASE_URL |stock_requests |requested_by |idx_stock_requests_requested_by |FK stock_requests_requested_by_fkey should have an index on the referencing side. |
| DATABASE_URL |stock_requests |reviewed_by |idx_stock_requests_reviewed_by |FK stock_requests_reviewed_by_fkey should have an index on the referencing side. |
| DATABASE_URL |stock_take_audit_log |notification_id |idx_stock_take_audit_log_notification_id |FK stock_take_audit_log_notification_id_fkey should have an index on the referencing side. |
| DATABASE_URL |stock_transfer_items |item_id |idx_stock_transfer_items_item_id |FK stock_transfer_items_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |stock_transfer_items |transfer_id |idx_stock_transfer_items_transfer_id |FK stock_transfer_items_transfer_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_adjustment_items |adjustment_id |idx_store_adjustment_items_adjustment_id |FK store_adjustment_items_adjustment_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_adjustment_items |batch_id |idx_store_adjustment_items_batch_id |FK store_adjustment_items_batch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_adjustment_items |item_id |idx_store_adjustment_items_item_id |FK store_adjustment_items_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_count_items |batch_id |idx_store_count_items_batch_id |FK store_count_items_batch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_count_items |count_id |idx_store_count_items_count_id |FK store_count_items_count_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_count_items |item_id |idx_store_count_items_item_id |FK store_count_items_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_credit_note_items |credit_note_id |idx_store_credit_note_items_credit_note_id |FK store_credit_note_items_credit_note_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_credit_note_items |item_id |idx_store_credit_note_items_item_id |FK store_credit_note_items_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_grn_items |grn_id |idx_store_grn_items_grn_id |FK store_grn_items_grn_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_grn_items |po_item_id |idx_store_grn_items_po_item_id |FK store_grn_items_po_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_grn_items |storage_location_id |idx_store_grn_items_storage_location_id |FK store_grn_items_storage_location_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_grni_control_account |grni_account_id |idx_store_grni_control_account_grni_account_id |FK store_grni_control_account_grni_account_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_grni_control_account |inventory_account_id |idx_store_grni_control_account_inventory_account_id |FK store_grni_control_account_inventory_account_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_grni_control_account |journal_entry_id |idx_store_grni_control_account_journal_entry_id |FK store_grni_control_account_journal_entry_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_issue_items |batch_id |idx_store_issue_items_batch_id |FK store_issue_items_batch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_issue_items |issue_id |idx_store_issue_items_issue_id |FK store_issue_items_issue_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_issue_items |item_id |idx_store_issue_items_item_id |FK store_issue_items_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_item_batches |storage_location_id |idx_store_item_batches_storage_location_id |FK store_item_batches_storage_location_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_physical_counts |location_id |idx_store_physical_counts_location_id |FK store_physical_counts_location_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_po_items |po_id |idx_store_po_items_po_id |FK store_po_items_po_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_procurement_audit_logs |supplier_id |idx_store_procurement_audit_logs_supplier_id |FK store_procurement_audit_logs_supplier_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_purchase_orders |quotation_id |idx_store_purchase_orders_quotation_id |FK store_purchase_orders_quotation_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_purchase_orders |requisition_id |idx_store_purchase_orders_requisition_id |FK store_purchase_orders_requisition_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_purchase_orders |supplier_id |idx_store_purchase_orders_supplier_id |FK store_purchase_orders_supplier_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_purchase_requisitions |purchase_order_id |idx_store_purchase_requisitions_purchase_order_id |FK fk_requisition_po should have an index on the referencing side. |
| DATABASE_URL |store_purchase_requisitions |department_id |idx_store_purchase_requisitions_department_id |FK store_purchase_requisitions_department_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_requisition_items |item_id |idx_store_requisition_items_item_id |FK store_requisition_items_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_requisition_items |requisition_id |idx_store_requisition_items_requisition_id |FK store_requisition_items_requisition_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_return_items |batch_id |idx_store_return_items_batch_id |FK store_return_items_batch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_return_items |item_id |idx_store_return_items_item_id |FK store_return_items_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_return_items |return_id |idx_store_return_items_return_id |FK store_return_items_return_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_stock_movements |batch_id |idx_store_stock_movements_batch_id |FK store_stock_movements_batch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_stock_movements |from_department_id |idx_store_stock_movements_from_department_id |FK store_stock_movements_from_department_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_stock_movements |from_location_id |idx_store_stock_movements_from_location_id |FK store_stock_movements_from_location_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_stock_movements |to_department_id |idx_store_stock_movements_to_department_id |FK store_stock_movements_to_department_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_stock_movements |to_location_id |idx_store_stock_movements_to_location_id |FK store_stock_movements_to_location_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_stock_returns |department_id |idx_store_stock_returns_department_id |FK store_stock_returns_department_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_stock_returns |issue_id |idx_store_stock_returns_issue_id |FK store_stock_returns_issue_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_supplier_credit_notes |grn_id |idx_store_supplier_credit_notes_grn_id |FK store_supplier_credit_notes_grn_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_supplier_credit_notes |invoice_id |idx_store_supplier_credit_notes_invoice_id |FK store_supplier_credit_notes_invoice_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_supplier_credit_notes |supplier_id |idx_store_supplier_credit_notes_supplier_id |FK store_supplier_credit_notes_supplier_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_supplier_invoice_items |grn_item_id |idx_store_supplier_invoice_items_grn_item_id |FK store_supplier_invoice_items_grn_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_supplier_invoice_items |item_id |idx_store_supplier_invoice_items_item_id |FK store_supplier_invoice_items_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_supplier_invoice_items |po_item_id |idx_store_supplier_invoice_items_po_item_id |FK store_supplier_invoice_items_po_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_supplier_invoices |grni_cleared_id |idx_store_supplier_invoices_grni_cleared_id |FK store_supplier_invoices_grni_cleared_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_supplier_invoices |journal_entry_id |idx_store_supplier_invoices_journal_entry_id |FK store_supplier_invoices_journal_entry_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_supplier_payments |bank_account_id |idx_store_supplier_payments_bank_account_id |FK store_supplier_payments_bank_account_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_supplier_payments |journal_entry_id |idx_store_supplier_payments_journal_entry_id |FK store_supplier_payments_journal_entry_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_transfer_items |batch_id |idx_store_transfer_items_batch_id |FK store_transfer_items_batch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_transfer_items |item_id |idx_store_transfer_items_item_id |FK store_transfer_items_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_transfer_items |transfer_id |idx_store_transfer_items_transfer_id |FK store_transfer_items_transfer_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_vat_transactions |journal_entry_id |idx_store_vat_transactions_journal_entry_id |FK store_vat_transactions_journal_entry_id_fkey should have an index on the referencing side. |
| DATABASE_URL |store_vat_transactions |vat_control_account_id |idx_store_vat_transactions_vat_control_account_id |FK store_vat_transactions_vat_control_account_id_fkey should have an index on the referencing side. |
| DATABASE_URL |transactions |folio_id |idx_transactions_folio_id |FK transactions_folio_id_fkey should have an index on the referencing side. |
| DATABASE_URL |transfer_batches |requested_branch_id |idx_transfer_batches_requested_branch_id |FK transfer_batches_requested_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |users |branch_id |idx_users_branch_id |FK users_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |variance_alerts |threshold_id |idx_variance_alerts_threshold_id |FK variance_alerts_threshold_id_fkey should have an index on the referencing side. |
| DATABASE_URL |variance_alerts |variance_id |idx_variance_alerts_variance_id |FK variance_alerts_variance_id_fkey should have an index on the referencing side. |
| DATABASE_URL |variance_thresholds |branch_id |idx_variance_thresholds_branch_id |FK variance_thresholds_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL |variance_thresholds |recipe_id |idx_variance_thresholds_recipe_id |FK variance_thresholds_recipe_id_fkey should have an index on the referencing side. |
| DATABASE_URL |vehicle_assignments |vehicle_id |idx_vehicle_assignments_vehicle_id |FK vehicle_assignments_vehicle_id_fkey should have an index on the referencing side. |
| DATABASE_URL |waste_logs |ingredient_id |idx_waste_logs_ingredient_id |FK waste_logs_ingredient_id_fkey should have an index on the referencing side. |
| DATABASE_URL |accounting_ap_bills |branch_id, created_at |idx_accounting_ap_bills_branch_id_created_at |Backend filters accounting_ap_bills by branch and created_at in list/report paths. |
| DATABASE_URL |accounting_ap_bills |branch_id, status |idx_accounting_ap_bills_branch_id_status |Backend filters accounting_ap_bills by branch and status in list/report paths. |
| DATABASE_URL |accounting_ar_invoices |branch_id, created_at |idx_accounting_ar_invoices_branch_id_created_at |Backend filters accounting_ar_invoices by branch and created_at in list/report paths. |
| DATABASE_URL |accounting_ar_invoices |branch_id, status |idx_accounting_ar_invoices_branch_id_status |Backend filters accounting_ar_invoices by branch and status in list/report paths. |
| DATABASE_URL |accounting_bank_accounts |branch_id, created_at |idx_accounting_bank_accounts_branch_id_created_at |Backend filters accounting_bank_accounts by branch and created_at in list/report paths. |
| DATABASE_URL |accounting_bank_transactions |branch_id, created_at |idx_accounting_bank_transactions_branch_id_created_at |Backend filters accounting_bank_transactions by branch and created_at in list/report paths. |
| DATABASE_URL |accounting_customers |branch_id, created_at |idx_accounting_customers_branch_id_created_at |Backend filters accounting_customers by branch and created_at in list/report paths. |
| DATABASE_URL |accounting_journal_entries |branch_id, created_at |idx_accounting_journal_entries_branch_id_created_at |Backend filters accounting_journal_entries by branch and created_at in list/report paths. |
| DATABASE_URL |accounting_journal_entries |branch_id, status |idx_accounting_journal_entries_branch_id_status |Backend filters accounting_journal_entries by branch and status in list/report paths. |
| DATABASE_URL |accounting_vendors |branch_id, created_at |idx_accounting_vendors_branch_id_created_at |Backend filters accounting_vendors by branch and created_at in list/report paths. |
| DATABASE_URL |additional_services |branch_id, created_at |idx_additional_services_branch_id_created_at |Backend filters additional_services by branch and created_at in list/report paths. |
| DATABASE_URL |approval_requests |branch_id, created_at |idx_approval_requests_branch_id_created_at |Backend filters approval_requests by branch and created_at in list/report paths. |
| DATABASE_URL |approval_requests |branch_id, status |idx_approval_requests_branch_id_status |Backend filters approval_requests by branch and status in list/report paths. |
| DATABASE_URL |audit_approvals |branch_id, status |idx_audit_approvals_branch_id_status |Backend filters audit_approvals by branch and status in list/report paths. |
| DATABASE_URL |audit_config_consumption |branch_id, created_at |idx_audit_config_consumption_branch_id_created_at |Backend filters audit_config_consumption by branch and created_at in list/report paths. |
| DATABASE_URL |audit_exceptions |branch_id, created_at |idx_audit_exceptions_branch_id_created_at |Backend filters audit_exceptions by branch and created_at in list/report paths. |
| DATABASE_URL |audit_exceptions |branch_id, status |idx_audit_exceptions_branch_id_status |Backend filters audit_exceptions by branch and status in list/report paths. |
| DATABASE_URL |audit_night_sessions |branch_id, created_at |idx_audit_night_sessions_branch_id_created_at |Backend filters audit_night_sessions by branch and created_at in list/report paths. |
| DATABASE_URL |audit_night_sessions |branch_id, status |idx_audit_night_sessions_branch_id_status |Backend filters audit_night_sessions by branch and status in list/report paths. |
| DATABASE_URL |automation_runs |branch_id, created_at |idx_automation_runs_branch_id_created_at |Backend filters automation_runs by branch and created_at in list/report paths. |
| DATABASE_URL |automation_runs |branch_id, status |idx_automation_runs_branch_id_status |Backend filters automation_runs by branch and status in list/report paths. |
| DATABASE_URL |bank_accounts |branch_id, created_at |idx_bank_accounts_branch_id_created_at |Backend filters bank_accounts by branch and created_at in list/report paths. |
| DATABASE_URL |banking_transactions |branch_id, created_at |idx_banking_transactions_branch_id_created_at |Backend filters banking_transactions by branch and created_at in list/report paths. |
| DATABASE_URL |banking_transactions |branch_id, status |idx_banking_transactions_branch_id_status |Backend filters banking_transactions by branch and status in list/report paths. |
| DATABASE_URL |bar_drinks |branch_id, created_at |idx_bar_drinks_branch_id_created_at |Backend filters bar_drinks by branch and created_at in list/report paths. |
| DATABASE_URL |bar_orders |branch_id, status |idx_bar_orders_branch_id_status |Backend filters bar_orders by branch and status in list/report paths. |
| DATABASE_URL |bar_tabs |branch_id, created_at |idx_bar_tabs_branch_id_created_at |Backend filters bar_tabs by branch and created_at in list/report paths. |
| DATABASE_URL |bar_tabs |branch_id, status |idx_bar_tabs_branch_id_status |Backend filters bar_tabs by branch and status in list/report paths. |
| DATABASE_URL |bookings |branch_id, created_at |idx_bookings_branch_id_created_at |Backend filters bookings by branch and created_at in list/report paths. |
| DATABASE_URL |branch_food_control_config |branch_id, created_at |idx_branch_food_control_config_branch_id_created_at |Backend filters branch_food_control_config by branch and created_at in list/report paths. |
| DATABASE_URL |branch_payments |branch_id, created_at |idx_branch_payments_branch_id_created_at |Backend filters branch_payments by branch and created_at in list/report paths. |
| DATABASE_URL |branch_payments |branch_id, status |idx_branch_payments_branch_id_status |Backend filters branch_payments by branch and status in list/report paths. |
| DATABASE_URL |branch_stock |branch_id, created_at |idx_branch_stock_branch_id_created_at |Backend filters branch_stock by branch and created_at in list/report paths. |
| DATABASE_URL |branch_stock_movements |branch_id, created_at |idx_branch_stock_movements_branch_id_created_at |Backend filters branch_stock_movements by branch and created_at in list/report paths. |
| DATABASE_URL |budget_analysis |branch_id, status |idx_budget_analysis_branch_id_status |Backend filters budget_analysis by branch and status in list/report paths. |
| DATABASE_URL |budgets |branch_id, created_at |idx_budgets_branch_id_created_at |Backend filters budgets by branch and created_at in list/report paths. |
| DATABASE_URL |budgets |branch_id, status |idx_budgets_branch_id_status |Backend filters budgets by branch and status in list/report paths. |
| DATABASE_URL |buffets |branch_id, created_at |idx_buffets_branch_id_created_at |Backend filters buffets by branch and created_at in list/report paths. |
| DATABASE_URL |buffets |branch_id, status |idx_buffets_branch_id_status |Backend filters buffets by branch and status in list/report paths. |
| DATABASE_URL |cashier_logbooks |branch_id, created_at |idx_cashier_logbooks_branch_id_created_at |Backend filters cashier_logbooks by branch and created_at in list/report paths. |
| DATABASE_URL |cashier_logbooks |branch_id, status |idx_cashier_logbooks_branch_id_status |Backend filters cashier_logbooks by branch and status in list/report paths. |
| DATABASE_URL |cashier_shift_logs |branch_id, created_at |idx_cashier_shift_logs_branch_id_created_at |Backend filters cashier_shift_logs by branch and created_at in list/report paths. |
| DATABASE_URL |cashier_shifts |branch_id, created_at |idx_cashier_shifts_branch_id_created_at |Backend filters cashier_shifts by branch and created_at in list/report paths. |
| DATABASE_URL |cashier_shifts |branch_id, status |idx_cashier_shifts_branch_id_status |Backend filters cashier_shifts by branch and status in list/report paths. |
| DATABASE_URL |cashier_transactions |branch_id, created_at |idx_cashier_transactions_branch_id_created_at |Backend filters cashier_transactions by branch and created_at in list/report paths. |
| DATABASE_URL |catering_bookings |branch_id, created_at |idx_catering_bookings_branch_id_created_at |Backend filters catering_bookings by branch and created_at in list/report paths. |
| DATABASE_URL |catering_events |branch_id, created_at |idx_catering_events_branch_id_created_at |Backend filters catering_events by branch and created_at in list/report paths. |
| DATABASE_URL |catering_events |branch_id, status |idx_catering_events_branch_id_status |Backend filters catering_events by branch and status in list/report paths. |
| DATABASE_URL |communication_channels |branch_id, created_at |idx_communication_channels_branch_id_created_at |Backend filters communication_channels by branch and created_at in list/report paths. |
| DATABASE_URL |conference_hall_bookings |branch_id, created_at |idx_conference_hall_bookings_branch_id_created_at |Backend filters conference_hall_bookings by branch and created_at in list/report paths. |
| DATABASE_URL |conference_halls |branch_id, created_at |idx_conference_halls_branch_id_created_at |Backend filters conference_halls by branch and created_at in list/report paths. |
| DATABASE_URL |conference_halls |branch_id, status |idx_conference_halls_branch_id_status |Backend filters conference_halls by branch and status in list/report paths. |
| DATABASE_URL |credit_bills |branch_id, created_at |idx_credit_bills_branch_id_created_at |Backend filters credit_bills by branch and created_at in list/report paths. |
| DATABASE_URL |credit_bills |branch_id, status |idx_credit_bills_branch_id_status |Backend filters credit_bills by branch and status in list/report paths. |
| DATABASE_URL |customer_invoices |branch_id, created_at |idx_customer_invoices_branch_id_created_at |Backend filters customer_invoices by branch and created_at in list/report paths. |
| DATABASE_URL |customer_invoices |branch_id, status |idx_customer_invoices_branch_id_status |Backend filters customer_invoices by branch and status in list/report paths. |
| DATABASE_URL |daily_financial_records |branch_id, created_at |idx_daily_financial_records_branch_id_created_at |Backend filters daily_financial_records by branch and created_at in list/report paths. |
| DATABASE_URL |daily_financial_records |branch_id, status |idx_daily_financial_records_branch_id_status |Backend filters daily_financial_records by branch and status in list/report paths. |
| DATABASE_URL |department_inventory_accounts |branch_id, created_at |idx_department_inventory_accounts_branch_id_created_at |Backend filters department_inventory_accounts by branch and created_at in list/report paths. |
| DATABASE_URL |department_request_logs |branch_id, created_at |idx_department_request_logs_branch_id_created_at |Backend filters department_request_logs by branch and created_at in list/report paths. |
| DATABASE_URL |departments |branch_id, created_at |idx_departments_branch_id_created_at |Backend filters departments by branch and created_at in list/report paths. |
| DATABASE_URL |departments |branch_id, status |idx_departments_branch_id_status |Backend filters departments by branch and status in list/report paths. |
| DATABASE_URL |director_review_tasks |branch_id, created_at |idx_director_review_tasks_branch_id_created_at |Backend filters director_review_tasks by branch and created_at in list/report paths. |
| DATABASE_URL |director_review_tasks |branch_id, status |idx_director_review_tasks_branch_id_status |Backend filters director_review_tasks by branch and status in list/report paths. |
| DATABASE_URL |discrepancy_flags |branch_id, created_at |idx_discrepancy_flags_branch_id_created_at |Backend filters discrepancy_flags by branch and created_at in list/report paths. |
| DATABASE_URL |discrepancy_flags |branch_id, status |idx_discrepancy_flags_branch_id_status |Backend filters discrepancy_flags by branch and status in list/report paths. |
| DATABASE_URL |document_templates |branch_id, created_at |idx_document_templates_branch_id_created_at |Backend filters document_templates by branch and created_at in list/report paths. |
| DATABASE_URL |drivers |branch_id, created_at |idx_drivers_branch_id_created_at |Backend filters drivers by branch and created_at in list/report paths. |
| DATABASE_URL |drivers |branch_id, status |idx_drivers_branch_id_status |Backend filters drivers by branch and status in list/report paths. |
| DATABASE_URL |dynamic_services |branch_id, created_at |idx_dynamic_services_branch_id_created_at |Backend filters dynamic_services by branch and created_at in list/report paths. |
| DATABASE_URL |employee_announcements |branch_id, created_at |idx_employee_announcements_branch_id_created_at |Backend filters employee_announcements by branch and created_at in list/report paths. |
| DATABASE_URL |employee_tasks |branch_id, created_at |idx_employee_tasks_branch_id_created_at |Backend filters employee_tasks by branch and created_at in list/report paths. |
| DATABASE_URL |employee_tasks |branch_id, status |idx_employee_tasks_branch_id_status |Backend filters employee_tasks by branch and status in list/report paths. |
| DATABASE_URL |employee_time_clock |branch_id, created_at |idx_employee_time_clock_branch_id_created_at |Backend filters employee_time_clock by branch and created_at in list/report paths. |
| DATABASE_URL |employee_time_clock |branch_id, status |idx_employee_time_clock_branch_id_status |Backend filters employee_time_clock by branch and status in list/report paths. |
| DATABASE_URL |expenses |branch_id, created_at |idx_expenses_branch_id_created_at |Backend filters expenses by branch and created_at in list/report paths. |
| DATABASE_URL |expenses |branch_id, status |idx_expenses_branch_id_status |Backend filters expenses by branch and status in list/report paths. |
| DATABASE_URL |finance_daily_logs |branch_id, created_at |idx_finance_daily_logs_branch_id_created_at |Backend filters finance_daily_logs by branch and created_at in list/report paths. |
| DATABASE_URL |finance_daily_logs |branch_id, status |idx_finance_daily_logs_branch_id_status |Backend filters finance_daily_logs by branch and status in list/report paths. |
| DATABASE_URL |finance_invoices |branch_id, created_at |idx_finance_invoices_branch_id_created_at |Backend filters finance_invoices by branch and created_at in list/report paths. |
| DATABASE_URL |finance_invoices |branch_id, status |idx_finance_invoices_branch_id_status |Backend filters finance_invoices by branch and status in list/report paths. |
| DATABASE_URL |finance_payments |branch_id, created_at |idx_finance_payments_branch_id_created_at |Backend filters finance_payments by branch and created_at in list/report paths. |
| DATABASE_URL |finance_payments |branch_id, status |idx_finance_payments_branch_id_status |Backend filters finance_payments by branch and status in list/report paths. |
| DATABASE_URL |finance_transactions |branch_id, created_at |idx_finance_transactions_branch_id_created_at |Backend filters finance_transactions by branch and created_at in list/report paths. |
| DATABASE_URL |financial_workspace_submissions |branch_id, status |idx_financial_workspace_submissions_branch_id_status |Backend filters financial_workspace_submissions by branch and status in list/report paths. |
| DATABASE_URL |folio_transactions |branch_id, created_at |idx_folio_transactions_branch_id_created_at |Backend filters folio_transactions by branch and created_at in list/report paths. |
| DATABASE_URL |folios |branch_id, created_at |idx_folios_branch_id_created_at |Backend filters folios by branch and created_at in list/report paths. |
| DATABASE_URL |folios |branch_id, status |idx_folios_branch_id_status |Backend filters folios by branch and status in list/report paths. |
| DATABASE_URL |food_control_variance |branch_id, created_at |idx_food_control_variance_branch_id_created_at |Backend filters food_control_variance by branch and created_at in list/report paths. |
| DATABASE_URL |food_control_variance |branch_id, status |idx_food_control_variance_branch_id_status |Backend filters food_control_variance by branch and status in list/report paths. |
| DATABASE_URL |guest_feedback |branch_id, created_at |idx_guest_feedback_branch_id_created_at |Backend filters guest_feedback by branch and created_at in list/report paths. |
| DATABASE_URL |guest_messages |branch_id, created_at |idx_guest_messages_branch_id_created_at |Backend filters guest_messages by branch and created_at in list/report paths. |
| DATABASE_URL |guest_requests |branch_id, created_at |idx_guest_requests_branch_id_created_at |Backend filters guest_requests by branch and created_at in list/report paths. |
| DATABASE_URL |guest_requests |branch_id, status |idx_guest_requests_branch_id_status |Backend filters guest_requests by branch and status in list/report paths. |
| DATABASE_URL |guests |branch_id, created_at |idx_guests_branch_id_created_at |Backend filters guests by branch and created_at in list/report paths. |
| DATABASE_URL |hk_checklist_templates |branch_id, created_at |idx_hk_checklist_templates_branch_id_created_at |Backend filters hk_checklist_templates by branch and created_at in list/report paths. |
| DATABASE_URL |hk_daily_metrics |branch_id, created_at |idx_hk_daily_metrics_branch_id_created_at |Backend filters hk_daily_metrics by branch and created_at in list/report paths. |
| DATABASE_URL |hk_demand_forecasts |branch_id, created_at |idx_hk_demand_forecasts_branch_id_created_at |Backend filters hk_demand_forecasts by branch and created_at in list/report paths. |
| DATABASE_URL |hk_guest_requests |branch_id, created_at |idx_hk_guest_requests_branch_id_created_at |Backend filters hk_guest_requests by branch and created_at in list/report paths. |
| DATABASE_URL |hk_guest_requests |branch_id, status |idx_hk_guest_requests_branch_id_status |Backend filters hk_guest_requests by branch and status in list/report paths. |
| DATABASE_URL |hk_guest_service_requests |branch_id, created_at |idx_hk_guest_service_requests_branch_id_created_at |Backend filters hk_guest_service_requests by branch and created_at in list/report paths. |
| DATABASE_URL |hk_guest_service_requests |branch_id, status |idx_hk_guest_service_requests_branch_id_status |Backend filters hk_guest_service_requests by branch and status in list/report paths. |
| DATABASE_URL |hk_inspections |branch_id, created_at |idx_hk_inspections_branch_id_created_at |Backend filters hk_inspections by branch and created_at in list/report paths. |
| DATABASE_URL |hk_inspections |branch_id, status |idx_hk_inspections_branch_id_status |Backend filters hk_inspections by branch and status in list/report paths. |
| DATABASE_URL |hk_linen_inventory |branch_id, created_at |idx_hk_linen_inventory_branch_id_created_at |Backend filters hk_linen_inventory by branch and created_at in list/report paths. |
| DATABASE_URL |hk_linen_inventory |branch_id, status |idx_hk_linen_inventory_branch_id_status |Backend filters hk_linen_inventory by branch and status in list/report paths. |
| DATABASE_URL |hk_lost_found |branch_id, created_at |idx_hk_lost_found_branch_id_created_at |Backend filters hk_lost_found by branch and created_at in list/report paths. |
| DATABASE_URL |hk_lost_found |branch_id, status |idx_hk_lost_found_branch_id_status |Backend filters hk_lost_found by branch and status in list/report paths. |
| DATABASE_URL |hk_maintenance_requests |branch_id, created_at |idx_hk_maintenance_requests_branch_id_created_at |Backend filters hk_maintenance_requests by branch and created_at in list/report paths. |
| DATABASE_URL |hk_maintenance_requests |branch_id, status |idx_hk_maintenance_requests_branch_id_status |Backend filters hk_maintenance_requests by branch and status in list/report paths. |
| DATABASE_URL |hk_quality_alerts |branch_id, created_at |idx_hk_quality_alerts_branch_id_created_at |Backend filters hk_quality_alerts by branch and created_at in list/report paths. |
| DATABASE_URL |hk_shift_definitions |branch_id, created_at |idx_hk_shift_definitions_branch_id_created_at |Backend filters hk_shift_definitions by branch and created_at in list/report paths. |
| DATABASE_URL |hk_staff_predictions |branch_id, created_at |idx_hk_staff_predictions_branch_id_created_at |Backend filters hk_staff_predictions by branch and created_at in list/report paths. |
| DATABASE_URL |hk_staff_profiles |branch_id, created_at |idx_hk_staff_profiles_branch_id_created_at |Backend filters hk_staff_profiles by branch and created_at in list/report paths. |
| DATABASE_URL |hk_staff_profiles |branch_id, status |idx_hk_staff_profiles_branch_id_status |Backend filters hk_staff_profiles by branch and status in list/report paths. |
| DATABASE_URL |hk_staff_schedules |branch_id, created_at |idx_hk_staff_schedules_branch_id_created_at |Backend filters hk_staff_schedules by branch and created_at in list/report paths. |
| DATABASE_URL |hk_staff_schedules |branch_id, status |idx_hk_staff_schedules_branch_id_status |Backend filters hk_staff_schedules by branch and status in list/report paths. |
| DATABASE_URL |hk_supply_predictions |branch_id, created_at |idx_hk_supply_predictions_branch_id_created_at |Backend filters hk_supply_predictions by branch and created_at in list/report paths. |
| DATABASE_URL |hk_sustainability_daily |branch_id, created_at |idx_hk_sustainability_daily_branch_id_created_at |Backend filters hk_sustainability_daily by branch and created_at in list/report paths. |
| DATABASE_URL |hk_sustainability_metrics |branch_id, created_at |idx_hk_sustainability_metrics_branch_id_created_at |Backend filters hk_sustainability_metrics by branch and created_at in list/report paths. |
| DATABASE_URL |hk_tasks |branch_id, created_at |idx_hk_tasks_branch_id_created_at |Backend filters hk_tasks by branch and created_at in list/report paths. |
| DATABASE_URL |hk_tasks |branch_id, status |idx_hk_tasks_branch_id_status |Backend filters hk_tasks by branch and status in list/report paths. |
| DATABASE_URL |hotel_amenities |branch_id, created_at |idx_hotel_amenities_branch_id_created_at |Backend filters hotel_amenities by branch and created_at in list/report paths. |
| DATABASE_URL |housekeeping_tasks |branch_id, created_at |idx_housekeeping_tasks_branch_id_created_at |Backend filters housekeeping_tasks by branch and created_at in list/report paths. |
| DATABASE_URL |housekeeping_tasks |branch_id, status |idx_housekeeping_tasks_branch_id_status |Backend filters housekeeping_tasks by branch and status in list/report paths. |
| DATABASE_URL |inventory_documents |branch_id, created_at |idx_inventory_documents_branch_id_created_at |Backend filters inventory_documents by branch and created_at in list/report paths. |
| DATABASE_URL |inventory_documents |branch_id, status |idx_inventory_documents_branch_id_status |Backend filters inventory_documents by branch and status in list/report paths. |
| DATABASE_URL |inventory_items |branch_id, created_at |idx_inventory_items_branch_id_created_at |Backend filters inventory_items by branch and created_at in list/report paths. |
| DATABASE_URL |kitchen_daily_variance |branch_id, created_at |idx_kitchen_daily_variance_branch_id_created_at |Backend filters kitchen_daily_variance by branch and created_at in list/report paths. |
| DATABASE_URL |kitchen_expected_portions |branch_id, created_at |idx_kitchen_expected_portions_branch_id_created_at |Backend filters kitchen_expected_portions by branch and created_at in list/report paths. |
| DATABASE_URL |kitchen_food_control_logs |branch_id, created_at |idx_kitchen_food_control_logs_branch_id_created_at |Backend filters kitchen_food_control_logs by branch and created_at in list/report paths. |
| DATABASE_URL |kitchen_food_controls |branch_id, created_at |idx_kitchen_food_controls_branch_id_created_at |Backend filters kitchen_food_controls by branch and created_at in list/report paths. |
| DATABASE_URL |kitchen_grn |branch_id, created_at |idx_kitchen_grn_branch_id_created_at |Backend filters kitchen_grn by branch and created_at in list/report paths. |
| DATABASE_URL |kitchen_ledger_entries |branch_id, created_at |idx_kitchen_ledger_entries_branch_id_created_at |Backend filters kitchen_ledger_entries by branch and created_at in list/report paths. |
| DATABASE_URL |kitchen_ledger_entries |branch_id, status |idx_kitchen_ledger_entries_branch_id_status |Backend filters kitchen_ledger_entries by branch and status in list/report paths. |
| DATABASE_URL |kitchen_portion_ledger |branch_id, created_at |idx_kitchen_portion_ledger_branch_id_created_at |Backend filters kitchen_portion_ledger by branch and created_at in list/report paths. |
| DATABASE_URL |kitchen_portion_stock |branch_id, created_at |idx_kitchen_portion_stock_branch_id_created_at |Backend filters kitchen_portion_stock by branch and created_at in list/report paths. |
| DATABASE_URL |kitchen_portion_tracking |branch_id, created_at |idx_kitchen_portion_tracking_branch_id_created_at |Backend filters kitchen_portion_tracking by branch and created_at in list/report paths. |
| DATABASE_URL |kitchen_portion_tracking |branch_id, status |idx_kitchen_portion_tracking_branch_id_status |Backend filters kitchen_portion_tracking by branch and status in list/report paths. |
| DATABASE_URL |kitchen_requisitions |branch_id, created_at |idx_kitchen_requisitions_branch_id_created_at |Backend filters kitchen_requisitions by branch and created_at in list/report paths. |
| DATABASE_URL |kitchen_requisitions |branch_id, status |idx_kitchen_requisitions_branch_id_status |Backend filters kitchen_requisitions by branch and status in list/report paths. |
| DATABASE_URL |kitchen_stock |branch_id, created_at |idx_kitchen_stock_branch_id_created_at |Backend filters kitchen_stock by branch and created_at in list/report paths. |
| DATABASE_URL |kitchen_stock_ledger |branch_id, created_at |idx_kitchen_stock_ledger_branch_id_created_at |Backend filters kitchen_stock_ledger by branch and created_at in list/report paths. |
| DATABASE_URL |kitchen_store_receipts |branch_id, created_at |idx_kitchen_store_receipts_branch_id_created_at |Backend filters kitchen_store_receipts by branch and created_at in list/report paths. |
| DATABASE_URL |kitchen_store_receipts |branch_id, status |idx_kitchen_store_receipts_branch_id_status |Backend filters kitchen_store_receipts by branch and status in list/report paths. |
| DATABASE_URL |kitchen_usage |branch_id, created_at |idx_kitchen_usage_branch_id_created_at |Backend filters kitchen_usage by branch and created_at in list/report paths. |
| DATABASE_URL |kitchen_usage |branch_id, status |idx_kitchen_usage_branch_id_status |Backend filters kitchen_usage by branch and status in list/report paths. |
| DATABASE_URL |kitchen_usage_records |branch_id, created_at |idx_kitchen_usage_records_branch_id_created_at |Backend filters kitchen_usage_records by branch and created_at in list/report paths. |
| DATABASE_URL |kitchen_usage_records |branch_id, status |idx_kitchen_usage_records_branch_id_status |Backend filters kitchen_usage_records by branch and status in list/report paths. |
| DATABASE_URL |kitchen_variance_logs |branch_id, created_at |idx_kitchen_variance_logs_branch_id_created_at |Backend filters kitchen_variance_logs by branch and created_at in list/report paths. |
| DATABASE_URL |kitchen_wastage |branch_id, created_at |idx_kitchen_wastage_branch_id_created_at |Backend filters kitchen_wastage by branch and created_at in list/report paths. |
| DATABASE_URL |kitchen_wastage |branch_id, status |idx_kitchen_wastage_branch_id_status |Backend filters kitchen_wastage by branch and status in list/report paths. |
| DATABASE_URL |maintenance_assets |branch_id, created_at |idx_maintenance_assets_branch_id_created_at |Backend filters maintenance_assets by branch and created_at in list/report paths. |
| DATABASE_URL |maintenance_assets |branch_id, status |idx_maintenance_assets_branch_id_status |Backend filters maintenance_assets by branch and status in list/report paths. |
| DATABASE_URL |maintenance_tasks |branch_id, created_at |idx_maintenance_tasks_branch_id_created_at |Backend filters maintenance_tasks by branch and created_at in list/report paths. |
| DATABASE_URL |maintenance_tasks |branch_id, status |idx_maintenance_tasks_branch_id_status |Backend filters maintenance_tasks by branch and status in list/report paths. |
| DATABASE_URL |menu_item_branch_pricing |branch_id, created_at |idx_menu_item_branch_pricing_branch_id_created_at |Backend filters menu_item_branch_pricing by branch and created_at in list/report paths. |
| DATABASE_URL |monthly_financial_adjustments |branch_id, created_at |idx_monthly_financial_adjustments_branch_id_created_at |Backend filters monthly_financial_adjustments by branch and created_at in list/report paths. |
| DATABASE_URL |notifications |branch_id, created_at |idx_notifications_branch_id_created_at |Backend filters notifications by branch and created_at in list/report paths. |
| DATABASE_URL |outside_catering_bookings |branch_id, created_at |idx_outside_catering_bookings_branch_id_created_at |Backend filters outside_catering_bookings by branch and created_at in list/report paths. |
| DATABASE_URL |outside_catering_bookings |branch_id, status |idx_outside_catering_bookings_branch_id_status |Backend filters outside_catering_bookings by branch and status in list/report paths. |
| DATABASE_URL |payment_verifications |branch_id, created_at |idx_payment_verifications_branch_id_created_at |Backend filters payment_verifications by branch and created_at in list/report paths. |
| DATABASE_URL |payment_verifications |branch_id, status |idx_payment_verifications_branch_id_status |Backend filters payment_verifications by branch and status in list/report paths. |
| DATABASE_URL |payroll_batch_lines |branch_id, created_at |idx_payroll_batch_lines_branch_id_created_at |Backend filters payroll_batch_lines by branch and created_at in list/report paths. |
| DATABASE_URL |payroll_batches |branch_id, created_at |idx_payroll_batches_branch_id_created_at |Backend filters payroll_batches by branch and created_at in list/report paths. |
| DATABASE_URL |payroll_batches |branch_id, status |idx_payroll_batches_branch_id_status |Backend filters payroll_batches by branch and status in list/report paths. |
| DATABASE_URL |payroll_policies |branch_id, created_at |idx_payroll_policies_branch_id_created_at |Backend filters payroll_policies by branch and created_at in list/report paths. |
| DATABASE_URL |payroll_records |branch_id, created_at |idx_payroll_records_branch_id_created_at |Backend filters payroll_records by branch and created_at in list/report paths. |
| DATABASE_URL |petty_cash_ledger |branch_id, created_at |idx_petty_cash_ledger_branch_id_created_at |Backend filters petty_cash_ledger by branch and created_at in list/report paths. |
| DATABASE_URL |petty_cash_transactions |branch_id, created_at |idx_petty_cash_transactions_branch_id_created_at |Backend filters petty_cash_transactions by branch and created_at in list/report paths. |
| DATABASE_URL |petty_cash_transactions |branch_id, status |idx_petty_cash_transactions_branch_id_status |Backend filters petty_cash_transactions by branch and status in list/report paths. |
| DATABASE_URL |pool_tokens_inventory |branch_id, created_at |idx_pool_tokens_inventory_branch_id_created_at |Backend filters pool_tokens_inventory by branch and created_at in list/report paths. |
| DATABASE_URL |pos_inventory_mappings |branch_id, created_at |idx_pos_inventory_mappings_branch_id_created_at |Backend filters pos_inventory_mappings by branch and created_at in list/report paths. |
| DATABASE_URL |pos_outlet_shifts |branch_id, created_at |idx_pos_outlet_shifts_branch_id_created_at |Backend filters pos_outlet_shifts by branch and created_at in list/report paths. |
| DATABASE_URL |pos_outlet_shifts |branch_id, status |idx_pos_outlet_shifts_branch_id_status |Backend filters pos_outlet_shifts by branch and status in list/report paths. |
| DATABASE_URL |pos_outlets |branch_id, created_at |idx_pos_outlets_branch_id_created_at |Backend filters pos_outlets by branch and created_at in list/report paths. |
| DATABASE_URL |pos_transactions |branch_id, created_at |idx_pos_transactions_branch_id_created_at |Backend filters pos_transactions by branch and created_at in list/report paths. |
| DATABASE_URL |pos_transactions |branch_id, status |idx_pos_transactions_branch_id_status |Backend filters pos_transactions by branch and status in list/report paths. |
| DATABASE_URL |pos_void_requests |branch_id, created_at |idx_pos_void_requests_branch_id_created_at |Backend filters pos_void_requests by branch and created_at in list/report paths. |
| DATABASE_URL |quotations |branch_id, created_at |idx_quotations_branch_id_created_at |Backend filters quotations by branch and created_at in list/report paths. |
| DATABASE_URL |quotations |branch_id, status |idx_quotations_branch_id_status |Backend filters quotations by branch and status in list/report paths. |
| DATABASE_URL |receipts |branch_id, created_at |idx_receipts_branch_id_created_at |Backend filters receipts by branch and created_at in list/report paths. |
| DATABASE_URL |reports |branch_id, created_at |idx_reports_branch_id_created_at |Backend filters reports by branch and created_at in list/report paths. |
| DATABASE_URL |reports |branch_id, status |idx_reports_branch_id_status |Backend filters reports by branch and status in list/report paths. |
| DATABASE_URL |reservations |branch_id, created_at |idx_reservations_branch_id_created_at |Backend filters reservations by branch and created_at in list/report paths. |
| DATABASE_URL |reservations |branch_id, status |idx_reservations_branch_id_status |Backend filters reservations by branch and status in list/report paths. |
| DATABASE_URL |restaurant_bills |branch_id, created_at |idx_restaurant_bills_branch_id_created_at |Backend filters restaurant_bills by branch and created_at in list/report paths. |
| DATABASE_URL |restaurant_bills |branch_id, status |idx_restaurant_bills_branch_id_status |Backend filters restaurant_bills by branch and status in list/report paths. |
| DATABASE_URL |restaurant_inventory_items |branch_id, created_at |idx_restaurant_inventory_items_branch_id_created_at |Backend filters restaurant_inventory_items by branch and created_at in list/report paths. |
| DATABASE_URL |restaurant_inventory_transactions |branch_id, created_at |idx_restaurant_inventory_transactions_branch_id_created_at |Backend filters restaurant_inventory_transactions by branch and created_at in list/report paths. |
| DATABASE_URL |restaurant_menu_categories |branch_id, created_at |idx_restaurant_menu_categories_branch_id_created_at |Backend filters restaurant_menu_categories by branch and created_at in list/report paths. |
| DATABASE_URL |restaurant_menu_items |branch_id, created_at |idx_restaurant_menu_items_branch_id_created_at |Backend filters restaurant_menu_items by branch and created_at in list/report paths. |
| DATABASE_URL |restaurant_order_items |branch_id, created_at |idx_restaurant_order_items_branch_id_created_at |Backend filters restaurant_order_items by branch and created_at in list/report paths. |
| DATABASE_URL |restaurant_pool_token_sales |branch_id, created_at |idx_restaurant_pool_token_sales_branch_id_created_at |Backend filters restaurant_pool_token_sales by branch and created_at in list/report paths. |
| DATABASE_URL |restaurant_pool_token_sales |branch_id, status |idx_restaurant_pool_token_sales_branch_id_status |Backend filters restaurant_pool_token_sales by branch and status in list/report paths. |
| DATABASE_URL |restaurant_reservations |branch_id, created_at |idx_restaurant_reservations_branch_id_created_at |Backend filters restaurant_reservations by branch and created_at in list/report paths. |
| DATABASE_URL |restaurant_reservations |branch_id, status |idx_restaurant_reservations_branch_id_status |Backend filters restaurant_reservations by branch and status in list/report paths. |
| DATABASE_URL |restaurant_tables |branch_id, created_at |idx_restaurant_tables_branch_id_created_at |Backend filters restaurant_tables by branch and created_at in list/report paths. |
| DATABASE_URL |restaurant_tables |branch_id, status |idx_restaurant_tables_branch_id_status |Backend filters restaurant_tables by branch and status in list/report paths. |
| DATABASE_URL |rooms |branch_id, created_at |idx_rooms_branch_id_created_at |Backend filters rooms by branch and created_at in list/report paths. |
| DATABASE_URL |sales_points |branch_id, created_at |idx_sales_points_branch_id_created_at |Backend filters sales_points by branch and created_at in list/report paths. |
| DATABASE_URL |service_bookings |branch_id, created_at |idx_service_bookings_branch_id_created_at |Backend filters service_bookings by branch and created_at in list/report paths. |
| DATABASE_URL |shift_financials |branch_id, status |idx_shift_financials_branch_id_status |Backend filters shift_financials by branch and status in list/report paths. |
| DATABASE_URL |shift_templates |branch_id, created_at |idx_shift_templates_branch_id_created_at |Backend filters shift_templates by branch and created_at in list/report paths. |
| DATABASE_URL |shift_transactions |branch_id, created_at |idx_shift_transactions_branch_id_created_at |Backend filters shift_transactions by branch and created_at in list/report paths. |
| DATABASE_URL |simple_transfer_items |branch_id, created_at |idx_simple_transfer_items_branch_id_created_at |Backend filters simple_transfer_items by branch and created_at in list/report paths. |
| DATABASE_URL |spa_services |branch_id, created_at |idx_spa_services_branch_id_created_at |Backend filters spa_services by branch and created_at in list/report paths. |
| DATABASE_URL |staff_advances |branch_id, created_at |idx_staff_advances_branch_id_created_at |Backend filters staff_advances by branch and created_at in list/report paths. |
| DATABASE_URL |staff_advances |branch_id, status |idx_staff_advances_branch_id_status |Backend filters staff_advances by branch and status in list/report paths. |
| DATABASE_URL |staff_attendance |branch_id, created_at |idx_staff_attendance_branch_id_created_at |Backend filters staff_attendance by branch and created_at in list/report paths. |
| DATABASE_URL |staff_attendance |branch_id, status |idx_staff_attendance_branch_id_status |Backend filters staff_attendance by branch and status in list/report paths. |
| DATABASE_URL |staff_credit_bills |branch_id, created_at |idx_staff_credit_bills_branch_id_created_at |Backend filters staff_credit_bills by branch and created_at in list/report paths. |
| DATABASE_URL |staff_credit_bills |branch_id, status |idx_staff_credit_bills_branch_id_status |Backend filters staff_credit_bills by branch and status in list/report paths. |
| DATABASE_URL |staff_leave |branch_id, created_at |idx_staff_leave_branch_id_created_at |Backend filters staff_leave by branch and created_at in list/report paths. |
| DATABASE_URL |staff_leave |branch_id, status |idx_staff_leave_branch_id_status |Backend filters staff_leave by branch and status in list/report paths. |
| DATABASE_URL |staff_loan_payments |branch_id, created_at |idx_staff_loan_payments_branch_id_created_at |Backend filters staff_loan_payments by branch and created_at in list/report paths. |
| DATABASE_URL |staff_loans |branch_id, created_at |idx_staff_loans_branch_id_created_at |Backend filters staff_loans by branch and created_at in list/report paths. |
| DATABASE_URL |staff_loans |branch_id, status |idx_staff_loans_branch_id_status |Backend filters staff_loans by branch and status in list/report paths. |
| DATABASE_URL |staff_monthly_statutory_deductions |branch_id, created_at |idx_staff_monthly_statutory_deductions_branch_id_created_at |Backend filters staff_monthly_statutory_deductions by branch and created_at in list/report paths. |
| DATABASE_URL |staff_monthly_statutory_deductions |branch_id, status |idx_staff_monthly_statutory_deductions_branch_id_status |Backend filters staff_monthly_statutory_deductions by branch and status in list/report paths. |
| DATABASE_URL |staff_payroll |branch_id, status |idx_staff_payroll_branch_id_status |Backend filters staff_payroll by branch and status in list/report paths. |
| DATABASE_URL |staff_payroll_adjustments |branch_id, created_at |idx_staff_payroll_adjustments_branch_id_created_at |Backend filters staff_payroll_adjustments by branch and created_at in list/report paths. |
| DATABASE_URL |staff_payroll_adjustments |branch_id, status |idx_staff_payroll_adjustments_branch_id_status |Backend filters staff_payroll_adjustments by branch and status in list/report paths. |
| DATABASE_URL |staff_performance |branch_id, created_at |idx_staff_performance_branch_id_created_at |Backend filters staff_performance by branch and created_at in list/report paths. |
| DATABASE_URL |staff_profiles |branch_id, created_at |idx_staff_profiles_branch_id_created_at |Backend filters staff_profiles by branch and created_at in list/report paths. |
| DATABASE_URL |staff_profiles |branch_id, status |idx_staff_profiles_branch_id_status |Backend filters staff_profiles by branch and status in list/report paths. |
| DATABASE_URL |staff_schedules |branch_id, created_at |idx_staff_schedules_branch_id_created_at |Backend filters staff_schedules by branch and created_at in list/report paths. |
| DATABASE_URL |staff_shifts |branch_id, created_at |idx_staff_shifts_branch_id_created_at |Backend filters staff_shifts by branch and created_at in list/report paths. |
| DATABASE_URL |staff_shifts |branch_id, status |idx_staff_shifts_branch_id_status |Backend filters staff_shifts by branch and status in list/report paths. |
| DATABASE_URL |staff_usage_summary |branch_id, created_at |idx_staff_usage_summary_branch_id_created_at |Backend filters staff_usage_summary by branch and created_at in list/report paths. |
| DATABASE_URL |stock_counts |branch_id, created_at |idx_stock_counts_branch_id_created_at |Backend filters stock_counts by branch and created_at in list/report paths. |
| DATABASE_URL |stock_counts |branch_id, status |idx_stock_counts_branch_id_status |Backend filters stock_counts by branch and status in list/report paths. |
| DATABASE_URL |stock_issues |branch_id, created_at |idx_stock_issues_branch_id_created_at |Backend filters stock_issues by branch and created_at in list/report paths. |
| DATABASE_URL |stock_movements |branch_id, created_at |idx_stock_movements_branch_id_created_at |Backend filters stock_movements by branch and created_at in list/report paths. |
| DATABASE_URL |stock_out_records |branch_id, created_at |idx_stock_out_records_branch_id_created_at |Backend filters stock_out_records by branch and created_at in list/report paths. |
| DATABASE_URL |stock_requests |branch_id, created_at |idx_stock_requests_branch_id_created_at |Backend filters stock_requests by branch and created_at in list/report paths. |
| DATABASE_URL |stock_requests |branch_id, status |idx_stock_requests_branch_id_status |Backend filters stock_requests by branch and status in list/report paths. |
| DATABASE_URL |stock_takes |branch_id, created_at |idx_stock_takes_branch_id_created_at |Backend filters stock_takes by branch and created_at in list/report paths. |
| DATABASE_URL |store_items |branch_id, created_at |idx_store_items_branch_id_created_at |Backend filters store_items by branch and created_at in list/report paths. |
| DATABASE_URL |store_purchase_orders |branch_id, created_at |idx_store_purchase_orders_branch_id_created_at |Backend filters store_purchase_orders by branch and created_at in list/report paths. |
| DATABASE_URL |store_purchase_orders |branch_id, status |idx_store_purchase_orders_branch_id_status |Backend filters store_purchase_orders by branch and status in list/report paths. |
| DATABASE_URL |store_suppliers |branch_id, created_at |idx_store_suppliers_branch_id_created_at |Backend filters store_suppliers by branch and created_at in list/report paths. |
| DATABASE_URL |store_suppliers |branch_id, status |idx_store_suppliers_branch_id_status |Backend filters store_suppliers by branch and status in list/report paths. |
| DATABASE_URL |suppliers |branch_id, created_at |idx_suppliers_branch_id_created_at |Backend filters suppliers by branch and created_at in list/report paths. |
| DATABASE_URL |suppliers |branch_id, status |idx_suppliers_branch_id_status |Backend filters suppliers by branch and status in list/report paths. |
| DATABASE_URL |transactions |branch_id, created_at |idx_transactions_branch_id_created_at |Backend filters transactions by branch and created_at in list/report paths. |
| DATABASE_URL |unpaid_bills |branch_id, created_at |idx_unpaid_bills_branch_id_created_at |Backend filters unpaid_bills by branch and created_at in list/report paths. |
| DATABASE_URL |unpaid_bills |branch_id, status |idx_unpaid_bills_branch_id_status |Backend filters unpaid_bills by branch and status in list/report paths. |
| DATABASE_URL |user_branch_roles |branch_id, created_at |idx_user_branch_roles_branch_id_created_at |Backend filters user_branch_roles by branch and created_at in list/report paths. |
| DATABASE_URL |users |branch_id, created_at |idx_users_branch_id_created_at |Backend filters users by branch and created_at in list/report paths. |
| DATABASE_URL |users |branch_id, status |idx_users_branch_id_status |Backend filters users by branch and status in list/report paths. |
| DATABASE_URL |void_requests |branch_id, created_at |idx_void_requests_branch_id_created_at |Backend filters void_requests by branch and created_at in list/report paths. |
| DATABASE_URL |void_requests |branch_id, status |idx_void_requests_branch_id_status |Backend filters void_requests by branch and status in list/report paths. |
| DATABASE_URL |wastage_records |branch_id, created_at |idx_wastage_records_branch_id_created_at |Backend filters wastage_records by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |audit_events |actor_id |idx_audit_events_actor_id |FK audit_events_actor_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |bank_accounts |branch_id |idx_bank_accounts_branch_id |FK bank_accounts_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |bank_reconciliations |approved_by |idx_bank_reconciliations_approved_by |FK bank_reconciliations_approved_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |bank_reconciliations |bank_account_id |idx_bank_reconciliations_bank_account_id |FK bank_reconciliations_bank_account_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |bank_reconciliations |branch_id |idx_bank_reconciliations_branch_id |FK bank_reconciliations_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |bank_reconciliations |prepared_by |idx_bank_reconciliations_prepared_by |FK bank_reconciliations_prepared_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |bookings |created_by |idx_bookings_created_by |FK bookings_created_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |bookings |guest_id |idx_bookings_guest_id |FK bookings_guest_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |bookings |room_id |idx_bookings_room_id |FK bookings_room_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |branch_payments |branch_id |idx_branch_payments_branch_id |FK branch_payments_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |branch_payments |created_by |idx_branch_payments_created_by |FK branch_payments_created_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |branch_payments |grn_id |idx_branch_payments_grn_id |FK branch_payments_grn_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |branch_payments |invoice_id |idx_branch_payments_invoice_id |FK branch_payments_invoice_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |branch_payments |po_id |idx_branch_payments_po_id |FK branch_payments_po_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |branch_payments |released_by |idx_branch_payments_released_by |FK branch_payments_released_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |branch_requisition_lines |branch_requisition_id |idx_branch_requisition_lines_branch_requisition_id |FK branch_requisition_lines_branch_requisition_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |branch_requisition_lines |item_id |idx_branch_requisition_lines_item_id |FK branch_requisition_lines_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |branch_requisitions |auditor_id |idx_branch_requisitions_auditor_id |FK branch_requisitions_auditor_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |branch_requisitions |requested_by |idx_branch_requisitions_requested_by |FK branch_requisitions_requested_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |cashier_shifts |branch_id |idx_cashier_shifts_branch_id |FK cashier_shifts_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |cashier_shifts |cashier_id |idx_cashier_shifts_cashier_id |FK cashier_shifts_cashier_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |cashier_transactions |branch_id |idx_cashier_transactions_branch_id |FK cashier_transactions_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |cashier_transactions |cashier_shift_id |idx_cashier_transactions_cashier_shift_id |FK cashier_transactions_cashier_shift_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |cashier_transactions |created_by |idx_cashier_transactions_created_by |FK cashier_transactions_created_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |credit_bills |branch_id |idx_credit_bills_branch_id |FK credit_bills_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |credit_bills |created_by |idx_credit_bills_created_by |FK credit_bills_created_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |department_request_lines |department_request_id |idx_department_request_lines_department_request_id |FK department_request_lines_department_request_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |department_request_lines |item_id |idx_department_request_lines_item_id |FK department_request_lines_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |department_requests |department_id |idx_department_requests_department_id |FK department_requests_department_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |department_requests |logged_by |idx_department_requests_logged_by |FK department_requests_logged_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |department_requests |outlet_id |idx_department_requests_outlet_id |FK department_requests_outlet_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |dispatch_lines |dispatch_id |idx_dispatch_lines_dispatch_id |FK dispatch_lines_dispatch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |dispatch_lines |item_id |idx_dispatch_lines_item_id |FK dispatch_lines_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |dispatch_lines |movement_id |idx_dispatch_lines_movement_id |FK dispatch_lines_movement_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |dispatches |branch_requisition_id |idx_dispatches_branch_requisition_id |FK dispatches_branch_requisition_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |dispatches |dispatched_by |idx_dispatches_dispatched_by |FK dispatches_dispatched_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |dispatches |packing_session_id |idx_dispatches_packing_session_id |FK dispatches_packing_session_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |dispatches |received_by |idx_dispatches_received_by |FK dispatches_received_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |dispatches |source_branch_id |idx_dispatches_source_branch_id |FK dispatches_source_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |documents |branch_id |idx_documents_branch_id |FK documents_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |documents |generated_by |idx_documents_generated_by |FK documents_generated_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |folios |booking_id |idx_folios_booking_id |FK folios_booking_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |folios |branch_id |idx_folios_branch_id |FK folios_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |folios |guest_id |idx_folios_guest_id |FK folios_guest_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |goods_receipt_lines |goods_receipt_id |idx_goods_receipt_lines_goods_receipt_id |FK goods_receipt_lines_goods_receipt_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |goods_receipt_lines |item_id |idx_goods_receipt_lines_item_id |FK goods_receipt_lines_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |goods_receipt_lines |movement_id |idx_goods_receipt_lines_movement_id |FK goods_receipt_lines_movement_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |goods_receipt_lines |purchase_order_line_id |idx_goods_receipt_lines_purchase_order_line_id |FK goods_receipt_lines_purchase_order_line_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |goods_receipts |branch_id |idx_goods_receipts_branch_id |FK goods_receipts_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |goods_receipts |received_by |idx_goods_receipts_received_by |FK goods_receipts_received_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |goods_receipts |supplier_id |idx_goods_receipts_supplier_id |FK goods_receipts_supplier_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |guests |branch_id |idx_guests_branch_id |FK guests_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |housekeeping_tasks |assigned_to |idx_housekeeping_tasks_assigned_to |FK housekeeping_tasks_assigned_to_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |housekeeping_tasks |branch_id |idx_housekeeping_tasks_branch_id |FK housekeeping_tasks_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |housekeeping_tasks |requested_by |idx_housekeeping_tasks_requested_by |FK housekeeping_tasks_requested_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |housekeeping_tasks |room_id |idx_housekeeping_tasks_room_id |FK housekeeping_tasks_room_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |inventory_alerts |branch_id |idx_inventory_alerts_branch_id |FK inventory_alerts_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |inventory_alerts |item_id |idx_inventory_alerts_item_id |FK inventory_alerts_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |inventory_alerts |location_id |idx_inventory_alerts_location_id |FK inventory_alerts_location_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |inventory_balances |last_movement_id |idx_inventory_balances_last_movement_id |FK inventory_balances_last_movement_fk should have an index on the referencing side. |
| DATABASE_URL_NEW |inventory_locations |department_id |idx_inventory_locations_department_id |FK inventory_locations_department_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |inventory_locations |parent_location_id |idx_inventory_locations_parent_location_id |FK inventory_locations_parent_location_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |inventory_movements |actor_id |idx_inventory_movements_actor_id |FK inventory_movements_actor_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |inventory_movements |batch_id |idx_inventory_movements_batch_id |FK inventory_movements_batch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |inventory_movements |branch_id |idx_inventory_movements_branch_id |FK inventory_movements_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |inventory_movements |destination_location_id |idx_inventory_movements_destination_location_id |FK inventory_movements_destination_location_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |inventory_movements |reversed_by_movement_id |idx_inventory_movements_reversed_by_movement_id |FK inventory_movements_reversed_by_movement_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |inventory_movements |source_location_id |idx_inventory_movements_source_location_id |FK inventory_movements_source_location_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |inventory_reservations |branch_id |idx_inventory_reservations_branch_id |FK inventory_reservations_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |inventory_reservations |item_id |idx_inventory_reservations_item_id |FK inventory_reservations_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |inventory_reservations |location_id |idx_inventory_reservations_location_id |FK inventory_reservations_location_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |inventory_reservations |reserved_by |idx_inventory_reservations_reserved_by |FK inventory_reservations_reserved_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |material_issue_lines |department_request_line_id |idx_material_issue_lines_department_request_line_id |FK material_issue_lines_department_request_line_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |material_issue_lines |item_id |idx_material_issue_lines_item_id |FK material_issue_lines_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |material_issue_lines |material_issue_note_id |idx_material_issue_lines_material_issue_note_id |FK material_issue_lines_material_issue_note_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |material_issue_lines |movement_id |idx_material_issue_lines_movement_id |FK material_issue_lines_movement_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |material_issue_notes |branch_id |idx_material_issue_notes_branch_id |FK material_issue_notes_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |material_issue_notes |department_request_id |idx_material_issue_notes_department_request_id |FK material_issue_notes_department_request_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |material_issue_notes |destination_department_id |idx_material_issue_notes_destination_department_id |FK material_issue_notes_destination_department_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |material_issue_notes |destination_outlet_id |idx_material_issue_notes_destination_outlet_id |FK material_issue_notes_destination_outlet_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |material_issue_notes |issued_by |idx_material_issue_notes_issued_by |FK material_issue_notes_issued_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |notifications |branch_id |idx_notifications_branch_id |FK notifications_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |notifications |recipient_user_id |idx_notifications_recipient_user_id |FK notifications_recipient_user_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |packing_lines |branch_requisition_line_id |idx_packing_lines_branch_requisition_line_id |FK packing_lines_branch_requisition_line_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |packing_lines |item_id |idx_packing_lines_item_id |FK packing_lines_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |packing_lines |movement_id |idx_packing_lines_movement_id |FK packing_lines_movement_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |packing_lines |packing_session_id |idx_packing_lines_packing_session_id |FK packing_lines_packing_session_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |packing_lines |source_location_id |idx_packing_lines_source_location_id |FK packing_lines_source_location_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |packing_sessions |branch_requisition_id |idx_packing_sessions_branch_requisition_id |FK packing_sessions_branch_requisition_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |packing_sessions |packed_by |idx_packing_sessions_packed_by |FK packing_sessions_packed_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |pos_order_lines |menu_item_id |idx_pos_order_lines_menu_item_id |FK pos_order_lines_menu_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |pos_order_lines |movement_id |idx_pos_order_lines_movement_id |FK pos_order_lines_movement_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |pos_order_lines |order_id |idx_pos_order_lines_order_id |FK pos_order_lines_order_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |pos_order_lines |outlet_item_id |idx_pos_order_lines_outlet_item_id |FK pos_order_lines_outlet_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |pos_orders |branch_id |idx_pos_orders_branch_id |FK pos_orders_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |pos_orders |created_by |idx_pos_orders_created_by |FK pos_orders_created_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |pos_orders |outlet_id |idx_pos_orders_outlet_id |FK pos_orders_outlet_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |pos_outlets |inventory_location_id |idx_pos_outlets_inventory_location_id |FK pos_outlets_inventory_location_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |pos_payments |branch_id |idx_pos_payments_branch_id |FK pos_payments_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |pos_payments |order_id |idx_pos_payments_order_id |FK pos_payments_order_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |pos_payments |received_by |idx_pos_payments_received_by |FK pos_payments_received_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |pos_payments |shift_id |idx_pos_payments_shift_id |FK pos_payments_shift_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |pos_shifts |branch_id |idx_pos_shifts_branch_id |FK pos_shifts_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |pos_shifts |closed_by |idx_pos_shifts_closed_by |FK pos_shifts_closed_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |pos_shifts |opened_by |idx_pos_shifts_opened_by |FK pos_shifts_opened_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |pos_shifts |outlet_id |idx_pos_shifts_outlet_id |FK pos_shifts_outlet_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |production_recipe_inputs |input_item_id |idx_production_recipe_inputs_input_item_id |FK production_recipe_inputs_input_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |production_recipe_inputs |recipe_id |idx_production_recipe_inputs_recipe_id |FK production_recipe_inputs_recipe_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |production_recipes |branch_id |idx_production_recipes_branch_id |FK production_recipes_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |production_recipes |output_menu_item_id |idx_production_recipes_output_menu_item_id |FK production_recipes_output_menu_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |production_run_inputs |item_id |idx_production_run_inputs_item_id |FK production_run_inputs_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |production_run_inputs |movement_id |idx_production_run_inputs_movement_id |FK production_run_inputs_movement_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |production_run_inputs |production_run_id |idx_production_run_inputs_production_run_id |FK production_run_inputs_production_run_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |production_run_outputs |movement_id |idx_production_run_outputs_movement_id |FK production_run_outputs_movement_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |production_run_outputs |outlet_item_id |idx_production_run_outputs_outlet_item_id |FK production_run_outputs_outlet_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |production_run_outputs |production_run_id |idx_production_run_outputs_production_run_id |FK production_run_outputs_production_run_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |production_runs |branch_id |idx_production_runs_branch_id |FK production_runs_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |production_runs |operator_id |idx_production_runs_operator_id |FK production_runs_operator_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |production_runs |outlet_id |idx_production_runs_outlet_id |FK production_runs_outlet_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |production_runs |output_menu_item_id |idx_production_runs_output_menu_item_id |FK production_runs_output_menu_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |production_runs |recipe_id |idx_production_runs_recipe_id |FK production_runs_recipe_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |purchase_order_lines |item_id |idx_purchase_order_lines_item_id |FK purchase_order_lines_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |purchase_order_lines |purchase_order_id |idx_purchase_order_lines_purchase_order_id |FK purchase_order_lines_purchase_order_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |purchase_orders |approved_by |idx_purchase_orders_approved_by |FK purchase_orders_approved_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |purchase_orders |created_by |idx_purchase_orders_created_by |FK purchase_orders_created_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |purchase_orders |supplier_id |idx_purchase_orders_supplier_id |FK purchase_orders_supplier_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |receipt_verifications |dispatch_id |idx_receipt_verifications_dispatch_id |FK receipt_verifications_dispatch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |receipt_verifications |verified_by |idx_receipt_verifications_verified_by |FK receipt_verifications_verified_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |reservations |booking_id |idx_reservations_booking_id |FK reservations_booking_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |reservations |branch_id |idx_reservations_branch_id |FK reservations_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |reservations |created_by |idx_reservations_created_by |FK reservations_created_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |reservations |guest_id |idx_reservations_guest_id |FK reservations_guest_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |reservations |room_id |idx_reservations_room_id |FK reservations_room_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |rooms |room_type_id |idx_rooms_room_type_id |FK rooms_room_type_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |staff_profiles |department_id |idx_staff_profiles_department_id |FK staff_profiles_department_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |staff_profiles |user_id |idx_staff_profiles_user_id |FK staff_profiles_user_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |stock_take_lines |adjustment_movement_id |idx_stock_take_lines_adjustment_movement_id |FK stock_take_lines_adjustment_movement_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |stock_take_lines |item_id |idx_stock_take_lines_item_id |FK stock_take_lines_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |stock_take_lines |stock_take_id |idx_stock_take_lines_stock_take_id |FK stock_take_lines_stock_take_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |stock_take_variances |reviewed_by |idx_stock_take_variances_reviewed_by |FK stock_take_variances_reviewed_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |stock_take_variances |stock_take_line_id |idx_stock_take_variances_stock_take_line_id |FK stock_take_variances_stock_take_line_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |stock_takes |audited_by |idx_stock_takes_audited_by |FK stock_takes_audited_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |stock_takes |location_id |idx_stock_takes_location_id |FK stock_takes_location_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |stock_takes |outlet_id |idx_stock_takes_outlet_id |FK stock_takes_outlet_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |stock_takes |prepared_by |idx_stock_takes_prepared_by |FK stock_takes_prepared_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |stock_takes |reviewed_by |idx_stock_takes_reviewed_by |FK stock_takes_reviewed_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |supplier_invoice_lines |goods_receipt_line_id |idx_supplier_invoice_lines_goods_receipt_line_id |FK supplier_invoice_lines_goods_receipt_line_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |supplier_invoice_lines |item_id |idx_supplier_invoice_lines_item_id |FK supplier_invoice_lines_item_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |supplier_invoice_lines |supplier_invoice_id |idx_supplier_invoice_lines_supplier_invoice_id |FK supplier_invoice_lines_supplier_invoice_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |supplier_invoices |approved_by |idx_supplier_invoices_approved_by |FK supplier_invoices_approved_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |supplier_invoices |created_by |idx_supplier_invoices_created_by |FK supplier_invoices_created_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |supplier_invoices |goods_receipt_id |idx_supplier_invoices_goods_receipt_id |FK supplier_invoices_goods_receipt_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |supplier_invoices |purchase_order_id |idx_supplier_invoices_purchase_order_id |FK supplier_invoices_purchase_order_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |supplier_ledger |branch_id |idx_supplier_ledger_branch_id |FK supplier_ledger_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |supplier_ledger |supplier_id |idx_supplier_ledger_supplier_id |FK supplier_ledger_supplier_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |supplier_payments |created_by |idx_supplier_payments_created_by |FK supplier_payments_created_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |supplier_payments |released_by |idx_supplier_payments_released_by |FK supplier_payments_released_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |supplier_payments |supplier_id |idx_supplier_payments_supplier_id |FK supplier_payments_supplier_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |workflow_tasks |assigned_user_id |idx_workflow_tasks_assigned_user_id |FK workflow_tasks_assigned_user_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |workflow_tasks |branch_id |idx_workflow_tasks_branch_id |FK workflow_tasks_branch_id_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |workflow_tasks |created_by |idx_workflow_tasks_created_by |FK workflow_tasks_created_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |workflow_tasks |decided_by |idx_workflow_tasks_decided_by |FK workflow_tasks_decided_by_fkey should have an index on the referencing side. |
| DATABASE_URL_NEW |bank_accounts |branch_id, created_at |idx_bank_accounts_branch_id_created_at |Backend filters bank_accounts by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |bank_accounts |branch_id, status |idx_bank_accounts_branch_id_status |Backend filters bank_accounts by branch and status in list/report paths. |
| DATABASE_URL_NEW |bookings |branch_id, created_at |idx_bookings_branch_id_created_at |Backend filters bookings by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |branch_payments |branch_id, created_at |idx_branch_payments_branch_id_created_at |Backend filters branch_payments by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |branch_payments |branch_id, status |idx_branch_payments_branch_id_status |Backend filters branch_payments by branch and status in list/report paths. |
| DATABASE_URL_NEW |cashier_shifts |branch_id, created_at |idx_cashier_shifts_branch_id_created_at |Backend filters cashier_shifts by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |cashier_shifts |branch_id, status |idx_cashier_shifts_branch_id_status |Backend filters cashier_shifts by branch and status in list/report paths. |
| DATABASE_URL_NEW |cashier_transactions |branch_id, created_at |idx_cashier_transactions_branch_id_created_at |Backend filters cashier_transactions by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |cashier_transactions |branch_id, status |idx_cashier_transactions_branch_id_status |Backend filters cashier_transactions by branch and status in list/report paths. |
| DATABASE_URL_NEW |credit_bills |branch_id, created_at |idx_credit_bills_branch_id_created_at |Backend filters credit_bills by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |credit_bills |branch_id, status |idx_credit_bills_branch_id_status |Backend filters credit_bills by branch and status in list/report paths. |
| DATABASE_URL_NEW |departments |branch_id, created_at |idx_departments_branch_id_created_at |Backend filters departments by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |documents |branch_id, status |idx_documents_branch_id_status |Backend filters documents by branch and status in list/report paths. |
| DATABASE_URL_NEW |folios |branch_id, created_at |idx_folios_branch_id_created_at |Backend filters folios by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |folios |branch_id, status |idx_folios_branch_id_status |Backend filters folios by branch and status in list/report paths. |
| DATABASE_URL_NEW |guests |branch_id, created_at |idx_guests_branch_id_created_at |Backend filters guests by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |housekeeping_tasks |branch_id, created_at |idx_housekeeping_tasks_branch_id_created_at |Backend filters housekeeping_tasks by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |housekeeping_tasks |branch_id, status |idx_housekeeping_tasks_branch_id_status |Backend filters housekeeping_tasks by branch and status in list/report paths. |
| DATABASE_URL_NEW |inventory_movements |branch_id, created_at |idx_inventory_movements_branch_id_created_at |Backend filters inventory_movements by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |notifications |branch_id, created_at |idx_notifications_branch_id_created_at |Backend filters notifications by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |notifications |branch_id, status |idx_notifications_branch_id_status |Backend filters notifications by branch and status in list/report paths. |
| DATABASE_URL_NEW |pos_outlets |branch_id, created_at |idx_pos_outlets_branch_id_created_at |Backend filters pos_outlets by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |purchase_orders |branch_id, created_at |idx_purchase_orders_branch_id_created_at |Backend filters purchase_orders by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |reservations |branch_id, created_at |idx_reservations_branch_id_created_at |Backend filters reservations by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |reservations |branch_id, status |idx_reservations_branch_id_status |Backend filters reservations by branch and status in list/report paths. |
| DATABASE_URL_NEW |room_types |branch_id, created_at |idx_room_types_branch_id_created_at |Backend filters room_types by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |rooms |branch_id, created_at |idx_rooms_branch_id_created_at |Backend filters rooms by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |staff_profiles |branch_id, created_at |idx_staff_profiles_branch_id_created_at |Backend filters staff_profiles by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |stock_takes |branch_id, created_at |idx_stock_takes_branch_id_created_at |Backend filters stock_takes by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |supplier_invoices |branch_id, created_at |idx_supplier_invoices_branch_id_created_at |Backend filters supplier_invoices by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |suppliers |branch_id, created_at |idx_suppliers_branch_id_created_at |Backend filters suppliers by branch and created_at in list/report paths. |
| DATABASE_URL_NEW |suppliers |branch_id, status |idx_suppliers_branch_id_status |Backend filters suppliers by branch and status in list/report paths. |
| DATABASE_URL_NEW |user_branch_roles |branch_id, created_at |idx_user_branch_roles_branch_id_created_at |Backend filters user_branch_roles by branch and created_at in list/report paths. |
