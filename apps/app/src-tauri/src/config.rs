use serde::{Deserialize, Serialize};
use url::{Host, Url};

const CONFIG_FILE: &str = "shell.json";
const BUILD_URL: Option<&str> = option_env!("SUPERDUPER_URL");
const DEBUG_FALLBACK_URL: &str = "http://localhost:4401";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    Saved,
    Build,
    Development,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ServerUrl {
    pub origin: String,
    pub source: Source,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfigFile {
    server_url: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum InvalidUrl {
    Unparseable,
    Scheme,
    Insecure,
    NotAnOrigin,
}

impl InvalidUrl {
    pub fn message(&self) -> &'static str {
        match self {
            Self::Unparseable => "Enter a full URL, for example https://superduper.example.com",
            Self::Scheme => "The server URL must start with https://",
            Self::Insecure => {
                "Use https://. Plain http:// is only allowed for localhost in debug builds."
            }
            Self::NotAnOrigin => {
                "Enter only the server address, without a path, query, fragment or credentials"
            }
        }
    }
}

/// Normalises a user or build supplied server URL to its origin (`scheme://host[:port]`).
pub fn parse_origin(input: &str, allow_loopback_http: bool) -> Result<String, InvalidUrl> {
    let url = Url::parse(input.trim()).map_err(|_| InvalidUrl::Unparseable)?;
    match url.scheme() {
        "https" => {}
        "http" if allow_loopback_http && is_loopback(&url) => {}
        "http" => return Err(InvalidUrl::Insecure),
        _ => return Err(InvalidUrl::Scheme),
    }
    if url.host().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || !matches!(url.path(), "" | "/")
    {
        return Err(InvalidUrl::NotAnOrigin);
    }
    Ok(url.origin().ascii_serialization())
}

fn is_loopback(url: &Url) -> bool {
    match url.host() {
        Some(Host::Domain(domain)) => domain.eq_ignore_ascii_case("localhost"),
        Some(Host::Ipv4(address)) => address.is_loopback(),
        Some(Host::Ipv6(address)) => address.is_loopback(),
        None => false,
    }
}

pub fn allow_loopback_http() -> bool {
    cfg!(debug_assertions)
}

pub fn resolve(saved: Option<&str>, build: Option<&str>, debug: bool) -> Option<ServerUrl> {
    let candidate = |value: Option<&str>, source| {
        value
            .and_then(|value| parse_origin(value, debug).ok())
            .map(|origin| ServerUrl { origin, source })
    };
    candidate(
        saved
            .and_then(|contents| serde_json::from_str::<ConfigFile>(contents).ok())
            .map(|file| file.server_url)
            .as_deref(),
        Source::Saved,
    )
    .or_else(|| candidate(build, Source::Build))
    .or_else(|| candidate(debug.then_some(DEBUG_FALLBACK_URL), Source::Development))
}

pub fn default_url() -> Option<ServerUrl> {
    resolve(None, BUILD_URL, allow_loopback_http())
}

fn config_path<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Option<std::path::PathBuf> {
    use tauri::Manager;
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join(CONFIG_FILE))
}

pub fn load<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Option<ServerUrl> {
    let saved = config_path(app).and_then(|path| std::fs::read_to_string(path).ok());
    resolve(saved.as_deref(), BUILD_URL, allow_loopback_http())
}

pub fn save<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    origin: Option<&str>,
) -> std::io::Result<()> {
    let path = config_path(app).ok_or_else(|| std::io::Error::other("no config directory"))?;
    match origin {
        Some(origin) => {
            if let Some(dir) = path.parent() {
                std::fs::create_dir_all(dir)?;
            }
            let contents = serde_json::to_vec(&ConfigFile {
                server_url: origin.to_string(),
            })?;
            std::fs::write(path, contents)
        }
        None => match std::fs::remove_file(path) {
            Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(error),
            _ => Ok(()),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalises_to_origin() {
        assert_eq!(
            parse_origin(" https://Example.COM/ ", false),
            Ok("https://example.com".into())
        );
        assert_eq!(
            parse_origin("https://example.com:8443", false),
            Ok("https://example.com:8443".into())
        );
    }

    #[test]
    fn rejects_paths_queries_and_credentials() {
        for input in [
            "https://example.com/app",
            "https://example.com/?a=1",
            "https://example.com/#x",
            "https://user:pw@example.com",
        ] {
            assert_eq!(
                parse_origin(input, true),
                Err(InvalidUrl::NotAnOrigin),
                "{input}"
            );
        }
    }

    #[test]
    fn http_only_for_loopback_in_debug() {
        assert_eq!(
            parse_origin("http://localhost:4401", true),
            Ok("http://localhost:4401".into())
        );
        assert_eq!(
            parse_origin("http://127.0.0.1:4401", true),
            Ok("http://127.0.0.1:4401".into())
        );
        assert_eq!(
            parse_origin("http://localhost:4401", false),
            Err(InvalidUrl::Insecure)
        );
        assert_eq!(
            parse_origin("http://192.168.1.10:4401", true),
            Err(InvalidUrl::Insecure)
        );
        assert_eq!(
            parse_origin("file:///etc/passwd", true),
            Err(InvalidUrl::Scheme)
        );
        assert_eq!(
            parse_origin("javascript:alert(1)", true),
            Err(InvalidUrl::Scheme)
        );
        assert_eq!(
            parse_origin("example.com", true),
            Err(InvalidUrl::Unparseable)
        );
    }

    #[test]
    fn saved_wins_over_build_and_development_fallback() {
        let saved = r#"{"serverUrl":"https://saved.example.com"}"#;
        assert_eq!(
            resolve(Some(saved), Some("https://build.example.com"), true),
            Some(ServerUrl {
                origin: "https://saved.example.com".into(),
                source: Source::Saved
            })
        );
        assert_eq!(
            resolve(Some("{"), Some("https://build.example.com"), true).map(|u| u.source),
            Some(Source::Build)
        );
        assert_eq!(
            resolve(None, None, true),
            Some(ServerUrl {
                origin: DEBUG_FALLBACK_URL.into(),
                source: Source::Development
            })
        );
    }

    #[test]
    fn release_without_build_url_has_no_server() {
        assert_eq!(resolve(None, None, false), None);
        assert_eq!(resolve(None, Some("http://localhost:4401"), false), None);
        assert_eq!(
            resolve(
                Some(r#"{"serverUrl":"http://localhost:4401"}"#),
                None,
                false
            ),
            None
        );
    }
}
