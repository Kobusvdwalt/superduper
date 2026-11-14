const COMMANDS: &[&str] = &[
    "status",
    "request_permissions",
    "open_health_connect",
    "pair",
    "unpair",
    "sync_now",
    "set_auto_sync",
    "set_history_days",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
