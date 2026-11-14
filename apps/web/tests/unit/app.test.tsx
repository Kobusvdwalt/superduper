import { describe, expect, test } from "bun:test";

import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { renderApp } from "../support/app";

const COVERAGE = () => ({
  health: {
    metrics: [
      {
        metric: "STEPS",
        unit: "count",
        dataOrigin: "com.example.phone",
        count: 476,
        firstTime: "2026-10-17T04:00:00.000Z",
        lastTime: "2026-11-13T20:00:00.000Z",
      },
      {
        metric: "HEART_RATE",
        unit: "bpm",
        dataOrigin: "com.example.watch",
        count: 8064,
        firstTime: "2026-10-17T00:00:00.000Z",
        lastTime: "2026-11-13T23:55:00.000Z",
      },
    ],
    recordTypes: [
      {
        recordType: "StepsRecord",
        dataOrigin: "com.example.phone",
        count: 476,
        projectionErrors: 0,
        firstTime: "2026-10-17T04:00:00.000Z",
        lastTime: "2026-11-13T20:00:00.000Z",
      },
    ],
  },
});

const SERIES = (variables: Record<string, unknown>) => ({
  health: {
    quantitySeries: {
      metric: variables.metric,
      unit: variables.metric === "STEPS" ? "count" : "bpm",
      buckets: [{ bucketStart: "2026-11-01T00:00:00.000Z", value: 9000, count: 17 }],
    },
  },
});

describe("app", () => {
  test("signed out, a deep link lands on sign-in", async () => {
    const { router } = renderApp("/health/sleep", { signedIn: false });
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeDefined();
    expect(router.state.location.pathname).toBe("/sign-in");
    expect(router.state.location.search).toEqual({ redirect: "/health/sleep" });
  });

  test("sign-in offers first-time owner sign-up", async () => {
    renderApp("/sign-in", { signedIn: false });
    fireEvent.click(await screen.findByRole("button", { name: /Create the owner account/ }));
    expect(screen.getByLabelText("Name")).toBeDefined();
    expect(screen.getByRole("button", { name: "Create account" })).toBeDefined();
  });

  test("the overview shows coverage and charts each metric with a fitting aggregation", async () => {
    const { calls } = renderApp("/health", {
      responses: { Coverage: COVERAGE, QuantitySeries: SERIES },
    });
    expect(await screen.findByText("Metric coverage")).toBeDefined();
    expect(screen.getAllByText("Steps").length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(calls.filter((call) => call.operation === "QuantitySeries")).toHaveLength(2),
    );
    const series = calls.filter((call) => call.operation === "QuantitySeries");
    const byMetric = Object.fromEntries(
      series.map((call) => [call.variables.metric, call.variables]),
    );
    expect(byMetric.STEPS).toMatchObject({ aggregation: "SUM", bucket: "DAY", dataOrigin: null });
    expect(byMetric.HEART_RATE).toMatchObject({ aggregation: "AVG" });
    expect(byMetric.STEPS?.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  test("the data-origin filter narrows the charts and the query", async () => {
    const { calls, router } = renderApp("/health?origin=com.example.watch", {
      responses: { Coverage: COVERAGE, QuantitySeries: SERIES },
    });
    await screen.findByText("Metric coverage");
    await waitFor(() =>
      expect(calls.some((call) => call.operation === "QuantitySeries")).toBe(true),
    );
    const series = calls.filter((call) => call.operation === "QuantitySeries");
    expect(series.map((call) => call.variables.metric)).toEqual(["HEART_RATE"]);
    expect(series[0]?.variables.dataOrigin).toBe("com.example.watch");
    fireEvent.change(screen.getByLabelText("Data origin"), { target: { value: "" } });
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  test("a record shows its payload and version history", async () => {
    renderApp("/health/records/r1", {
      responses: {
        RawRecord: () => ({
          health: {
            rawRecord: {
              id: "r1",
              clientId: "c1",
              origin: "HEALTH_CONNECT",
              recordType: "StepsRecord",
              sourceRecordId: "s-1",
              dataOrigin: "com.example.phone",
              startTime: "2026-11-10T06:00:00.000Z",
              endTime: "2026-11-10T07:00:00.000Z",
              startZoneOffsetSeconds: 7200,
              endZoneOffsetSeconds: 7200,
              modifiedAt: "2026-11-10T09:00:00.000Z",
              receivedAt: "2026-11-10T09:01:00.000Z",
              deletedAt: null,
              schemaVersion: 1,
              projectionError: null,
              payload: { count: 20 },
              versions: [
                {
                  id: "v1",
                  operation: "UPSERT",
                  applied: true,
                  modifiedAt: "2026-11-10T08:00:00.000Z",
                  deletedAt: null,
                  receivedAt: "2026-11-10T08:01:00.000Z",
                  schemaVersion: 1,
                  syncBatchId: "b1",
                  payload: { count: 10 },
                },
                {
                  id: "v2",
                  operation: "UPSERT",
                  applied: false,
                  modifiedAt: "2026-11-10T07:00:00.000Z",
                  deletedAt: null,
                  receivedAt: "2026-11-10T09:01:00.000Z",
                  schemaVersion: 1,
                  syncBatchId: "b2",
                  payload: { count: 5 },
                },
              ],
            },
          },
        }),
      },
    });
    const payload = await screen.findByLabelText("Payload JSON");
    expect(payload.textContent).toContain('"count": 20');
    expect(screen.getByText("Version history (2)")).toBeDefined();
    expect(screen.getByText("not applied")).toBeDefined();
  });

  test("creating a client shows its token once; revoking asks for confirmation", async () => {
    let revoked: string | null = null;
    const { calls } = renderApp("/settings/clients", {
      responses: {
        Clients: () => ({
          identity: {
            clients: [
              {
                id: "c1",
                name: "Pixel",
                kind: "DEVICE",
                platform: "android",
                createdAt: "2026-11-01T00:00:00.000Z",
                lastSeenAt: "2026-11-13T00:00:00.000Z",
                revokedAt: revoked,
              },
            ],
          },
          health: {
            clientSyncs: [
              { client: { id: "c1" }, lastSyncedAt: "2026-11-13T00:00:00.000Z", batches: 4 },
            ],
          },
        }),
        CreateClient: () => ({
          identity: { createClient: { token: "sd_secret", client: { id: "c2", name: "Bank" } } },
        }),
        RevokeClient: (variables) => {
          revoked = "2026-11-14T00:00:00.000Z";
          return { identity: { revokeClient: { id: variables.id, revokedAt: revoked } } };
        },
      },
    });
    expect(await screen.findByText(/4 batches/)).toBeDefined();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Bank" } });
    fireEvent.click(screen.getByRole("button", { name: "Create client" }));
    expect((await screen.findByTestId("client-token")).textContent).toBe("sd_secret");
    expect(calls.find((call) => call.operation === "CreateClient")?.variables).toEqual({
      input: { name: "Bank", kind: "CONNECTOR", platform: null },
    });

    const row = screen.getByText("Pixel").closest("tr")!;
    fireEvent.click(within(row as HTMLElement).getByRole("button", { name: "Revoke" }));
    fireEvent.click(within(row as HTMLElement).getByRole("button", { name: "Confirm revoke" }));
    expect(await screen.findByText(/^revoked/)).toBeDefined();
    expect(calls.find((call) => call.operation === "RevokeClient")?.variables).toEqual({
      id: "c1",
    });
  });
});
