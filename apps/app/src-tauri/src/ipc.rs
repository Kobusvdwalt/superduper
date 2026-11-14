use std::collections::HashSet;
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::ipc::CapabilityBuilder;
use tauri::{AppHandle, Manager, Runtime, Webview};
use url::Url;

use crate::config::{self, ServerUrl, Source};

pub const MAIN_WINDOW: &str = "main";

/// Origin of the bundled pages. Tauri serves them from `http://tauri.localhost` on Android
/// and Windows and from the `tauri://localhost` custom scheme elsewhere.
#[cfg(any(windows, target_os = "android"))]
const LOCAL_ORIGIN: &str = "http://tauri.localhost";
#[cfg(not(any(windows, target_os = "android")))]
const LOCAL_ORIGIN: &str = "tauri://localhost";

#[derive(Default)]
pub struct ShellState {
    server: Mutex<Option<ServerUrl>>,
    granted: Mutex<HashSet<String>>,
}

pub type Shell = Arc<ShellState>;

/// `scheme://host[:port]`, also for custom schemes (`tauri://localhost`) whose WHATWG
/// origin is opaque.
pub fn origin_of(url: &Url) -> Option<String> {
    let host = url.host_str()?;
    Some(match url.port() {
        Some(port) => format!("{}://{host}:{port}", url.scheme()),
        None => format!("{}://{host}", url.scheme()),
    })
}

impl ShellState {
    pub fn server_origin(&self) -> Option<String> {
        self.server
            .lock()
            .unwrap()
            .as_ref()
            .map(|server| server.origin.clone())
    }

    pub fn local_url(&self) -> Url {
        Url::parse(&format!("{LOCAL_ORIGIN}/index.html")).expect("valid local URL")
    }

    /// True when `url` is the configured server origin. Capabilities added at runtime cannot
    /// be removed, so this is what keeps a previously configured origin from calling IPC.
    pub fn is_server(&self, url: &Url) -> bool {
        origin_of(url).is_some() && origin_of(url) == self.server_origin()
    }

    fn is_local(&self, url: &Url) -> bool {
        origin_of(url).as_deref() == Some(LOCAL_ORIGIN)
    }

    pub fn set_server<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        server: Option<ServerUrl>,
    ) -> tauri::Result<()> {
        if let Some(server) = &server {
            grant_remote(self, app, &server.origin)?;
        }
        *self.server.lock().unwrap() = server;
        Ok(())
    }
}

fn grant_remote<R: Runtime>(
    shell: &ShellState,
    app: &AppHandle<R>,
    origin: &str,
) -> tauri::Result<()> {
    if !shell.granted.lock().unwrap().insert(origin.to_string()) {
        return Ok(());
    }
    let index = shell.granted.lock().unwrap().len();
    app.add_capability(
        CapabilityBuilder::new(format!("remote-server-{index}"))
            .remote(origin.to_string())
            .window(MAIN_WINDOW)
            .permission("allow-shell-info")
            .permission("allow-get-server-url")
            .permission("allow-set-server-url")
            .permission("health:default"),
    )
}

#[derive(Debug, Serialize)]
pub struct CommandError {
    code: &'static str,
    message: String,
}

impl CommandError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

fn authorise<R: Runtime>(shell: &ShellState, webview: &Webview<R>) -> Result<(), CommandError> {
    let url = webview
        .url()
        .map_err(|_| CommandError::new("FORBIDDEN", "Unknown caller"))?;
    if shell.is_local(&url) || shell.is_server(&url) {
        Ok(())
    } else {
        Err(CommandError::new(
            "FORBIDDEN",
            "This page is not the configured Super Duper server",
        ))
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellInfo {
    shell: &'static str,
    version: String,
    platform: &'static str,
    debug: bool,
    plugins: &'static [&'static str],
}

#[tauri::command]
pub fn shell_info<R: Runtime>(
    app: AppHandle<R>,
    webview: Webview<R>,
    shell: tauri::State<'_, Shell>,
) -> Result<ShellInfo, CommandError> {
    authorise(&shell, &webview)?;
    Ok(ShellInfo {
        shell: "superduper",
        version: app.package_info().version.to_string(),
        platform: std::env::consts::OS,
        debug: cfg!(debug_assertions),
        plugins: &["health"],
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerUrlState {
    url: Option<String>,
    source: Option<Source>,
    default_url: Option<String>,
    allows_loopback_http: bool,
}

fn server_state(shell: &ShellState) -> ServerUrlState {
    let current = shell.server.lock().unwrap().clone();
    ServerUrlState {
        url: current.as_ref().map(|server| server.origin.clone()),
        source: current.map(|server| server.source),
        default_url: config::default_url().map(|server| server.origin),
        allows_loopback_http: config::allow_loopback_http(),
    }
}

#[tauri::command]
pub fn get_server_url<R: Runtime>(
    webview: Webview<R>,
    shell: tauri::State<'_, Shell>,
) -> Result<ServerUrlState, CommandError> {
    authorise(&shell, &webview)?;
    Ok(server_state(&shell))
}

#[tauri::command]
pub fn set_server_url<R: Runtime>(
    app: AppHandle<R>,
    webview: Webview<R>,
    shell: tauri::State<'_, Shell>,
    url: Option<String>,
) -> Result<ServerUrlState, CommandError> {
    authorise(&shell, &webview)?;
    let origin = url
        .as_deref()
        .map(|url| config::parse_origin(url, config::allow_loopback_http()))
        .transpose()
        .map_err(|error| CommandError::new("INVALID_ARGUMENT", error.message()))?;
    config::save(&app, origin.as_deref())
        .map_err(|error| CommandError::new("INTERNAL", error.to_string()))?;
    let server = match origin {
        Some(origin) => Some(ServerUrl {
            origin,
            source: Source::Saved,
        }),
        None => config::default_url(),
    };
    shell
        .set_server(&app, server)
        .map_err(|error| CommandError::new("INTERNAL", error.to_string()))?;
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.navigate(shell.local_url());
    }
    Ok(server_state(&shell))
}
