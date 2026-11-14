import type { HealthStatus, ShellWindow } from "@/lib/shell";

type Call = { command: string; args: Record<string, unknown> | undefined };

export function androidStatus(overrides: Partial<HealthStatus> = {}): HealthStatus {
  return {
    platform: "android",
    androidSdk: 35,
    availability: "available",
    permissions: {
      granted: [],
      missing: ["StepsRecord", "HeartRateRecord"],
      unsupported: [],
      allRecordTypesGranted: false,
      background: "denied",
      history: "denied",
      exerciseRoutes: "denied",
    },
    power: {
      batteryOptimization: "optimized",
      backgroundRestricted: false,
      autostartSettings: "available",
    },
    pairing: { paired: false, clientId: null, serverMatchesShell: false, needsRepair: false },
    settings: { autoSync: true, historyDays: 3650 },
    sync: {
      running: false,
      phase: null,
      lastSuccessAt: null,
      lastAttemptAt: null,
      lastError: null,
      queuedBatches: 0,
      queuedRecords: 0,
      queuedDeletions: 0,
      rejectedBatches: 0,
      nextRetryAt: null,
      types: [
        {
          recordType: "StepsRecord",
          permission: "android.permission.health.READ_STEPS",
          supported: true,
          granted: false,
          state: "not_granted",
          backfill: null,
          knownRecords: 0,
          queuedRecords: 0,
          sentRecords: 0,
          sentDeletions: 0,
          lastReadAt: null,
          lastError: null,
          reread: null,
        },
      ],
    },
    ...overrides,
  };
}

/**
 * A fake of the documented shell IPC (docs/shell-contract.md): the `__SUPERDUPER_SHELL__`
 * marker plus `__TAURI_INTERNALS__.invoke`, with a small in-memory model of the health plugin.
 */
export function fakeShell(options: { status?: HealthStatus; fail?: Record<string, unknown> } = {}) {
  const calls: Call[] = [];
  let status = options.status ?? androidStatus();
  const update = (next: Partial<HealthStatus>) => {
    status = { ...status, ...next };
    return status;
  };

  const handlers: Record<string, (args: Record<string, unknown>) => unknown> = {
    shell_info: () => ({
      shell: "superduper",
      version: "0.1.0",
      platform: status.platform,
      debug: true,
      plugins: ["health"],
    }),
    get_server_url: () => ({
      url: "http://localhost:4401",
      source: "development",
      defaultUrl: "http://localhost:4401",
      allowsLoopbackHttp: true,
    }),
    set_server_url: () => null,
    "plugin:health|status": () => status,
    "plugin:health|request_permissions": () =>
      update({
        permissions: {
          ...status.permissions,
          granted: [...status.permissions.granted, ...status.permissions.missing],
          missing: [],
          allRecordTypesGranted: true,
        },
      }),
    "plugin:health|open_health_connect": () => status,
    "plugin:health|pair": (args) =>
      update({
        pairing: {
          paired: true,
          clientId: String(args.clientId),
          serverMatchesShell: true,
          needsRepair: false,
        },
        sync: { ...status.sync, running: true, phase: "Uploading" },
      }),
    "plugin:health|unpair": () =>
      update({
        pairing: { paired: false, clientId: null, serverMatchesShell: false, needsRepair: false },
      }),
    "plugin:health|sync_now": () => {
      if (!status.pairing.paired) {
        return Promise.reject({ code: "NOT_PAIRED", message: "Pair this device first." });
      }
      return update({ sync: { ...status.sync, running: true, phase: "Reading StepsRecord" } });
    },
    "plugin:health|set_auto_sync": (args) =>
      update({ settings: { ...status.settings, autoSync: Boolean(args.enabled) } }),
    "plugin:health|set_history_days": (args) =>
      update({ settings: { ...status.settings, historyDays: Number(args.days) } }),
    "plugin:health|request_exercise_routes": () =>
      update({ permissions: { ...status.permissions, exerciseRoutes: "granted" } }),
    "plugin:health|request_battery_exemption": () =>
      update({ power: { ...status.power, batteryOptimization: "exempt" } }),
    "plugin:health|open_autostart_settings": () => {
      if (status.power.autostartSettings === "unsupported") {
        return Promise.reject({ code: "UNSUPPORTED", message: "No autostart settings screen." });
      }
      return status;
    },
  };

  const invoke = (command: string, args?: Record<string, unknown>) => {
    calls.push({ command, args });
    const failure = options.fail?.[command];
    if (failure !== undefined) return Promise.reject(failure);
    const handler = handlers[command];
    if (!handler) return Promise.reject(`Command ${command} not found`);
    try {
      return Promise.resolve(handler(args ?? {})).then((value) => structuredClone(value));
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const target: ShellWindow = {
    __SUPERDUPER_SHELL__: Object.freeze({
      shell: "superduper",
      platform: "android",
      version: "0.1.0",
    }),
    __TAURI_INTERNALS__: { invoke },
  };

  return {
    target,
    calls,
    get status() {
      return status;
    },
    install() {
      Object.assign(globalThis, target);
      return () => {
        const globals = globalThis as ShellWindow;
        delete globals.__SUPERDUPER_SHELL__;
        delete globals.__TAURI_INTERNALS__;
      };
    },
  };
}
