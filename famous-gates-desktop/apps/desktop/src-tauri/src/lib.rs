// Famous Gates Hotels — Tauri 2 Library Root
// Registers all plugins, commands, and state

mod commands;
mod events;
mod models;
mod services;
mod state;

pub fn run() {
    tauri::Builder::default()
        // ── Plugins ──────────────────────────────────────────────────────────
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:famousgates.db", services::sqlite::migrations())
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        // ── App State ────────────────────────────────────────────────────────
        .manage(state::AppState::default())
        // ── Setup ────────────────────────────────────────────────────────────
        .setup(|app| {
            // Initialize local SQLite schema on first launch
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = services::sqlite::init_schema(&app_handle).await {
                    eprintln!("[DB] Schema init failed: {e}");
                }
                // Start background sync worker
                services::sync::start_sync_worker(app_handle).await;
            });
            Ok(())
        })
        // ── Commands ─────────────────────────────────────────────────────────
        .invoke_handler(tauri::generate_handler![
            // Auth
            commands::auth::cmd_login,
            commands::auth::cmd_pos_login,
            commands::auth::cmd_logout,
            commands::auth::cmd_get_session,
            commands::auth::cmd_refresh_token,
            // Network
            commands::network::cmd_get_network_status,
            commands::network::cmd_ping_api,
            // Sync
            commands::sync::cmd_force_sync,
            commands::sync::cmd_get_outbox_count,
            commands::sync::cmd_clear_outbox,
            // Data — read
            commands::data::cmd_query_local,
            commands::data::cmd_get_cached,
            // Data — write (offline-first)
            commands::data::cmd_mutate,
            // Security
            commands::security::cmd_store_token,
            commands::security::cmd_get_token,
            commands::security::cmd_delete_token,
            // App
            commands::app::cmd_get_app_info,
            commands::app::cmd_open_pos_window,
            commands::app::cmd_open_print_window,
            commands::app::cmd_get_branch_config,
            // License
            commands::license::cmd_verify_license,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Famous Gates Desktop");
}
