import { beforeAll, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";

import { healthQuantitySamples, healthRawRecords } from "../../src/db/schema";
import { reprojectAll } from "../../src/health/projection/reproject";
import { useTestApp } from "../_hooks/app";
import { batch, loadFixtures, steps, sync } from "./helpers";

const app = useTestApp();

describe("health queries", () => {
  let cookie: string;
  let token: string;
  let clientId: string;

  beforeAll(async () => {
    await app.signUp();
    cookie = await app.signIn();
    ({ token, id: clientId } = await app.createClient(cookie));

    const fixtures = await loadFixtures();
    await sync(app, token, batch([...fixtures.values()]));

    const hourly = Array.from({ length: 48 }, (_, hour) => {
      const start = new Date(Date.UTC(2026, 10, 1, hour));
      const end = new Date(start.getTime() + 3_600_000);
      return steps(`hourly-${hour}`, 100, "2026-11-03T00:00:00Z", {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      });
    });
    const watch = steps("watch-1", 7, "2026-11-03T00:00:00Z", {
      dataOrigin: "com.example.watch",
      startTime: "2026-11-01T05:00:00Z",
      endTime: "2026-11-01T05:30:00Z",
    });
    await sync(app, token, batch([...hourly, watch]));
  });

  test("quantitySamples pages with a cursor in start-time order", async () => {
    const query = `query($after: String) {
      health { quantitySamples(metric: STEPS, from: "2026-11-01T00:00:00Z", to: "2026-11-02T00:00:00Z", limit: 10, after: $after) {
        items { startTime value unit dataOrigin } nextCursor
      } }
    }`;
    const seen: string[] = [];
    let after: string | null = null;
    for (let page = 0; page < 10; page += 1) {
      const result: { errors: unknown[]; data: any } = await app.execute(query, {
        cookie,
        variables: { after },
      });
      expect(result.errors).toEqual([]);
      const { items, nextCursor } = result.data.health.quantitySamples as {
        items: { startTime: string }[];
        nextCursor: string | null;
      };
      seen.push(...items.map((item) => item.startTime));
      after = nextCursor;
      if (!after) break;
    }
    expect(seen).toHaveLength(25);
    expect([...seen].sort()).toEqual(seen);
  });

  test("dataOrigin filters samples", async () => {
    const result = await app.execute(
      `{ health { quantitySamples(metric: STEPS, dataOrigin: "com.example.watch") { items { value } } } }`,
      { token },
    );
    expect(result.data.health.quantitySamples.items).toEqual([{ value: 7 }]);
  });

  test("an invalid cursor is BAD_USER_INPUT", async () => {
    const result = await app.execute(
      `{ health { quantitySamples(metric: STEPS, after: "bm9wZQ") { nextCursor } } }`,
      { cookie },
    );
    expect(result.code).toBe("BAD_USER_INPUT");
  });

  test("quantitySeries buckets by calendar day in the given time zone", async () => {
    const query = `query($tz: String) { health { quantitySeries(
      metric: STEPS, from: "2026-10-31T00:00:00Z", to: "2026-11-04T00:00:00Z",
      bucket: DAY, aggregation: SUM, dataOrigin: "com.example.fitness", timeZone: $tz
    ) { unit buckets { bucketStart value count } } } }`;

    const utc = await app.execute(query, { cookie, variables: { tz: "UTC" } });
    expect(utc.data.health.quantitySeries.unit).toBe("count");
    expect(utc.data.health.quantitySeries.buckets).toEqual([
      { bucketStart: "2026-11-01T00:00:00.000Z", value: 2400, count: 24 },
      { bucketStart: "2026-11-02T00:00:00.000Z", value: 2400, count: 24 },
    ]);

    const sast = await app.execute(query, { cookie, variables: { tz: "Africa/Johannesburg" } });
    expect(sast.data.health.quantitySeries.buckets).toEqual([
      { bucketStart: "2026-10-31T22:00:00.000Z", value: 2200, count: 22 },
      { bucketStart: "2026-11-01T22:00:00.000Z", value: 2400, count: 24 },
      { bucketStart: "2026-11-02T22:00:00.000Z", value: 200, count: 2 },
    ]);
  });

  test("quantitySeries aggregates heart rate", async () => {
    const result = await app.execute(
      `{ health { quantitySeries(metric: HEART_RATE, from: "2026-11-10T00:00:00Z", to: "2026-11-11T00:00:00Z", bucket: HOUR, aggregation: MAX) { buckets { value count } } } }`,
      { cookie },
    );
    expect(result.data.health.quantitySeries.buckets).toEqual([{ value: 131, count: 3 }]);
  });

  test("quantitySeries rejects bad time zones and oversized ranges", async () => {
    const run = (args: string) =>
      app.execute(
        `{ health { quantitySeries(metric: STEPS, aggregation: SUM, ${args}) { unit } } }`,
        { cookie },
      );
    expect(
      (
        await run(
          `from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z", bucket: DAY, timeZone: "Mars/Olympus"`,
        )
      ).code,
    ).toBe("BAD_USER_INPUT");
    expect(
      (await run(`from: "2000-01-01T00:00:00Z", to: "2026-01-01T00:00:00Z", bucket: HOUR`)).code,
    ).toBe("BAD_USER_INPUT");
    expect(
      (await run(`from: "2026-02-01T00:00:00Z", to: "2026-01-01T00:00:00Z", bucket: DAY`)).code,
    ).toBe("BAD_USER_INPUT");
  });

  test("sleepSessions, workouts and nutritionEntries return typed detail", async () => {
    const result = await app.execute(
      `{ health {
        sleepSessions { items { startTime endTime dataOrigin stages { stage startTime } } }
        workouts { items { activityType title routeStatus segments { segmentType } laps { lengthMeters } route { latitude altitudeMeters } } }
        nutritionEntries { items { mealType name energyKilocalories proteinGrams nutrients { nutrient value unit } } }
      } }`,
      { token },
    );
    expect(result.errors).toEqual([]);
    const { sleepSessions, workouts, nutritionEntries } = result.data.health;

    expect(sleepSessions.items[0].stages[0]).toEqual({
      stage: "AWAKE_IN_BED",
      startTime: "2026-11-09T21:30:00.000Z",
    });
    expect(workouts.items[0]).toMatchObject({
      activityType: "RUNNING",
      routeStatus: "DATA",
      segments: [{ segmentType: "RUNNING" }, { segmentType: "WALKING" }],
      route: [
        { latitude: -33.9249, altitudeMeters: 12 },
        { latitude: -33.9251, altitudeMeters: null },
      ],
    });
    const meal = nutritionEntries.items[0];
    expect(meal.mealType).toBe("BREAKFAST");
    expect(meal.nutrients).toContainEqual({
      nutrient: "energyFromFat",
      value: 108.9,
      unit: "kilocalories",
    });
  });

  test("rawRecords returns payloads and filters by type", async () => {
    const result = await app.execute(
      `{ health { rawRecords(recordType: "MindfulnessSessionRecord") { items { recordType clientId payload projectionError } } } }`,
      { cookie },
    );
    expect(result.data.health.rawRecords.items).toHaveLength(1);
    expect(result.data.health.rawRecords.items[0]).toMatchObject({
      clientId,
      projectionError: null,
      payload: { mindfulnessSessionTypeName: "MEDITATION" },
    });
  });

  test("metrics and recordTypes summarise coverage per data origin", async () => {
    const result = await app.execute(
      `{ health {
        metrics { metric dataOrigin unit count firstTime lastTime }
        recordTypes { recordType dataOrigin count projectionErrors }
      } }`,
      { cookie },
    );
    const stepsCoverage = result.data.health.metrics.filter(
      (m: { metric: string }) => m.metric === "STEPS",
    );
    expect(stepsCoverage).toEqual([
      {
        metric: "STEPS",
        dataOrigin: "com.example.fitness",
        unit: "count",
        count: 49,
        firstTime: "2026-11-01T00:00:00.000Z",
        lastTime: "2026-11-10T06:00:00.000Z",
      },
      {
        metric: "STEPS",
        dataOrigin: "com.example.watch",
        unit: "count",
        count: 1,
        firstTime: "2026-11-01T05:00:00.000Z",
        lastTime: "2026-11-01T05:00:00.000Z",
      },
    ]);
    expect(result.data.health.recordTypes).toContainEqual({
      recordType: "OvulationTestRecord",
      dataOrigin: "com.example.cycle",
      count: 1,
      projectionErrors: 0,
    });
  });

  test("syncBatches and clientSyncs report the latest syncs", async () => {
    const result = await app.execute(
      `query($clientId: UUID) { health {
        syncBatches(clientId: $clientId, limit: 1) { items { recordCount } nextCursor }
        clientSyncs { client { id name } batches lastSyncedAt }
      } }`,
      { cookie, variables: { clientId } },
    );
    expect(result.data.health.syncBatches.items).toEqual([{ recordCount: 49 }]);
    expect(result.data.health.syncBatches.nextCursor).not.toBeNull();
    expect(result.data.health.clientSyncs).toMatchObject([
      { client: { id: clientId }, batches: 2 },
    ]);
  });

  test("reads require a viewer", async () => {
    expect((await app.execute(`{ health { metrics { count } } }`)).code).toBe("UNAUTHENTICATED");
  });

  test("health:reproject rebuilds the typed tables from raw", async () => {
    const before = await app.db.select().from(healthQuantitySamples);
    await app.db.delete(healthQuantitySamples);
    await app.db
      .update(healthRawRecords)
      .set({ projectionError: "stale" })
      .where(eq(healthRawRecords.recordType, "WeightRecord"));

    const result = await reprojectAll(app.db);
    expect(result).toEqual({ records: 41 + 49, errors: 0 });

    const after = await app.db.select().from(healthQuantitySamples);
    const key = (row: (typeof before)[number]) =>
      `${row.metric}|${row.startTime.toISOString()}|${row.value}`;
    expect(after.map(key).sort()).toEqual(before.map(key).sort());
    const [weight] = await app.db
      .select()
      .from(healthRawRecords)
      .where(eq(healthRawRecords.recordType, "WeightRecord"));
    expect(weight?.projectionError).toBeNull();
  });
});
