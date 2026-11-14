/**
 * The only module that talks to the app shell (`apps/app`). Implements shell contract v1,
 * `docs/shell-contract.md`. In a normal browser `detectShell()` returns `null`.
 */

type Platform = "android" | "linux" | "macos" | "windows";

type ShellInfo = {
  shell: "superduper";
  version: string;
  platform: Platform;
  debug: boolean;
  plugins: string[];
};

type ServerUrlState = {
  url: string | null;
  source: "saved" | "build" | "development" | null;
  defaultUrl: string | null;
  allowsLoopbackHttp: boolean;
};

export type Grant = "granted" | "denied" | "unsupported";

export type Availability = "available" | "update_required" | "unavailable" | "unsupported_platform";

type TypeStatus = {
  recordType: string;
  permission: string;
  supported: boolean;
  granted: boolean;
  state: "unsupported" | "not_granted" | "not_started" | "backfilling" | "incremental";
  backfill: { windowStart: string; readBackTo: string } | null;
  knownRecords: number;
  queuedRecords: number;
  sentRecords: number;
  sentDeletions: number;
  lastReadAt: string | null;
  lastError: string | null;
};

export type HealthStatus = {
  platform: Platform;
  androidSdk: number | null;
  availability: Availability;
  permissions: {
    granted: string[];
    missing: string[];
    unsupported: string[];
    allRecordTypesGranted: boolean;
    background: Grant;
    history: Grant;
    exerciseRoutes: Grant;
  };
  pairing: {
    paired: boolean;
    clientId: string | null;
    serverMatchesShell: boolean;
    needsRepair: boolean;
  };
  settings: { autoSync: boolean; historyDays: number };
  sync: {
    running: boolean;
    phase: string | null;
    lastSuccessAt: string | null;
    lastAttemptAt: string | null;
    lastError: string | null;
    queuedBatches: number;
    queuedRecords: number;
    queuedDeletions: number;
    rejectedBatches: number;
    types: TypeStatus[];
  };
};

/** `REFUSED` is ours: the Tauri access-control layer rejected the call with a plain string. */
type ShellErrorCode =
  | "FORBIDDEN"
  | "INVALID_ARGUMENT"
  | "UNAVAILABLE"
  | "NOT_PAIRED"
  | "UNAUTHENTICATED"
  | "INTERNAL"
  | "REFUSED";

const CONTRACT_CODES = new Set<string>([
  "FORBIDDEN",
  "INVALID_ARGUMENT",
  "UNAVAILABLE",
  "NOT_PAIRED",
  "UNAUTHENTICATED",
  "INTERNAL",
]);

export class ShellError extends Error {
  readonly code: ShellErrorCode;

  constructor(code: ShellErrorCode, message: string) {
    super(message);
    this.name = "ShellError";
    this.code = code;
  }
}

type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

export type ShellWindow = {
  __SUPERDUPER_SHELL__?: { shell?: unknown; platform?: unknown; version?: unknown };
  __TAURI_INTERNALS__?: { invoke?: unknown };
};

export type Shell = {
  platform: Platform;
  version: string;
  info: () => Promise<ShellInfo>;
  getServerUrl: () => Promise<ServerUrlState>;
  /** The shell navigates away to its setup page; the promise may never settle. */
  setServerUrl: (url: string | null) => Promise<void>;
  health: {
    status: () => Promise<HealthStatus>;
    requestPermissions: () => Promise<HealthStatus>;
    openHealthConnect: () => Promise<HealthStatus>;
    pair: (pairing: { token: string; clientId: string }) => Promise<HealthStatus>;
    unpair: () => Promise<HealthStatus>;
    syncNow: () => Promise<HealthStatus>;
    setAutoSync: (enabled: boolean) => Promise<HealthStatus>;
    setHistoryDays: (days: number) => Promise<HealthStatus>;
  };
};

export function toShellError(reason: unknown): ShellError {
  if (reason instanceof ShellError) return reason;
  if (typeof reason === "string") return new ShellError("REFUSED", reason);
  if (typeof reason === "object" && reason !== null) {
    const { code, message } = reason as { code?: unknown; message?: unknown };
    const text = typeof message === "string" ? message : "The app shell reported an error.";
    return new ShellError(
      typeof code === "string" && CONTRACT_CODES.has(code) ? (code as ShellErrorCode) : "INTERNAL",
      text,
    );
  }
  return new ShellError("INTERNAL", "The app shell reported an error.");
}

export function detectShell(
  target: ShellWindow = globalThis as unknown as ShellWindow,
): Shell | null {
  const marker = target.__SUPERDUPER_SHELL__;
  const invoke = target.__TAURI_INTERNALS__?.invoke;
  if (marker?.shell !== "superduper" || typeof invoke !== "function") return null;

  const call = <T>(command: string, args?: Record<string, unknown>): Promise<T> =>
    Promise.resolve()
      .then(() => (invoke as Invoke).call(target.__TAURI_INTERNALS__, command, args))
      .then(
        (value) => value as T,
        (reason: unknown) => Promise.reject(toShellError(reason)),
      );
  const health = (command: string, args?: Record<string, unknown>) =>
    call<HealthStatus>(`plugin:health|${command}`, args);

  return {
    platform: marker.platform as Platform,
    version: typeof marker.version === "string" ? marker.version : "",
    info: () => call<ShellInfo>("shell_info"),
    getServerUrl: () => call<ServerUrlState>("get_server_url"),
    setServerUrl: (url) => call<unknown>("set_server_url", { url }).then(() => undefined),
    health: {
      status: () => health("status"),
      requestPermissions: () => health("request_permissions"),
      openHealthConnect: () => health("open_health_connect"),
      pair: ({ token, clientId }) => health("pair", { token, clientId }),
      unpair: () => health("unpair"),
      syncNow: () => health("sync_now"),
      setAutoSync: (enabled) => health("set_auto_sync", { enabled }),
      setHistoryDays: (days) => health("set_history_days", { days }),
    },
  };
}
