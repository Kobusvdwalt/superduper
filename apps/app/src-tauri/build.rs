fn main() {
    // Remote origins may only call commands the ACL grants, so every app command needs a
    // generated permission that the runtime remote capability can reference.
    let manifest = tauri_build::AppManifest::new().commands(&[
        "shell_info",
        "get_server_url",
        "set_server_url",
    ]);
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(manifest))
        .expect("failed to run tauri-build");
}
