// Не открывать консольное окно в релизной сборке Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod fsops;

use std::sync::Mutex;

use tauri::{Emitter, Manager, State};

/// Пути файлов, которые пришли из командной строки и ещё не открыты фронтендом
#[derive(Default)]
pub struct PendingPaths(pub Mutex<Vec<String>>);

/// Забирает и очищает очередь путей (вызывается фронтендом при старте и по событию)
#[tauri::command]
fn take_pending_paths(state: State<'_, PendingPaths>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap_or_else(|e| e.into_inner()))
}

fn main() {
    tauri::Builder::default()
        // Должен быть первым: второй запуск (двойной клик по .md) передаёт пути первому экземпляру
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let paths = fsops::collect_paths(args);
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.show();
                let _ = win.set_focus();
            }
            if !paths.is_empty() {
                if let Some(state) = app.try_state::<PendingPaths>() {
                    state.0.lock().unwrap_or_else(|e| e.into_inner()).extend(paths);
                }
                let _ = app.emit("open-paths", ());
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(PendingPaths(Mutex::new(fsops::collect_paths(std::env::args()))))
        .invoke_handler(tauri::generate_handler![
            fsops::read_file,
            fsops::write_file,
            take_pending_paths
        ])
        .run(tauri::generate_context!())
        .expect("failed to start MDPad");
}
