import { beforeAll, describe, expect, test } from "bun:test";

import { useTestApp } from "../_hooks/app";
import { batch, steps, sync } from "./helpers";

const app = useTestApp();

const PHONE = "com.example.phone";
const WATCH = "com.example.watch";
const FIT = "com.example.fit";

function at(origin: string, day: number, hour: number, count: number) {
  const start = new Date(Date.UTC(2026, 10, day, hour));
  return steps(`${origin}-${day}-${hour}`, count, "2026-11-20T00:00:00Z", {
    dataOrigin: origin,
    startTime: start.toISOString(),
    endTime: new Date(start.getTime() + 1_800_000).toISOString(),
  });
}

const SERIES = `query($metric: HealthMetric!, $mode: HealthSourceMode, $origin: String) {
  health { quantitySeries(metric: $metric, from: "2026-11-01T00:00:00Z", to: "2026-11-05T00:00:00Z",
    bucket: DAY, aggregation: SUM, sourceMode: $mode, dataOrigin: $origin, timeZone: "UTC") {
    cumulative sourceMode
    buckets { bucketStart value dataOrigins }
    sources { dataOrigin days samples }
  } }
}`;

const PRIORITY = `{ health { sourcePriority(metric: STEPS) {
  cumulative savedOrder origins { dataOrigin rank saved days samples }
} } }`;

const SET = `mutation($metric: HealthMetric!, $origins: [String!]!) {
  health { setSourcePriority(metric: $metric, dataOrigins: $origins) { savedOrder origins { dataOrigin rank saved } } }
}`;

describe("source priority for cumulative metrics", () => {
  let cookie: string;
  let token: string;

  const series = async (variables: Record<string, unknown> = {}) => {
    const result = await app.execute(SERIES, {
      cookie,
      variables: { metric: "STEPS", ...variables },
    });
    expect(result.errors).toEqual([]);
    return result.data.health.quantitySeries;
  };
  const values = (data: { buckets: { bucketStart: string; value: number }[] }) =>
    data.buckets.map((bucket) => [bucket.bucketStart.slice(0, 10), bucket.value]);

  beforeAll(async () => {
    await app.signUp();
    cookie = await app.signIn();
    ({ token } = await app.createClient(cookie));
    // Phone and watch cover three days each; the phone has more samples, so it ranks first.
    await sync(
      app,
      token,
      batch([
        at(PHONE, 1, 9, 500),
        at(PHONE, 1, 15, 500),
        at(PHONE, 2, 12, 800),
        at(PHONE, 4, 12, 400),
        at(WATCH, 1, 12, 1200),
        at(WATCH, 2, 12, 1000),
        at(WATCH, 3, 12, 300),
        at(FIT, 1, 12, 900),
      ]),
    );
  });

  test("the default series uses one origin per day, the highest ranked with data", async () => {
    const data = await series();
    expect(data).toMatchObject({ cumulative: true, sourceMode: "PREFERRED" });
    expect(values(data)).toEqual([
      ["2026-11-01", 1000],
      ["2026-11-02", 800],
      ["2026-11-03", 300],
      ["2026-11-04", 400],
    ]);
    expect(data.buckets.map((bucket: { dataOrigins: string[] }) => bucket.dataOrigins)).toEqual([
      [PHONE],
      [PHONE],
      [WATCH],
      [PHONE],
    ]);
    expect(data.sources).toEqual([
      { dataOrigin: PHONE, days: 3, samples: 4 },
      { dataOrigin: WATCH, days: 1, samples: 1 },
    ]);
  });

  test("ALL adds every origin up, and dataOrigin filters as before", async () => {
    const all = await series({ mode: "ALL" });
    expect(all.sourceMode).toBe("ALL");
    expect(values(all)).toEqual([
      ["2026-11-01", 3100],
      ["2026-11-02", 1800],
      ["2026-11-03", 300],
      ["2026-11-04", 400],
    ]);
    expect(all.buckets[0].dataOrigins).toEqual([FIT, PHONE, WATCH]);

    const watch = await series({ origin: WATCH, mode: "PREFERRED" });
    expect(watch.sourceMode).toBe("ALL");
    expect(values(watch)).toEqual([
      ["2026-11-01", 1200],
      ["2026-11-02", 1000],
      ["2026-11-03", 300],
    ]);
  });

  test("the default ranking is exposed: most days, then most samples", async () => {
    const result = await app.execute(PRIORITY, { cookie });
    expect(result.data.health.sourcePriority).toEqual({
      cumulative: true,
      savedOrder: [],
      origins: [
        { dataOrigin: PHONE, rank: 1, saved: false, days: 3, samples: 4 },
        { dataOrigin: WATCH, rank: 2, saved: false, days: 3, samples: 3 },
        { dataOrigin: FIT, rank: 3, saved: false, days: 1, samples: 1 },
      ],
    });
  });

  test("a saved order comes first, and an empty list restores the default", async () => {
    const saved = await app.execute(SET, {
      cookie,
      variables: { metric: "STEPS", origins: [WATCH] },
    });
    expect(saved.errors).toEqual([]);
    expect(saved.data.health.setSourcePriority).toEqual({
      savedOrder: [WATCH],
      origins: [
        { dataOrigin: WATCH, rank: 1, saved: true },
        { dataOrigin: PHONE, rank: 2, saved: false },
        { dataOrigin: FIT, rank: 3, saved: false },
      ],
    });
    expect(values(await series())).toEqual([
      ["2026-11-01", 1200],
      ["2026-11-02", 1000],
      ["2026-11-03", 300],
      ["2026-11-04", 400],
    ]);

    const cleared = await app.execute(SET, { cookie, variables: { metric: "STEPS", origins: [] } });
    expect(cleared.data.health.setSourcePriority.savedOrder).toEqual([]);
    expect(values(await series())[0]).toEqual(["2026-11-01", 1000]);
  });

  test("non-cumulative metrics use every origin", async () => {
    const data = await series({ metric: "HEART_RATE", mode: "PREFERRED" });
    expect(data).toMatchObject({ cumulative: false, sourceMode: "ALL" });
  });

  test("saving validates the metric, the list and the caller", async () => {
    const run = (variables: Record<string, unknown>, credentials: object = { cookie }) =>
      app.execute(SET, { ...credentials, variables });
    expect((await run({ metric: "HEART_RATE", origins: [WATCH] })).code).toBe("BAD_USER_INPUT");
    expect((await run({ metric: "STEPS", origins: [WATCH, WATCH] })).code).toBe("BAD_USER_INPUT");
    expect((await run({ metric: "STEPS", origins: [""] })).code).toBe("BAD_USER_INPUT");
    expect((await run({ metric: "STEPS", origins: [WATCH] }, { token })).code).toBe("FORBIDDEN");
    expect((await app.execute(PRIORITY)).code).toBe("UNAUTHENTICATED");
  });
});
