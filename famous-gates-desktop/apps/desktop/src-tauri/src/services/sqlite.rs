// Local SQLite — schema bootstrap and query helpers

use anyhow::Result;
use tauri::AppHandle;
use tauri_plugin_sql::{Migration, MigrationKind};

/// Bootstrap the local SQLite schema on first launch.
/// Tables mirror the remote Supabase schema but are read-optimised for offline use.
pub async fn init_schema(_app: &AppHandle) -> Result<()> {
    // Schema is applied via tauri-plugin-sql migrations defined in tauri.conf.json
    // Additional runtime migrations can be applied here if needed
    log::info!("[SQLite] Schema initialised");
    Ok(())
}

/// Returns the list of migrations to apply at startup.
/// Called by the SQL plugin during setup.
pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_core_tables",
            sql: include_str!("../../migrations/001_core_tables.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_outbox_table",
            sql: include_str!("../../migrations/002_outbox.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_cache_metadata",
            sql: include_str!("../../migrations/003_cache_metadata.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

/// Returns a connection to the local SQLite database.
pub fn get_connection(app: &AppHandle) -> Result<rusqlite::Connection> {
    use tauri::Manager;
    let mut path = app.path().app_data_dir()?;
    path.push("databases");
    path.push("famousgates.db");
    
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let conn = rusqlite::Connection::open(path)?;
    Ok(conn)
}
