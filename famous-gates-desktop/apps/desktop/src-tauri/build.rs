fn main() {
    // Load .env from the monorepo root (two levels up from src-tauri/)
    // so SUPABASE_URL and SUPABASE_ANON_KEY are available via env!() at compile time.
    let env_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")  // famous-gates-desktop/
        .join(".env");

    if env_path.exists() {
        if let Ok(contents) = std::fs::read_to_string(&env_path) {
            for line in contents.lines() {
                let line = line.trim();
                if line.is_empty() || line.starts_with('#') {
                    continue;
                }
                if let Some((key, value)) = line.split_once('=') {
                    let key = key.trim();
                    let value = value.trim();
                    // Only forward the vars the Rust code needs
                    if matches!(key, "SUPABASE_URL" | "SUPABASE_ANON_KEY") {
                        println!("cargo:rustc-env={key}={value}");
                    }
                }
            }
        }
    }

    tauri_build::build()
}
