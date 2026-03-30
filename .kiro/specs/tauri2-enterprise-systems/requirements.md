# Requirements Document

## Introduction

This feature adds three production-grade systems to the Famous Gates Hotels desktop application (Tauri 2, React + Rust):

1. **Offline WebView2 Installer** — bundles WebView2 into the NSIS installer so the app installs on air-gapped machines with no internet access.
2. **Auto-Updater** — checks for a new version on every app launch, prompts the user via a custom modal, and installs + relaunches on confirmation.
3. **Branch License Key System** — validates a per-branch license key against Supabase on startup, persists the result locally, and blocks app access if the license is invalid or absent.

---

## Glossary

- **App**: The Famous Gates Hotels Tauri 2 desktop application (`com.hirall.famousgates`).
- **Installer**: The NSIS installer bundle produced by `tauri build`.
- **WebView2**: The Microsoft WebView2 runtime required by Tauri on Windows.
- **Updater**: The auto-update subsystem powered by `tauri-plugin-updater`.
- **Update_Manifest**: The `updatesv2.json` file hosted on GitHub that describes the latest release.
- **UpdateManager**: The React component responsible for checking and applying updates.
- **LicenseGate**: The React component that wraps the entire app and enforces license validation before rendering children.
- **License_Command**: The Rust Tauri command `cmd_verify_license` that validates a license key against Supabase.
- **Store**: The local persistent key-value store provided by `tauri-plugin-store`, writing to `license.dat`.
- **Supabase**: The remote backend database service hosting the `license_keys` table.
- **Branch**: A hotel branch identified by a unique `branch_id` (i64).
- **Signing_Key**: The minisign public key used to verify update package authenticity.
- **Process_Plugin**: `tauri-plugin-process`, used to call `relaunch()` after an update is applied.

---

## Requirements

### Requirement 1: Offline WebView2 Bundling

**User Story:** As a hotel IT administrator, I want the installer to include the WebView2 runtime, so that the app can be installed on machines with no internet access.

#### Acceptance Criteria

1. THE Installer SHALL bundle the WebView2 offline installer by setting `bundle.windows.webviewInstallMode.type` to `"offlineInstaller"` in `tauri.conf.json`.
2. THE Installer SHALL NOT include a `downloadBootstrapper` fallback — offline-first is the only supported mode.
3. WHEN the NSIS installer runs on a machine without internet access, THE Installer SHALL install WebView2 from the bundled payload without making any outbound network requests.
4. THE Installer SHALL produce a final artifact size increase of approximately 160 MB compared to the baseline NSIS bundle, which is acceptable.

---

### Requirement 2: Auto-Updater — Plugin Registration

**User Story:** As a developer, I want both updater and process plugins registered in the Rust backend, so that the frontend can invoke update and relaunch APIs.

#### Acceptance Criteria

1. THE App SHALL declare `tauri-plugin-process = "2"` as a dependency in `Cargo.toml`.
2. THE App SHALL register `tauri_plugin_updater::Builder::default().build()` in `lib.rs` before the invoke handler.
3. THE App SHALL register `tauri_plugin_process::init()` in `lib.rs` before the invoke handler.
4. THE App SHALL declare the updater plugin configuration in `tauri.conf.json` under `plugins.updater` with `pubkey` set to the Signing_Key and `endpoints` set to `["https://raw.githubusercontent.com/allan-too/fggrill/main/updatesv2.json"]`.
5. THE App SHALL set `plugins.updater.dialog` to `false` in `tauri.conf.json` so the built-in dialog is suppressed in favour of the custom UpdateManager component.

---

### Requirement 3: Auto-Updater — UpdateManager Component

**User Story:** As a hotel staff member, I want to be notified of available updates on app launch and choose to install them, so that the app stays current without manual intervention.

#### Acceptance Criteria

1. WHEN the App mounts, THE UpdateManager SHALL call `checkUpdate()` from `@tauri-apps/plugin-updater` inside a `useEffect` with an empty dependency array.
2. WHEN `checkUpdate()` returns an available update, THE UpdateManager SHALL display a non-blocking modal showing the new version number with "Update now" and "Later" action buttons.
3. WHEN the user selects "Update now", THE UpdateManager SHALL call `installUpdate()` on the update object, then call `relaunch()` from `@tauri-apps/plugin-process`.
4. WHEN the user selects "Later", THE UpdateManager SHALL dismiss the modal and allow the app to continue running without installing the update.
5. IF `checkUpdate()` throws a network error, THEN THE UpdateManager SHALL silently suppress the error and render no modal.
6. IF the update package fails signature verification, THEN THE UpdateManager SHALL display a toast notification with the message "Update failed, contact support" using the existing `sonner` Toaster.
7. IF a partial download occurs and `installUpdate()` throws before completion, THEN THE UpdateManager SHALL call `relaunch()` so the download is retried on the next launch.
8. THE UpdateManager SHALL import `checkUpdate` and `installUpdate` exclusively from `@tauri-apps/plugin-updater`.
9. THE UpdateManager SHALL import `relaunch` exclusively from `@tauri-apps/plugin-process`.
10. THE UpdateManager SHALL be rendered inside the `AppStateProvider` tree in `main.tsx`, after the app is mounted, so it does not block the initial render.

---

### Requirement 4: Auto-Updater — Update Manifest

**User Story:** As a developer, I want a correctly structured `updatesv2.json` manifest on GitHub, so that the Tauri updater can parse and verify available releases.

#### Acceptance Criteria

1. THE Update_Manifest SHALL be a valid JSON file hosted at `https://raw.githubusercontent.com/allan-too/fggrill/main/updatesv2.json`.
2. THE Update_Manifest SHALL contain a `version` field with a semver string matching the latest release.
3. THE Update_Manifest SHALL contain a `notes` field with a human-readable release notes string.
4. THE Update_Manifest SHALL contain a `pub_date` field with an ISO 8601 datetime string.
5. THE Update_Manifest SHALL contain a `platforms` object with per-platform entries, each having a `signature` field (minisign signature string) and a `url` field pointing to the release artifact.
6. WHEN the Updater fetches the Update_Manifest, THE Updater SHALL verify the artifact signature against the Signing_Key before applying the update.

---

### Requirement 5: Branch License Key System — Rust Command

**User Story:** As a developer, I want a Rust command that validates a license key against Supabase and persists the result, so that the frontend can enforce branch-level access control.

#### Acceptance Criteria

1. THE License_Command SHALL accept two parameters: `key: String` and `branch_id: i64`.
2. WHEN invoked, THE License_Command SHALL send an HTTP POST request to the Supabase `license_keys` table endpoint to query for a row where `key` matches, `branch_id` matches, and `is_active` is `true`.
3. WHEN a matching active record is found, THE License_Command SHALL persist `{ key, branch_id, verified_at }` to the Store file `license.dat` using `tauri-plugin-store`.
4. WHEN a matching active record is found, THE License_Command SHALL return `Ok(())` to the frontend.
5. IF no matching active record is found, THEN THE License_Command SHALL return `Err("Invalid license")` without writing to the Store.
6. IF the Supabase request fails due to a network error, THEN THE License_Command SHALL return `Err("Invalid license")` without writing to the Store.
7. THE License_Command SHALL be registered in `lib.rs` inside the `invoke_handler` as `commands::license::cmd_verify_license`.
8. THE License_Command SHALL be defined in a new file `src-tauri/src/commands/license.rs` and declared in `commands/mod.rs`.

---

### Requirement 6: Branch License Key System — LicenseGate Component

**User Story:** As a hotel branch operator, I want the app to enforce a valid license key before granting access, so that only authorised branches can use the system.

#### Acceptance Criteria

1. WHEN the App mounts, THE LicenseGate SHALL read the Store file `license.dat` for a persisted `{ key, branch_id, verified_at }` record.
2. WHEN a valid persisted license is found in the Store, THE LicenseGate SHALL render its children immediately without showing any modal.
3. WHEN no persisted license is found in the Store, THE LicenseGate SHALL display a full-screen modal with input fields for `key` and `branch_id`.
4. WHEN the user submits the license form, THE LicenseGate SHALL call `invoke("cmd_verify_license", { key, branch_id })` via `@tauri-apps/api/core`.
5. WHEN `cmd_verify_license` returns successfully, THE LicenseGate SHALL persist the license locally and render the app children.
6. IF `cmd_verify_license` returns an error, THEN THE LicenseGate SHALL display an inline error message within the modal without closing it.
7. THE LicenseGate SHALL provide NO bypass path — the app children SHALL NOT be rendered until a valid license is confirmed.
8. THE LicenseGate SHALL wrap the entire app tree in `main.tsx`, outside the router but inside `QueryClientProvider` and `AppStateProvider`.
9. WHEN a persisted license is found, THE LicenseGate SHALL NOT re-validate against Supabase on every launch — the persisted Store value is sufficient for subsequent launches.
