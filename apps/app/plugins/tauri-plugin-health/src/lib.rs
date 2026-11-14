//! Health Connect ingestion for the Super Duper shell. The IPC surface is documented in
//! `docs/shell-contract.md`; the wire format to the API in `docs/health-sync-contract.md`.

use std::sync::Arc;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::plugin::TauriPlugin;
use tauri::{Manager, Runtime, State, Webview};
use url::Url;

#[cfg(target_os = "android")]
const ANDROID_PACKAGE: &str = "com.kobus.superduper.health";

type Guard = Arc<dyn Fn(&Url) -> bool + Send + Sync>;
type ServerOrigin = Arc<dyn Fn() -> Option<String> + Send + Sync>;

#[derive(Debug, Serialize)]
pub struct Error {
    code: String,
    message: String,
}

impl Error {
    fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}

struct Health<R: Runtime> {
    guard: Guard,
    server_origin: ServerOrigin,
    #[cfg(target_os = "android")]
    handle: tauri::plugin::PluginHandle<R>,
    #[cfg(not(target_os = "android"))]
    _runtime: std::marker::PhantomData<fn() -> R>,
}

impl<R: Runtime> Health<R> {
    fn authorise(&self, webview: &Webview<R>) -> Result<(), Error> {
        match webview.url() {
            Ok(url) if (self.guard)(&url) => Ok(()),
            _ => Err(Error::new(
                "FORBIDDEN",
                "This page is not the configured Super Duper server",
            )),
        }
    }

    #[cfg(target_os = "android")]
    async fn call(&self, command: &str, args: Value) -> Result<Value, Error> {
        use tauri::plugin::mobile::PluginInvokeError;
        self.handle
            .run_mobile_plugin_async::<Value>(command, args)
            .await
            .map_err(|error| match error {
                PluginInvokeError::InvokeRejected(response) => Error::new(
                    response.code.as_deref().unwrap_or("INTERNAL"),
                    response
                        .message
                        .unwrap_or_else(|| "Health command failed".into()),
                ),
                other => Error::new("INTERNAL", other.to_string()),
            })
    }

    #[cfg(not(target_os = "android"))]
    async fn call(&self, _command: &str, _args: Value) -> Result<Value, Error> {
        Ok(unavailable_status())
    }
}

/// The status every command resolves with on platforms without Health Connect.
#[cfg(not(target_os = "android"))]
fn unavailable_status() -> Value {
    json!({
        "platform": std::env::consts::OS,
        "androidSdk": null,
        "availability": "unsupported_platform",
        "permissions": {
            "granted": [],
            "missing": [],
            "unsupported": [],
            "allRecordTypesGranted": false,
            "background": "unsupported",
            "history": "unsupported",
            "exerciseRoutes": "unsupported",
        },
        "power": {
            "batteryOptimization": "unsupported",
            "backgroundRestricted": null,
            "autostartSettings": "unsupported",
        },
        "pairing": { "paired": false, "clientId": null, "serverMatchesShell": false, "needsRepair": false },
        "settings": { "autoSync": false, "historyDays": 0 },
        "sync": {
            "running": false,
            "phase": null,
            "lastSuccessAt": null,
            "lastAttemptAt": null,
            "lastError": null,
            "queuedBatches": 0,
            "queuedRecords": 0,
            "queuedDeletions": 0,
            "rejectedBatches": 0,
            "nextRetryAt": null,
            "types": [],
        },
    })
}

#[tauri::command]
async fn status<R: Runtime>(
    webview: Webview<R>,
    health: State<'_, Health<R>>,
) -> Result<Value, Error> {
    health.authorise(&webview)?;
    with_server(&health, "status", json!({})).await
}

#[tauri::command]
async fn request_permissions<R: Runtime>(
    webview: Webview<R>,
    health: State<'_, Health<R>>,
) -> Result<Value, Error> {
    health.authorise(&webview)?;
    with_server(&health, "requestHealthPermissions", json!({})).await
}

#[tauri::command]
async fn open_health_connect<R: Runtime>(
    webview: Webview<R>,
    health: State<'_, Health<R>>,
) -> Result<Value, Error> {
    health.authorise(&webview)?;
    with_server(&health, "openHealthConnect", json!({})).await
}

#[tauri::command]
async fn request_exercise_routes<R: Runtime>(
    webview: Webview<R>,
    health: State<'_, Health<R>>,
) -> Result<Value, Error> {
    health.authorise(&webview)?;
    with_server(&health, "requestExerciseRoutes", json!({})).await
}

#[tauri::command]
async fn request_battery_exemption<R: Runtime>(
    webview: Webview<R>,
    health: State<'_, Health<R>>,
) -> Result<Value, Error> {
    health.authorise(&webview)?;
    with_server(&health, "requestBatteryExemption", json!({})).await
}

#[tauri::command]
async fn open_autostart_settings<R: Runtime>(
    webview: Webview<R>,
    health: State<'_, Health<R>>,
) -> Result<Value, Error> {
    health.authorise(&webview)?;
    with_server(&health, "openAutostartSettings", json!({})).await
}

#[tauri::command]
async fn pair<R: Runtime>(
    webview: Webview<R>,
    health: State<'_, Health<R>>,
    token: String,
    client_id: String,
) -> Result<Value, Error> {
    health.authorise(&webview)?;
    if token.len() < 16 || token.chars().any(char::is_whitespace) {
        return Err(Error::new(
            "INVALID_ARGUMENT",
            "token is not a client token",
        ));
    }
    if client_id.trim().is_empty() || client_id.len() > 200 {
        return Err(Error::new("INVALID_ARGUMENT", "clientId is required"));
    }
    let server = (health.server_origin)()
        .ok_or_else(|| Error::new("FORBIDDEN", "No server is configured in the shell"))?;
    health
        .call(
            "pair",
            json!({
                "serverUrl": server,
                "shellServerUrl": server,
                "token": token,
                "clientId": client_id,
            }),
        )
        .await
}

#[tauri::command]
async fn unpair<R: Runtime>(
    webview: Webview<R>,
    health: State<'_, Health<R>>,
) -> Result<Value, Error> {
    health.authorise(&webview)?;
    with_server(&health, "unpair", json!({})).await
}

#[tauri::command]
async fn sync_now<R: Runtime>(
    webview: Webview<R>,
    health: State<'_, Health<R>>,
) -> Result<Value, Error> {
    health.authorise(&webview)?;
    with_server(&health, "syncNow", json!({})).await
}

#[tauri::command]
async fn set_auto_sync<R: Runtime>(
    webview: Webview<R>,
    health: State<'_, Health<R>>,
    enabled: bool,
) -> Result<Value, Error> {
    health.authorise(&webview)?;
    with_server(&health, "setAutoSync", json!({ "enabled": enabled })).await
}

#[tauri::command]
async fn set_history_days<R: Runtime>(
    webview: Webview<R>,
    health: State<'_, Health<R>>,
    days: u32,
) -> Result<Value, Error> {
    health.authorise(&webview)?;
    if !(1..=36_500).contains(&days) {
        return Err(Error::new(
            "INVALID_ARGUMENT",
            "days must be between 1 and 36500",
        ));
    }
    with_server(&health, "setHistoryDays", json!({ "days": days })).await
}

/// Every native call carries the shell's current server origin so the status can report
/// whether pairing still targets it, without the paired origin ever leaving native code.
async fn with_server<R: Runtime>(
    health: &Health<R>,
    command: &str,
    mut args: Value,
) -> Result<Value, Error> {
    args["shellServerUrl"] = json!((health.server_origin)());
    health.call(command, args).await
}

pub struct Builder {
    guard: Guard,
    server_origin: ServerOrigin,
}

impl Default for Builder {
    fn default() -> Self {
        Self {
            guard: Arc::new(|_| false),
            server_origin: Arc::new(|| None),
        }
    }
}

impl Builder {
    pub fn new() -> Self {
        Self::default()
    }

    /// Decides per call whether the calling page may use health IPC. Denies by default.
    pub fn caller_guard(mut self, guard: impl Fn(&Url) -> bool + Send + Sync + 'static) -> Self {
        self.guard = Arc::new(guard);
        self
    }

    /// The server the shell is configured for; `pair` binds the client token to it.
    pub fn server_origin(
        mut self,
        origin: impl Fn() -> Option<String> + Send + Sync + 'static,
    ) -> Self {
        self.server_origin = Arc::new(origin);
        self
    }

    pub fn build<R: Runtime>(self) -> TauriPlugin<R> {
        let Self {
            guard,
            server_origin,
        } = self;
        tauri::plugin::Builder::<R, ()>::new("health")
            .invoke_handler(tauri::generate_handler![
                status,
                request_permissions,
                open_health_connect,
                pair,
                unpair,
                sync_now,
                set_auto_sync,
                set_history_days,
                request_exercise_routes,
                request_battery_exemption,
                open_autostart_settings
            ])
            .setup(move |app, _api| {
                #[cfg(target_os = "android")]
                let handle = _api.register_android_plugin(ANDROID_PACKAGE, "HealthPlugin")?;
                app.manage(Health::<R> {
                    guard,
                    server_origin,
                    #[cfg(target_os = "android")]
                    handle,
                    #[cfg(not(target_os = "android"))]
                    _runtime: std::marker::PhantomData,
                });
                Ok(())
            })
            .build()
    }
}

#[cfg(all(test, not(target_os = "android")))]
mod tests {
    use super::unavailable_status;

    #[test]
    fn desktop_status_reports_every_contract_section_as_unsupported() {
        let status = unavailable_status();
        assert_eq!(status["availability"], "unsupported_platform");
        assert_eq!(status["permissions"]["exerciseRoutes"], "unsupported");
        assert_eq!(status["power"]["batteryOptimization"], "unsupported");
        assert!(status["power"]["backgroundRestricted"].is_null());
        assert_eq!(status["power"]["autostartSettings"], "unsupported");
        assert!(status["sync"]["nextRetryAt"].is_null());
        assert_eq!(status["settings"]["historyDays"], 0);
    }
}
