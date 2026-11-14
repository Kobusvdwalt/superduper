import { beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { and, asc, count, eq } from "drizzle-orm";

import {
  clients,
  healthQuantitySamples,
  healthRawRecords,
  healthRawRecordVersions,
  healthWorkoutRoutePoints,
  healthWorkouts,
  syncBatches,
} from "../../src/db/schema";
import { useTestApp } from "../_hooks/app";
import { batch, deletion, loadFixtures, steps, sync } from "./helpers";

const app = useTestApp();

async function raw(sourceRecordId: string) {
  const [row] = await app.db
    .select()
    .from(healthRawRecords)
    .where(eq(healthRawRecords.sourceRecordId, sourceRecordId));
  return row;
}

async function versions(sourceRecordId: string) {
  return app.db
    .select()
    .from(healthRawRecordVersions)
    .where(eq(healthRawRecordVersions.sourceRecordId, sourceRecordId))
    .orderBy(asc(healthRawRecordVersions.id));
}

async function stepValues(sourceRecordId: string) {
  const rows = await app.db
    .select({ value: healthQuantitySamples.value })
    .from(healthQuantitySamples)
    .innerJoin(healthRawRecords, eq(healthRawRecords.id, healthQuantitySamples.rawRecordId))
    .where(eq(healthRawRecords.sourceRecordId, sourceRecordId));
  return rows.map((row) => row.value);
}

async function tableCounts() {
  const [records] = await app.db.select({ n: count() }).from(healthRawRecords);
  const [history] = await app.db.select({ n: count() }).from(healthRawRecordVersions);
  const [batches] = await app.db.select({ n: count() }).from(syncBatches);
  const [samples] = await app.db.select({ n: count() }).from(healthQuantitySamples);
  return { records: records?.n, history: history?.n, batches: batches?.n, samples: samples?.n };
}

describe("health.sync", () => {
  let cookie: string;
  let token: string;
  let id: string;

  beforeAll(async () => {
    await app.signUp();
    cookie = await app.signIn();
    ({ token } = await app.createClient(cookie));
  });

  beforeEach(() => {
    id = `steps-${crypto.randomUUID()}`;
  });

  describe("authorisation", () => {
    test("anonymous callers and revoked tokens are UNAUTHENTICATED", async () => {
      expect(
        (
          await app.execute(
            `mutation { health { sync(input: { batchId: "${crypto.randomUUID()}", schemaVersion: 1, records: [], deletions: [] }) { replayed } } }`,
          )
        ).code,
      ).toBe("UNAUTHENTICATED");

      const revoked = await app.createClient(cookie, "Old phone");
      await app.execute(`mutation($id: UUID!) { identity { revokeClient(id: $id) { id } } }`, {
        cookie,
        variables: { id: revoked.id },
      });
      expect((await sync(app, revoked.token, batch())).code).toBe("UNAUTHENTICATED");
    });

    test("a web session may not sync", async () => {
      const result = await app.execute(
        `mutation($input: HealthSyncInput!) { health { sync(input: $input) { replayed } } }`,
        { cookie, variables: { input: batch() } },
      );
      expect(result.code).toBe("FORBIDDEN");
    });
  });

  describe("storage", () => {
    test("stores the record, its envelope, a version and the batch", async () => {
      const record = steps(id, 100, "2026-11-10T08:00:00Z");
      const input = batch([record]);
      const result = await sync(app, token, input);
      expect(result.errors).toEqual([]);
      expect(result.data.health.sync).toEqual({
        batchId: input.batchId,
        replayed: false,
        acceptedRecords: 1,
        acceptedDeletions: 0,
      });

      const row = await raw(id);
      expect(row).toMatchObject({
        origin: "HEALTH_CONNECT",
        recordType: "StepsRecord",
        dataOrigin: "com.example.fitness",
        startTime: new Date("2026-11-10T06:00:00Z"),
        endTime: new Date("2026-11-10T07:00:00Z"),
        startZoneOffsetSeconds: 7200,
        modifiedAt: new Date("2026-11-10T08:00:00Z"),
        schemaVersion: 1,
        deletedAt: null,
        payload: record.payload,
      });
      expect(await versions(id)).toMatchObject([{ operation: "UPSERT", applied: true }]);
      expect(await stepValues(id)).toEqual([100]);
    });

    test("an unknown record type is stored raw without a projection error", async () => {
      const record = steps(id, 1, "2026-11-10T08:00:00Z", {
        recordType: "FutureThingRecord",
        payload: { anything: [1, { nested: true }], metadata: { id } },
      });
      expect((await sync(app, token, batch([record]))).errors).toEqual([]);
      const row = await raw(id);
      expect(row?.payload).toEqual(record.payload);
      expect(row?.projectionError).toBeNull();
    });

    test("a payload that cannot be projected is still stored, with the error recorded", async () => {
      const record = steps(id, 1, "2026-11-10T08:00:00Z");
      record.payload.count = "many";
      const result = await sync(app, token, batch([record]));
      expect(result.errors).toEqual([]);

      const row = await raw(id);
      expect(row?.payload.count).toBe("many");
      expect(row?.projectionError).toContain("count");
      expect(row?.projectedAt).toBeNull();
      expect(await stepValues(id)).toEqual([]);
    });

    test("a unit outside the canonical one is a projection error, not a rejection", async () => {
      const record = steps(id, 1, "2026-11-10T08:00:00Z", { recordType: "DistanceRecord" });
      record.payload.distance = { value: 2.5, unit: "kilometers" };
      expect((await sync(app, token, batch([record]))).errors).toEqual([]);
      expect((await raw(id))?.projectionError).toContain("distance.unit");
    });

    test("a second client pushing the same source record updates the same record", async () => {
      const first = await app.db.select().from(clients).where(eq(clients.name, "Test phone"));
      const repaired = await app.createClient(cookie, "Same phone, paired again");
      await sync(app, token, batch([steps(id, 100, "2026-11-10T08:00:00Z")]));
      await sync(app, repaired.token, batch([steps(id, 100, "2026-11-10T08:00:00Z")]));

      const rows = await app.db
        .select()
        .from(healthRawRecords)
        .where(eq(healthRawRecords.sourceRecordId, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.clientId).toBe(first[0]!.id);
      expect(await versions(id)).toHaveLength(1);
      expect(await stepValues(id)).toEqual([100]);

      await sync(app, repaired.token, batch([steps(id, 120, "2026-11-10T09:00:00Z")]));
      expect((await raw(id))?.clientId).toBe(repaired.id);
      expect((await versions(id)).map((v) => v.clientId)).toEqual([first[0]!.id, repaired.id]);
      expect(await stepValues(id)).toEqual([120]);
    });

    test("two clients pushing the same new record at once store it once", async () => {
      const other = await app.createClient(cookie, "Racing tablet");
      const results = await Promise.all([
        sync(app, token, batch([steps(id, 5, "2026-11-10T08:00:00Z")])),
        sync(app, other.token, batch([steps(id, 5, "2026-11-10T08:00:00Z")])),
      ]);
      expect(results.map((result) => result.errors)).toEqual([[], []]);
      expect(await versions(id)).toHaveLength(1);
      expect(await stepValues(id)).toEqual([5]);
    });

    test("a deletion from another client of the user applies", async () => {
      const other = await app.createClient(cookie, "Other phone");
      await sync(app, token, batch([steps(id, 100, "2026-11-10T08:00:00Z")]));
      await sync(app, other.token, batch([], [deletion(id, "2026-11-10T10:00:00Z")]));
      expect((await raw(id))?.deletedAt).toEqual(new Date("2026-11-10T10:00:00Z"));
      expect(await stepValues(id)).toEqual([]);
    });

    test("revoking or deleting a client keeps its health data", async () => {
      const old = await app.createClient(cookie, "Lost phone");
      await sync(app, old.token, batch([steps(id, 100, "2026-11-10T08:00:00Z")]));
      await app.execute(`mutation($id: UUID!) { identity { revokeClient(id: $id) { id } } }`, {
        cookie,
        variables: { id: old.id },
      });
      expect((await raw(id))?.clientId).toBe(old.id);

      await app.db.delete(clients).where(eq(clients.id, old.id));
      const row = await raw(id);
      expect(row).toMatchObject({ clientId: null, deletedAt: null });
      expect(row?.payload.count).toBe(100);
      expect(await versions(id)).toMatchObject([{ clientId: null }]);
      expect(await stepValues(id)).toEqual([100]);
      const [kept] = await app.db
        .select({ n: count() })
        .from(syncBatches)
        .where(eq(syncBatches.id, row!.syncBatchId));
      expect(kept?.n).toBe(1);
    });
  });

  describe("idempotency", () => {
    test("replaying a batch succeeds with replayed: true and changes nothing", async () => {
      const input = batch(
        [steps(id, 100, "2026-11-10T08:00:00Z")],
        [deletion("gone", "2026-11-10T09:00:00Z")],
      );
      await sync(app, token, input);
      const before = await tableCounts();
      const receivedAt = (await raw(id))?.receivedAt;

      const replay = await sync(app, token, input);
      expect(replay.errors).toEqual([]);
      expect(replay.data.health.sync).toEqual({
        batchId: input.batchId,
        replayed: true,
        acceptedRecords: 1,
        acceptedDeletions: 1,
      });
      expect(await tableCounts()).toEqual(before);
      expect((await raw(id))?.receivedAt).toEqual(receivedAt);
    });

    test("a replay with reordered payload keys is the same content", async () => {
      const record = steps(id, 100, "2026-11-10T08:00:00Z");
      const input = batch([record]);
      await sync(app, token, input);
      const reordered = Object.fromEntries(Object.entries(record.payload).reverse());
      const replay = await sync(app, token, {
        ...input,
        records: [{ ...record, payload: reordered }],
      });
      expect(replay.data.health.sync.replayed).toBe(true);
    });

    test("the same batchId with different content is a CONFLICT and applies nothing", async () => {
      const input = batch([steps(id, 100, "2026-11-10T08:00:00Z")]);
      await sync(app, token, input);
      const changed = { ...input, records: [steps(id, 200, "2026-11-11T08:00:00Z")] };
      const result = await sync(app, token, changed);
      expect(result.code).toBe("CONFLICT");
      expect((await raw(id))?.payload.count).toBe(100);
    });

    test("a batchId is scoped to its client: another client's is neither a replay nor a CONFLICT", async () => {
      const other = await app.createClient(cookie, "Watch");
      const input = batch([steps(id, 100, "2026-11-10T08:00:00Z")]);
      await sync(app, token, input);

      const same = await sync(app, other.token, input);
      expect(same.errors).toEqual([]);
      expect(same.data.health.sync.replayed).toBe(false);
      expect(await versions(id)).toHaveLength(1);

      const different = await sync(app, other.token, {
        ...batch([steps(id, 200, "2026-11-10T09:00:00Z")]),
        batchId: crypto.randomUUID(),
      });
      expect(different.errors).toEqual([]);
      const reused = await sync(app, token, { ...input, records: [] });
      expect(reused.code).toBe("CONFLICT");
      expect((await raw(id))?.payload.count).toBe(200);
    });

    test("a rejected batch stores nothing, so its batchId stays usable", async () => {
      const bad = steps(id, 1, "2026-11-10T08:00:00Z", { endTime: "2026-11-10T05:00:00Z" });
      const input = batch([steps(`${id}-ok`, 1, "2026-11-10T08:00:00Z"), bad]);
      const before = await tableCounts();
      expect((await sync(app, token, input)).code).toBe("BAD_USER_INPUT");
      expect(await tableCounts()).toEqual(before);

      const retry = await sync(app, token, { ...input, records: [input.records[0]!] });
      expect(retry.data.health.sync.replayed).toBe(false);
    });
  });

  describe("modifiedAt ordering", () => {
    test("a newer record replaces the stored one and its projection", async () => {
      await sync(app, token, batch([steps(id, 100, "2026-11-10T08:00:00Z")]));
      await sync(app, token, batch([steps(id, 250, "2026-11-10T09:00:00Z")]));
      expect((await raw(id))?.payload.count).toBe(250);
      expect(await stepValues(id)).toEqual([250]);
      expect((await versions(id)).map((v) => v.applied)).toEqual([true, true]);
    });

    test("an older record does not replace it but joins the history", async () => {
      await sync(app, token, batch([steps(id, 250, "2026-11-10T09:00:00Z")]));
      await sync(app, token, batch([steps(id, 100, "2026-11-10T08:00:00Z")]));
      expect((await raw(id))?.payload.count).toBe(250);
      expect(await stepValues(id)).toEqual([250]);
      const history = await versions(id);
      expect(history.map((v) => [v.payload?.count, v.applied])).toEqual([
        [250, true],
        [100, false],
      ]);
    });

    test("an equally old record with different content replaces it and its projection", async () => {
      const after = { ...(await loadFixtures()).get("ExerciseSessionRecord")!, sourceRecordId: id };
      const before = structuredClone(after);
      before.payload.exerciseRouteResult = { type: "ConsentRequired" };
      await sync(app, token, batch([before]));
      await sync(app, token, batch([after]));

      const row = await raw(id);
      expect(row?.payload.exerciseRouteResult.type).toBe("Data");
      expect((await versions(id)).map((v) => v.applied)).toEqual([true, true]);
      const [workout] = await app.db
        .select()
        .from(healthWorkouts)
        .where(eq(healthWorkouts.rawRecordId, row!.id));
      expect(workout?.routeStatus).toBe("DATA");
      const route = await app.db
        .select()
        .from(healthWorkoutRoutePoints)
        .where(eq(healthWorkoutRoutePoints.workoutId, workout!.id));
      expect(route.length).toBeGreaterThan(0);
    });

    test("an equally old record whose content was received before does not win back", async () => {
      await sync(app, token, batch([steps(id, 100, "2026-11-10T09:00:00Z")]));
      await sync(app, token, batch([steps(id, 300, "2026-11-10T09:00:00Z")]));
      await sync(app, token, batch([steps(id, 100, "2026-11-10T09:00:00Z")]));
      expect((await raw(id))?.payload.count).toBe(300);
      expect(await stepValues(id)).toEqual([300]);
      expect((await versions(id)).map((v) => [v.payload?.count, v.applied])).toEqual([
        [100, true],
        [300, true],
      ]);
    });

    test("an identical record sent again adds no version", async () => {
      await sync(app, token, batch([steps(id, 100, "2026-11-10T08:00:00Z")]));
      await sync(app, token, batch([steps(id, 100, "2026-11-10T08:00:00Z")]));
      expect(await versions(id)).toHaveLength(1);
    });

    test("later records in one batch see earlier ones", async () => {
      await sync(
        app,
        token,
        batch([steps(id, 1, "2026-11-10T08:00:00Z"), steps(id, 2, "2026-11-10T09:00:00Z")]),
      );
      expect((await raw(id))?.payload.count).toBe(2);
    });
  });

  describe("deletions", () => {
    test("are soft: the row and its history stay, its projection goes", async () => {
      await sync(app, token, batch([steps(id, 100, "2026-11-10T08:00:00Z")]));
      const result = await sync(app, token, batch([], [deletion(id, "2026-11-10T10:00:00Z")]));
      expect(result.data.health.sync.acceptedDeletions).toBe(1);

      expect((await raw(id))?.deletedAt).toEqual(new Date("2026-11-10T10:00:00Z"));
      expect((await raw(id))?.payload.count).toBe(100);
      expect(await stepValues(id)).toEqual([]);
      expect((await versions(id)).map((v) => [v.operation, v.applied])).toEqual([
        ["UPSERT", true],
        ["DELETE", true],
      ]);
    });

    test("are not undone by a record older than, or as old as, the deletion", async () => {
      await sync(app, token, batch([steps(id, 100, "2026-11-10T08:00:00Z")]));
      await sync(app, token, batch([], [deletion(id, "2026-11-10T10:00:00Z")]));
      await sync(app, token, batch([steps(id, 150, "2026-11-10T09:00:00Z")]));
      await sync(app, token, batch([steps(id, 175, "2026-11-10T10:00:00Z")]));

      const row = await raw(id);
      expect(row?.deletedAt).not.toBeNull();
      expect(row?.payload.count).toBe(175);
      expect(await stepValues(id)).toEqual([]);
    });

    test("are undone by a record modified after the deletion", async () => {
      await sync(app, token, batch([steps(id, 100, "2026-11-10T08:00:00Z")]));
      await sync(app, token, batch([], [deletion(id, "2026-11-10T10:00:00Z")]));
      await sync(app, token, batch([steps(id, 400, "2026-11-10T11:00:00Z")]));
      expect((await raw(id))?.deletedAt).toBeNull();
      expect(await stepValues(id)).toEqual([400]);
    });

    test("that arrive before their record still apply to it", async () => {
      await sync(app, token, batch([], [deletion(id, "2026-11-10T10:00:00Z")]));
      expect(await raw(id)).toBeUndefined();
      expect(await versions(id)).toMatchObject([{ operation: "DELETE", applied: false }]);

      await sync(app, token, batch([steps(id, 100, "2026-11-10T08:00:00Z")]));
      expect((await raw(id))?.deletedAt).toEqual(new Date("2026-11-10T10:00:00Z"));
      expect(await stepValues(id)).toEqual([]);
    });

    test("older than the stored record are recorded but not applied", async () => {
      await sync(app, token, batch([steps(id, 100, "2026-11-10T08:00:00Z")]));
      await sync(app, token, batch([], [deletion(id, "2026-11-10T07:00:00Z")]));
      expect((await raw(id))?.deletedAt).toBeNull();
      expect((await versions(id)).at(-1)).toMatchObject({ operation: "DELETE", applied: false });
    });

    test("keep the latest deletion time", async () => {
      await sync(app, token, batch([steps(id, 100, "2026-11-10T08:00:00Z")]));
      await sync(app, token, batch([], [deletion(id, "2026-11-10T12:00:00Z")]));
      await sync(app, token, batch([], [deletion(id, "2026-11-10T10:00:00Z")]));
      expect((await raw(id))?.deletedAt).toEqual(new Date("2026-11-10T12:00:00Z"));
    });

    test("only touch the named record type", async () => {
      await sync(app, token, batch([steps(id, 100, "2026-11-10T08:00:00Z")]));
      await sync(app, token, batch([], [deletion(id, "2026-11-10T10:00:00Z", "DistanceRecord")]));
      expect((await raw(id))?.deletedAt).toBeNull();
    });
  });

  describe("limits and validation", () => {
    test("more than 1000 records or deletions is BAD_USER_INPUT", async () => {
      const records = Array.from({ length: 1001 }, (_, i) =>
        steps(`${id}-${i}`, i, "2026-11-10T08:00:00Z"),
      );
      expect((await sync(app, token, batch(records))).code).toBe("BAD_USER_INPUT");
      const deletions = Array.from({ length: 1001 }, (_, i) =>
        deletion(`${id}-${i}`, "2026-11-10T08:00:00Z"),
      );
      expect((await sync(app, token, batch([], deletions))).code).toBe("BAD_USER_INPUT");
    });

    test("exactly 1000 records is accepted", async () => {
      const records = Array.from({ length: 1000 }, (_, i) =>
        steps(`${id}-${i}`, i, "2026-11-10T08:00:00Z"),
      );
      const result = await sync(app, token, batch(records));
      expect(result.errors).toEqual([]);
      const [stored] = await app.db
        .select({ n: count() })
        .from(healthRawRecords)
        .where(and(eq(healthRawRecords.recordType, "StepsRecord")));
      expect(stored?.n).toBeGreaterThanOrEqual(1000);
    }, 60_000);

    test("a body over 4 MB is BAD_USER_INPUT", async () => {
      const record = steps(id, 1, "2026-11-10T08:00:00Z");
      record.payload.padding = "x".repeat(4 * 1024 * 1024);
      const result = await sync(app, token, batch([record]));
      expect(result.status).toBe(413);
      expect(result.code).toBe("BAD_USER_INPUT");
      expect(await raw(id)).toBeUndefined();
    });

    test("an unsupported schemaVersion is BAD_USER_INPUT", async () => {
      const result = await sync(app, token, { ...batch(), schemaVersion: 2 });
      expect(result.code).toBe("BAD_USER_INPUT");
    });

    test("malformed keys and offsets are BAD_USER_INPUT", async () => {
      const cases = [
        steps("", 1, "2026-11-10T08:00:00Z"),
        steps(id, 1, "2026-11-10T08:00:00Z", { recordType: "Steps Record; DROP" }),
        steps(id, 1, "2026-11-10T08:00:00Z", { startZoneOffsetSeconds: 90_000 }),
      ];
      for (const record of cases) {
        expect((await sync(app, token, batch([record]))).code).toBe("BAD_USER_INPUT");
      }
    });
  });
});
