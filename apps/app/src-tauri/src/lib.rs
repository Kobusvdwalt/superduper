mod config;
mod ipc;

use std::sync::Arc;

use tauri::{WebviewUrl, WebviewWindowBuilder};

use ipc::{Shell, ShellState, MAIN_WINDOW};

fn shell_script(version: &str) -> String {
    let shell = serde_json::json!({
        "shell": "superduper",
        "platform": std::env::consts::OS,
        "version": version,
    });
    format!("Object.defineProperty(window, '__SUPERDUPER_SHELL__', {{ value: Object.freeze({shell}) }});")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let shell: Shell = Arc::new(ShellState::default());
    let guard = shell.clone();

    tauri::Builder::default()
        .plugin(
            tauri_plugin_health::Builder::new()
                .caller_guard(move |url| guard.is_server(url))
                .server_origin({
                    let shell = shell.clone();
                    move || shell.server_origin()
                })
                .build(),
        )
        .manage(shell.clone())
        .invoke_handler(tauri::generate_handler![
            ipc::shell_info,
            ipc::get_server_url,
            ipc::set_server_url
        ])
        .setup(move |app| {
            let version = app.package_info().version.to_string();
            let builder =
                WebviewWindowBuilder::new(app, MAIN_WINDOW, WebviewUrl::App("index.html".into()))
                    .initialization_script(shell_script(&version));
            #[cfg(desktop)]
            let builder = builder
                .title("Super Duper")
                .inner_size(1200.0, 820.0)
                .min_inner_size(360.0, 560.0);
            builder.build()?;
            shell.set_server(app.handle(), config::load(app.handle()))?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Super Duper");
}
