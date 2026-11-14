# Shell contract (v1)

The IPC surface the Super Duper web app can use when it runs inside the app shell
(`apps/app`, Tauri 2, desktop and Android). The web app wraps it in
`apps/web/src/lib/shell.ts` and never calls Tauri directly anywhere else.

The shell is a thin window around the hosted web app. It loads the configured server origin
and grants IPC **only to that exact origin** (`scheme://host[:port]`). A page from any other
origin, including a different port, has no IPC. In a normal browser none of this exists.

## Detecting the shell

The shell defines a frozen global before any page script runs:

```ts
window.__SUPERDUPER_SHELL__; // { shell: "superduper", platform: Platform, version: string } | undefined

type Platform = "android" | "linux" | "macos" | "windows";
```

Treat the page as running in the shell only when `__SUPERDUPER_SHELL__?.shell === "superduper"`
and `window.__TAURI_INTERNALS__?.invoke` is a function. Feature-detect plugins with
`shell_info().plugins`, not with the platform.

## Calling a command

```ts
const invoke = window.__TAURI_INTERNALS__.invoke as <T>(cmd: string, args?: object) => Promise<T>;

await invoke("shell_info");
await invoke("plugin:health|pair", { token, clientId });
```

Arguments are a JSON object with camelCase keys. Every command resolves with a JSON value or
rejects with an error (see [Errors](#errors)).

## Shell commands

### `shell_info`

No arguments.

```ts
type ShellInfo = {
  shell: "superduper";
  version: string; // app version, e.g. "0.1.0"
  platform: Platform;
  debug: boolean; // debug build
  plugins: string[]; // native plugins compiled in, currently ["health"]
};
```

### `get_server_url`

No arguments. Returns `ServerUrlState`.

```ts
type ServerUrlState = {
  url: string | null; // the origin the shell loads, e.g. "https://sd.example.com"
  source: "saved" | "build" | "development" | null; // where `url` came from
  defaultUrl: string | null; // what `set_server_url({ url: null })` falls back to
  allowsLoopbackHttp: boolean; // true in debug builds only
};
```

`source` is `saved` when the user entered a URL, `build` when it came from the
`SUPERDUPER_URL` build-time variable, and `development` for the debug-build fallback
`http://localhost:4401`.

### `set_server_url`

```ts
{
  url: string | null;
}
```

Validates and saves the server, then **navigates the window to the bundled setup page**,
which reconnects to the new origin (or shows the form when it is unreachable). The promise may
therefore never be observed by the calling page; do not depend on its result. `null` clears the
saved URL and falls back to `defaultUrl`. When the caller does observe the result, it is the new
`ServerUrlState`.

Accepted values: a full URL that is only an origin (an optional trailing `/` is allowed; no
path, query, fragment or credentials). `https://` only; in debug builds also `http://` to
`localhost`, a `127.0.0.0/8` address or `[::1]`. Errors: `INVALID_ARGUMENT` with a user-facing message,
`INTERNAL` when the setting cannot be written.

Changing the server does not move a health pairing: the phone keeps syncing to the origin it
was paired with, and `status().pairing.serverMatchesShell` becomes `false` until the user pairs
again on the new server.

## Health commands (`plugin:health|…`)

Reads Android Health Connect and pushes records to `<paired server>/api/graphql` with the
`health.sync` mutation (see [health-sync-contract.md](health-sync-contract.md)). All sync work
is native: hourly WorkManager jobs and on-demand runs keep going when the web app is closed.

Every health command resolves with the current [`HealthStatus`](#healthstatus). Commands that
start work (`pair`, `sync_now`, `request_permissions`) return before the sync finishes; poll
`status` (for example every 2 s while `sync.running` is true) to follow progress. There are no
events.

On desktop every health command resolves (never rejects for being unsupported) with a status
whose `availability` is `"unsupported_platform"`, `settings.autoSync` is `false` and
`settings.historyDays` is `0`; nothing is stored. Argument checks still apply: `pair` and
`set_history_days` reject `INVALID_ARGUMENT` (and `pair` rejects `FORBIDDEN`) as on Android.

| Command                              | Arguments                             | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugin:health\|status`              | none                                  | Reads the status.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `plugin:health\|request_permissions` | none                                  | Opens Health Connect's permission screen for every readable record type plus background and history access, and resolves when the user returns. Starts a sync when paired. Rejects `UNAVAILABLE` when Health Connect is missing or needs an update.                                                                                                                                                                                                                                                 |
| `plugin:health\|open_health_connect` | none                                  | Opens Health Connect settings, or its Play Store page when it is not installed or needs an update.                                                                                                                                                                                                                                                                                                                                                                                                  |
| `plugin:health\|pair`                | `{ token: string, clientId: string }` | Stores the client token, client id and the shell's current server origin natively (Android Keystore AES-GCM), schedules the hourly job when auto-sync is on and starts a sync. Pairing with a different `clientId` or server first deletes all local sync state, including unsent batches. Rejects `INVALID_ARGUMENT` when `token` is shorter than 16 characters or contains whitespace, or `clientId` is empty or longer than 200 characters; `FORBIDDEN` when the shell has no server configured. |
| `plugin:health\|unpair`              | none                                  | Cancels background sync and deletes the token, cursors, record index and outgoing queue. Settings are kept. Data already on the server is untouched.                                                                                                                                                                                                                                                                                                                                                |
| `plugin:health\|sync_now`            | none                                  | Starts a sync (upload the queue, read changes, upload again). Rejects `NOT_PAIRED` or `UNAUTHENTICATED`.                                                                                                                                                                                                                                                                                                                                                                                            |
| `plugin:health\|set_auto_sync`       | `{ enabled: boolean }`                | Turns the hourly background job on or off. Default `true`.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `plugin:health\|set_history_days`    | `{ days: number }`                    | How far back the initial read goes, 1 to 36500 days. Default 3650. Changing it re-reads every type; records already sent are not sent again. Rejects `INVALID_ARGUMENT` outside that range.                                                                                                                                                                                                                                                                                                         |

### Pairing flow

1. The signed-in web app creates a client token for this device through the API's GraphQL
   client-token mutation. The token is shown once.
2. It calls `plugin:health|pair` with `{ token, clientId }` right away and drops the token
   from memory. The shell never returns the token to any page afterwards.
3. It calls `plugin:health|request_permissions` if `status().permissions.missing` is not empty.

When the server answers `UNAUTHENTICATED` (for example the client was revoked), syncing stops,
`pairing.needsRepair` becomes `true` and background sync is cancelled. Pair again to resume.

### `HealthStatus`

```ts
type Grant = "granted" | "denied" | "unsupported";

type HealthStatus = {
  platform: Platform;
  androidSdk: number | null; // Android API level, null off Android
  availability:
    | "available"
    | "update_required" // Health Connect not installed (Android 13 and lower) or too old
    | "unavailable" // device cannot run Health Connect
    | "unsupported_platform"; // not Android
  permissions: {
    granted: string[]; // record types readable now, e.g. "StepsRecord"
    missing: string[]; // supported on this device but not granted
    unsupported: string[]; // not supported by this device's Health Connect
    allRecordTypesGranted: boolean;
    background: Grant; // READ_HEALTH_DATA_IN_BACKGROUND
    history: Grant; // READ_HEALTH_DATA_HISTORY (older than 30 days)
    exerciseRoutes: Grant; // READ_EXERCISE_ROUTES (Android 15+; elsewhere routes need per-session consent and are sent as ConsentRequired)
  };
  pairing: {
    paired: boolean;
    clientId: string | null;
    serverMatchesShell: boolean; // paired origin equals the shell's current server
    needsRepair: boolean; // the server rejected the token; pair again
  };
  settings: {
    autoSync: boolean; // false off Android
    historyDays: number; // 0 off Android
  };
  sync: {
    running: boolean;
    phase: string | null; // human-readable, e.g. "Reading StepsRecord", "Uploading"
    lastSuccessAt: string | null; // ISO-8601; last run that finished without errors
    lastAttemptAt: string | null;
    lastError: string | null; // human-readable summary of the last run's problems
    queuedBatches: number; // waiting for acknowledgement
    queuedRecords: number;
    queuedDeletions: number;
    rejectedBatches: number; // refused by the server (BAD_USER_INPUT, CONFLICT); retried by every foreground sync (sync_now, pair, request_permissions)
    types: TypeStatus[]; // one per Health Connect record type (all 41) on Android, empty elsewhere
  };
};

type TypeStatus = {
  recordType: string; // e.g. "HeartRateRecord"
  permission: string; // Android permission name
  supported: boolean;
  granted: boolean;
  state: "unsupported" | "not_granted" | "not_started" | "backfilling" | "incremental";
  backfill: { windowStart: string; readBackTo: string } | null; // progress while backfilling
  knownRecords: number; // records of this type the phone has seen and sent or queued
  queuedRecords: number;
  sentRecords: number; // acknowledged by the server since pairing
  sentDeletions: number;
  lastReadAt: string | null;
  lastError: string | null;
};
```

A background sync only reads Health Connect when `permissions.background` is `granted`;
otherwise new data is read when the app is open and `sync_now` runs (the hourly job still
uploads what is queued). Without `history`, only the last 30 days are read.

## Errors

A command rejects with:

```ts
type ShellError = {
  code:
    | "FORBIDDEN" // the calling page is not the configured server origin
    | "INVALID_ARGUMENT" // bad argument; `message` is user-facing
    | "UNAVAILABLE" // Health Connect missing or needs an update
    | "NOT_PAIRED"
    | "UNAUTHENTICATED" // pairing was rejected by the server; pair again
    | "INTERNAL";
  message: string;
};
```

When Tauri itself refuses a call the rejection is a plain `string`, not a `ShellError`: an
unknown command, a page that was never granted IPC, or an argument that is missing or has the
wrong JSON type (for example `set_history_days({ days: 1.5 })` or `{ days: -1 }`, since `days`
is an unsigned integer). Handle both.

## Not provided

No record data is exposed to the web app; it reads health data from the API. There is no
way to read the client token or the paired origin back from the shell.
