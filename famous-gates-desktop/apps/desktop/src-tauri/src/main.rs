// Famous Gates Hotels — Tauri 2 Desktop Application
// Rust entry point — all logic lives in lib.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    famous_gates_desktop_lib::run();
}
