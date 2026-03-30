# Tasks: Tauri 2 Enterprise Systems

## Task List

- [x] 1. Offline WebView2 Bundling
  - [x] 1.1 Add `webviewInstallMode` to `tauri.conf.json`
  - [x] 1.2 Verify no `downloadBootstrapper` entry exists in bundle config

- [x] 2. Auto-Updater — Backend Registration
  - [x] 2.1 Add `tauri-plugin-process = "2"` to `Cargo.toml`
  - [x] 2.2 Register `tauri_plugin_updater::Builder::default().build()` in `lib.rs`
  - [x] 2.3 Register `tauri_plugin_process::init()` in `lib.rs`
  - [x] 2.4 Add updater plugin config block to `tauri.conf.json` (`pubkey`, `endpoints`, `dialog: false`)

- [x] 3. Auto-Updater — Update Manifest
  - [x] 3.1 Create `updatesv2.json` template at repo root with correct schema (`version`, `notes`, `pub_date`, `platforms`)

- [x] 4. Auto-Updater — UpdateManager Component
  - [x] 4.1 Create `famous-gates-desktop/apps/desktop/src/components/UpdateManager.tsx`
  - [x] 4.2 Implement `useEffect` on mount calling `checkUpdate()` from `@tauri-apps/plugin-updater`
  - [x] 4.3 Render update modal with version number and "Update now" / "Later" buttons when update available
  - [x] 4.4 Implement "Update now" handler: call `downloadAndInstall()` then `relaunch()` from `@tauri-apps/plugin-process`; call `relaunch()` on partial failure
  - [x] 4.5 Implement "Later" handler: dismiss modal
  - [x] 4.6 Silently catch network errors from `checkUpdate()` (no modal, no throw)
  - [x] 4.7 Show `toast.error("Update failed, contact support")` on signature verification failure
  - [x] 4.8 Mount `UpdateManager` inside `AppStateProvider` in `main.tsx`

- [x] 5. Branch License Key System — Rust Command
  - [x] 5.1 Create `famous-gates-desktop/apps/desktop/src-tauri/src/commands/license.rs`
  - [x] 5.2 Implement `cmd_verify_license(app, key: String, branch_id: i64)` using `reqwest` to query Supabase `license_keys` table
  - [x] 5.3 On success: write `{ key, branch_id, verified_at }` to `license.dat` via `tauri-plugin-store` and return `Ok(())`
  - [x] 5.4 On no match or network error: return `Err("Invalid license".to_string())` without writing to store
  - [x] 5.5 Declare `pub mod license` in `commands/mod.rs`
  - [x] 5.6 Register `commands::license::cmd_verify_license` in `invoke_handler!` in `lib.rs`

- [x] 6. Branch License Key System — LicenseGate Component
  - [x] 6.1 Create `famous-gates-desktop/apps/desktop/src/components/LicenseGate.tsx`
  - [x] 6.2 On mount: read `"license"` key from `license.dat` store via `@tauri-apps/plugin-store`
  - [x] 6.3 If valid record found: render children immediately (no modal, no re-validation)
  - [x] 6.4 If no record: render full-screen modal with `key` and `branch_id` input fields
  - [x] 6.5 On form submit: call `invoke("cmd_verify_license", { key, branch_id })` via `@tauri-apps/api/core`
  - [x] 6.6 On success: transition to rendering children
  - [x] 6.7 On error: display inline error message inside modal without closing it
  - [x] 6.8 Wrap entire app tree with `LicenseGate` in `main.tsx` (outside router, inside `QueryClientProvider` and `AppStateProvider`)

- [x] 7. Property-Based Tests
  - [x] 7.1 Write `proptest` property test for license round trip (Property 1: valid key/branch_id → store contains correct values)
  - [x] 7.2 Write `proptest` property test for invalid license no store write (Property 2: invalid key/branch_id → store unchanged, Err returned)
  - [x] 7.3 Write `fast-check` property test for LicenseGate blocks children without valid license (Property 3)
  - [x] 7.4 Write `fast-check` property test for LicenseGate passes children with valid persisted license (Property 4)
  - [x] 7.5 Write `fast-check` property test for UpdateManager silent on network error (Property 5)
