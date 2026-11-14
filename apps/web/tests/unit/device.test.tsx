import { afterEach, describe, expect, test } from "bun:test";

import { fireEvent, screen, waitFor } from "@testing-library/react";

import { statusRefetchInterval } from "@/hooks/use-device";

import { renderApp } from "../support/app";
import { androidStatus, fakeShell } from "../support/fake-shell";

const CREATED = () => ({
  identity: { createClient: { token: "sd_device_token", client: { id: "c-new" } } },
});

let uninstall: (() => void) | undefined;
afterEach(() => {
  uninstall?.();
  uninstall = undefined;
});

describe("this device", () => {
  test("in a browser the panel explains it only works in the app", async () => {
    renderApp("/settings/device");
    expect(await screen.findByText("Only available in the app")).toBeDefined();
  });

  test("pairing creates a DEVICE client, hands the token to the shell and asks for permissions", async () => {
    const fake = fakeShell();
    uninstall = fake.install();
    const { calls } = renderApp("/settings/device", {
      responses: { CreateDeviceClient: CREATED },
    });

    expect(await screen.findByText("Available")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Pair this device" }));

    expect(await screen.findByText("c-new")).toBeDefined();
    expect(calls).toContainEqual({
      operation: "CreateDeviceClient",
      variables: { input: { kind: "DEVICE", name: "Android app", platform: "android" } },
    });
    expect(fake.calls.map((call) => call.command)).toContain("plugin:health|request_permissions");
    expect(fake.calls.find((call) => call.command === "plugin:health|pair")?.args).toEqual({
      token: "sd_device_token",
      clientId: "c-new",
    });
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain("sd_device_token");
    expect(JSON.stringify(Object.entries(sessionStorage))).not.toContain("sd_device_token");
  });

  test("a failed pair revokes the client it just created and shows the shell's message", async () => {
    const fake = fakeShell({
      fail: { "plugin:health|pair": { code: "INTERNAL", message: "Keystore unavailable" } },
    });
    uninstall = fake.install();
    const { calls } = renderApp("/settings/device", {
      responses: {
        CreateDeviceClient: CREATED,
        RevokeDeviceClient: () => ({ identity: { revokeClient: { id: "c-new" } } }),
      },
    });

    fireEvent.click(await screen.findByRole("button", { name: "Pair this device" }));
    expect(await screen.findByText("Keystore unavailable")).toBeDefined();
    expect(calls).toContainEqual({ operation: "RevokeDeviceClient", variables: { id: "c-new" } });
  });

  test("a paired device syncs, toggles auto-sync, changes the history window and unpairs", async () => {
    const fake = fakeShell({
      status: androidStatus({
        pairing: { paired: true, clientId: "c-old", serverMatchesShell: true, needsRepair: false },
      }),
    });
    uninstall = fake.install();
    const { calls } = renderApp("/settings/device", {
      responses: {
        RevokeDeviceClient: () => ({ identity: { revokeClient: { id: "c-old" } } }),
      },
    });

    fireEvent.click(await screen.findByRole("button", { name: "Sync now" }));
    expect(await screen.findByText("Reading StepsRecord")).toBeDefined();

    fireEvent.click(screen.getByRole("switch", { name: "Sync automatically every hour" }));
    await waitFor(() => expect(fake.status.settings.autoSync).toBe(false));

    fireEvent.change(screen.getByLabelText("History window (days)"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(fake.status.settings.historyDays).toBe(90));

    fireEvent.click(screen.getByRole("button", { name: "Unpair" }));
    expect(await screen.findByRole("button", { name: "Pair this device" })).toBeDefined();
    expect(calls).toContainEqual({ operation: "RevokeDeviceClient", variables: { id: "c-old" } });
  });

  test("explains and requests exercise route access", async () => {
    const fake = fakeShell();
    uninstall = fake.install();
    renderApp("/settings/device");

    expect(await screen.findByText(/“Allow all” does not include exercise routes/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Allow exercise routes" }));
    await waitFor(() => expect(fake.status.permissions.exerciseRoutes).toBe("granted"));
    await waitFor(() => expect(screen.queryByText("Allow exercise routes") === null).toBe(true));
    expect(fake.calls.map((call) => call.command)).toContain(
      "plugin:health|request_exercise_routes",
    );
  });

  test("background sync asks for the battery exemption and opens autostart settings", async () => {
    const fake = fakeShell();
    uninstall = fake.install();
    renderApp("/settings/device");

    expect(await screen.findByText(/Autostart is on for Super Duper/)).toBeDefined();
    expect(screen.getByText("Optimised")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Stop optimising battery" }));
    expect(await screen.findByText("Exempt")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Stop optimising battery" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open autostart settings" }));
    await waitFor(() =>
      expect(fake.calls.map((call) => call.command)).toContain(
        "plugin:health|open_autostart_settings",
      ),
    );
  });

  test("restricted background activity and a missing autostart screen are explained", async () => {
    const status = androidStatus();
    uninstall = fakeShell({
      status: {
        ...status,
        power: {
          batteryOptimization: "exempt",
          backgroundRestricted: true,
          autostartSettings: "unsupported",
        },
      },
    }).install();
    renderApp("/settings/device");

    expect(await screen.findByText(/Background activity is restricted/)).toBeDefined();
    expect(screen.getByText("No autostart setting on this phone")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Open autostart settings" })).toBeNull();
  });

  test("a revoked pairing asks to pair again", async () => {
    uninstall = fakeShell({
      status: androidStatus({
        pairing: { paired: true, clientId: "c-old", serverMatchesShell: true, needsRepair: true },
      }),
    }).install();
    renderApp("/settings/device");
    expect(await screen.findByText(/rejected this device's token/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Pair again" })).toBeDefined();
  });

  test("the status is polled while a sync runs or a retry is pending, not when idle", () => {
    const idle = androidStatus();
    expect(statusRefetchInterval(undefined)).toBe(false);
    expect(statusRefetchInterval(idle)).toBe(false);
    expect(statusRefetchInterval({ ...idle, sync: { ...idle.sync, running: true } })).toBe(2_000);
    expect(
      statusRefetchInterval({
        ...idle,
        sync: { ...idle.sync, nextRetryAt: "2026-11-15T00:00:00Z" },
      }),
    ).toBe(10_000);
  });
});
