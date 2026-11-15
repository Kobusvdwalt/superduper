import { describe, expect, test } from "bun:test";

import { detectShell, type HealthStatus, ShellError, toShellError } from "@/lib/shell";

import { androidStatus, fakeShell } from "../support/fake-shell";

describe("detectShell", () => {
  test("is null in a normal browser", () => {
    expect(detectShell({})).toBeNull();
  });

  test("needs both the marker and a callable invoke", () => {
    const { target } = fakeShell();
    expect(detectShell({ __SUPERDUPER_SHELL__: target.__SUPERDUPER_SHELL__ })).toBeNull();
    expect(detectShell({ __TAURI_INTERNALS__: target.__TAURI_INTERNALS__ })).toBeNull();
    expect(
      detectShell({ ...target, __SUPERDUPER_SHELL__: { shell: "other", platform: "android" } }),
    ).toBeNull();
    expect(detectShell({ ...target, __TAURI_INTERNALS__: { invoke: "nope" } })).toBeNull();
    expect(detectShell(target)?.platform).toBe("android");
  });
});

describe("shell commands", () => {
  test("map to the documented command names and camelCase arguments", async () => {
    const fake = fakeShell();
    const shell = detectShell(fake.target);
    if (!shell) throw new Error("expected a shell");

    expect((await shell.info()).plugins).toEqual(["health"]);
    expect((await shell.getServerUrl()).source).toBe("development");
    await shell.setServerUrl(null);
    await shell.health.status();
    await shell.health.requestPermissions();
    await shell.health.openHealthConnect();
    const paired = await shell.health.pair({ token: "sd_secret", clientId: "c1" });
    await shell.health.syncNow();
    await shell.health.setAutoSync(false);
    const after = await shell.health.setHistoryDays(30);
    const routes = await shell.health.requestExerciseRoutes();
    const exempt = await shell.health.requestBatteryExemption();
    await shell.health.openAutostartSettings();
    await shell.health.unpair();

    expect(paired.pairing).toMatchObject({ paired: true, clientId: "c1" });
    expect(after.settings).toEqual({ autoSync: false, historyDays: 30 });
    expect(routes.permissions.exerciseRoutes).toBe("granted");
    expect(exempt.power.batteryOptimization).toBe("exempt");
    expect(fake.calls).toEqual([
      { command: "shell_info", args: undefined },
      { command: "get_server_url", args: undefined },
      { command: "set_server_url", args: { url: null } },
      { command: "plugin:health|status", args: undefined },
      { command: "plugin:health|request_permissions", args: undefined },
      { command: "plugin:health|open_health_connect", args: undefined },
      { command: "plugin:health|pair", args: { token: "sd_secret", clientId: "c1" } },
      { command: "plugin:health|sync_now", args: undefined },
      { command: "plugin:health|set_auto_sync", args: { enabled: false } },
      { command: "plugin:health|set_history_days", args: { days: 30 } },
      { command: "plugin:health|request_exercise_routes", args: undefined },
      { command: "plugin:health|request_battery_exemption", args: undefined },
      { command: "plugin:health|open_autostart_settings", args: undefined },
      { command: "plugin:health|unpair", args: undefined },
    ]);
  });

  test("a ShellError rejection keeps its code and message", async () => {
    const shell = detectShell(fakeShell().target);
    const error = await shell?.health.syncNow().catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ShellError);
    expect(error).toMatchObject({ code: "NOT_PAIRED", message: "Pair this device first." });
  });

  test("an UNSUPPORTED rejection keeps its code", async () => {
    const status = androidStatus();
    const shell = detectShell(
      fakeShell({
        status: { ...status, power: { ...status.power, autostartSettings: "unsupported" } },
      }).target,
    );
    const error = await shell?.health.openAutostartSettings().catch((reason: unknown) => reason);
    expect(error).toMatchObject({ code: "UNSUPPORTED", message: "No autostart settings screen." });
  });

  test("a plain-string rejection from the access-control layer becomes REFUSED", async () => {
    const shell = detectShell(
      fakeShell({ fail: { "plugin:health|status": "plugin:health|status not allowed" } }).target,
    );
    const error = await shell?.health.status().catch((reason: unknown) => reason);
    expect(error).toMatchObject({ code: "REFUSED", message: "plugin:health|status not allowed" });
  });

  test("a status from a shell built before power, retry and re-read existed is filled in", async () => {
    const { power: _power, ...older } = androidStatus();
    const status = {
      ...older,
      sync: {
        ...older.sync,
        nextRetryAt: undefined,
        types: older.sync.types.map(({ reread: _reread, ...type }) => type),
      },
    } as unknown as HealthStatus;
    const shell = detectShell(fakeShell({ status }).target);
    const reported = await shell?.health.status();
    expect(reported?.power).toEqual({
      batteryOptimization: "unsupported",
      backgroundRestricted: null,
      autostartSettings: "unsupported",
    });
    expect(reported?.sync.nextRetryAt).toBeNull();
    expect(reported?.sync.types.every((type) => type.reread === null)).toBe(true);
  });

  test("a command the installed shell does not have yet asks for an app update", async () => {
    const shell = detectShell(
      fakeShell({
        fail: {
          "plugin:health|request_exercise_routes":
            "Command plugin:health|request_exercise_routes not found",
        },
      }).target,
    );
    const error = await shell?.health.requestExerciseRoutes().catch((reason: unknown) => reason);
    expect(error).toMatchObject({ code: "UNSUPPORTED" });
    expect((error as ShellError).message).toContain("Update the app");
  });

  test("a synchronous throw from invoke is a rejection, not an exception", async () => {
    const shell = detectShell({
      __SUPERDUPER_SHELL__: { shell: "superduper", platform: "linux", version: "0.1.0" },
      __TAURI_INTERNALS__: {
        invoke: () => {
          throw new Error("boom");
        },
      },
    });
    const error = await shell?.health.status().catch((reason: unknown) => reason);
    expect(error).toMatchObject({ code: "INTERNAL", message: "boom" });
  });

  test("desktop resolves with an unsupported_platform status", async () => {
    const status = androidStatus({
      platform: "linux",
      androidSdk: null,
      availability: "unsupported_platform",
    });
    const shell = detectShell(fakeShell({ status }).target);
    expect((await shell?.health.status())?.availability).toBe("unsupported_platform");
  });
});

describe("toShellError", () => {
  test("unknown codes and shapes fall back to INTERNAL", () => {
    expect(toShellError({ code: "WHAT", message: "x" })).toMatchObject({
      code: "INTERNAL",
      message: "x",
    });
    expect(toShellError(42).code).toBe("INTERNAL");
    expect(toShellError({ code: "UNAVAILABLE", message: "Install it" }).code).toBe("UNAVAILABLE");
  });
});
