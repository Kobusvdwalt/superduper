import { beforeAll, describe, expect, test } from "bun:test";

import { useTestApp } from "../_hooks/app";
import { batch, loadFixtures, steps, sync } from "./helpers";

const app = useTestApp();

describe("health lookups by id", () => {
  let cookie: string;
  let token: string;

  beforeAll(async () => {
    await app.signUp();
    cookie = await app.signIn();
    ({ token } = await app.createClient(cookie));
    const fixtures = await loadFixtures();
    await sync(app, token, batch([...fixtures.values()]));
    await sync(app, token, batch([steps("s-1", 10, "2026-11-10T08:00:00Z")]));
    await sync(app, token, batch([steps("s-1", 20, "2026-11-10T09:00:00Z")]));
    await sync(app, token, batch([steps("s-1", 5, "2026-11-10T07:00:00Z")]));
  });

  async function firstId(field: string, args = "") {
    const result = await app.execute(`{ health { ${field}${args} { items { id } } } }`, { cookie });
    return result.data.health[field].items[0].id as string;
  }

  test("rawRecord returns the current record with every version oldest first", async () => {
    const result = await app.execute(
      `{ health { rawRecords(recordType: "StepsRecord", dataOrigin: "com.example.fitness") { items { id sourceRecordId } } } }`,
      { cookie },
    );
    const item = result.data.health.rawRecords.items.find(
      (row: { sourceRecordId: string }) => row.sourceRecordId === "s-1",
    );

    const detail = await app.execute(
      `query($id: UUID!) { health { rawRecord(id: $id) {
        payload versions { operation applied modifiedAt payload }
      } } }`,
      { cookie, variables: { id: item.id } },
    );
    expect(detail.errors).toEqual([]);
    const record = detail.data.health.rawRecord;
    expect(record.payload.count).toBe(20);
    expect(
      record.versions.map((v: { applied: boolean; payload: { count: number } }) => [
        v.applied,
        v.payload.count,
      ]),
    ).toEqual([
      [true, 10],
      [true, 20],
      [false, 5],
    ]);
  });

  test("sleepSession and workout return one row with its detail", async () => {
    const sleepId = await firstId("sleepSessions");
    const workoutId = await firstId("workouts");
    const result = await app.execute(
      `query($sleep: UUID!, $workout: UUID!) { health {
        sleepSession(id: $sleep) { id stages { stage } }
        workout(id: $workout) { id activityType route { latitude } }
      } }`,
      { cookie, variables: { sleep: sleepId, workout: workoutId } },
    );
    expect(result.errors).toEqual([]);
    expect(result.data.health.sleepSession.id).toBe(sleepId);
    expect(result.data.health.sleepSession.stages.length).toBeGreaterThan(0);
    expect(result.data.health.workout).toMatchObject({ id: workoutId, activityType: "RUNNING" });
  });

  test("an unknown id is null, and lookups require a viewer", async () => {
    const query = `{ health {
      rawRecord(id: "00000000-0000-7000-8000-000000000000") { id }
      sleepSession(id: "00000000-0000-7000-8000-000000000000") { id }
      workout(id: "00000000-0000-7000-8000-000000000000") { id }
    } }`;
    const result = await app.execute(query, { cookie });
    expect(result.data.health).toEqual({ rawRecord: null, sleepSession: null, workout: null });
    expect((await app.execute(query)).code).toBe("UNAUTHENTICATED");
  });
});
