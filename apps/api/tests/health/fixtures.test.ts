import { beforeAll, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";

import {
  healthNutritionEntries,
  healthQuantitySamples,
  healthRawRecords,
  healthSleepSessions,
  healthSleepStages,
  healthWorkoutLaps,
  healthWorkoutRoutePoints,
  healthWorkouts,
  healthWorkoutSegments,
} from "../../src/db/schema";
import { useTestApp } from "../_hooks/app";
import { batch, loadFixtures, sync, type RecordInput } from "./helpers";

const app = useTestApp();

/** Every concrete record class in androidx.health.connect:connect-client 1.1.0. */
const RECORD_TYPES = [
  "ActiveCaloriesBurnedRecord",
  "BasalBodyTemperatureRecord",
  "BasalMetabolicRateRecord",
  "BloodGlucoseRecord",
  "BloodPressureRecord",
  "BodyFatRecord",
  "BodyTemperatureRecord",
  "BodyWaterMassRecord",
  "BoneMassRecord",
  "CervicalMucusRecord",
  "CyclingPedalingCadenceRecord",
  "DistanceRecord",
  "ElevationGainedRecord",
  "ExerciseSessionRecord",
  "FloorsClimbedRecord",
  "HeartRateRecord",
  "HeartRateVariabilityRmssdRecord",
  "HeightRecord",
  "HydrationRecord",
  "IntermenstrualBleedingRecord",
  "LeanBodyMassRecord",
  "MenstruationFlowRecord",
  "MenstruationPeriodRecord",
  "MindfulnessSessionRecord",
  "NutritionRecord",
  "OvulationTestRecord",
  "OxygenSaturationRecord",
  "PlannedExerciseSessionRecord",
  "PowerRecord",
  "RespiratoryRateRecord",
  "RestingHeartRateRecord",
  "SexualActivityRecord",
  "SkinTemperatureRecord",
  "SleepSessionRecord",
  "SpeedRecord",
  "StepsCadenceRecord",
  "StepsRecord",
  "TotalCaloriesBurnedRecord",
  "Vo2MaxRecord",
  "WeightRecord",
  "WheelchairPushesRecord",
];

const RAW_ONLY = new Set([
  "CervicalMucusRecord",
  "IntermenstrualBleedingRecord",
  "MenstruationFlowRecord",
  "MenstruationPeriodRecord",
  "MindfulnessSessionRecord",
  "OvulationTestRecord",
  "PlannedExerciseSessionRecord",
  "SexualActivityRecord",
]);

const CANONICAL_UNITS = new Set([
  "meters",
  "kilograms",
  "kilocalories",
  "watts",
  "liters",
  "millimetersOfMercury",
  "celsius",
  "millimolesPerLiter",
  "metersPerSecond",
  "percent",
]);

/** Walks a payload and reports every place it breaks the contract's payload rules. */
function payloadViolations(value: unknown, path: string, out: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => payloadViolations(item, `${path}[${index}]`, out));
    return;
  }
  if (value === null || typeof value !== "object") return;
  const object = value as Record<string, unknown>;

  if ("unit" in object) {
    if (Object.keys(object).sort().join() !== "unit,value") out.push(`${path}: unit object keys`);
    if (!CANONICAL_UNITS.has(String(object.unit))) out.push(`${path}: unit ${String(object.unit)}`);
    if (typeof object.value !== "number") out.push(`${path}: unit value`);
    return;
  }

  for (const [key, item] of Object.entries(object)) {
    if (item === undefined) out.push(`${path}.${key}: undefined`);
    if (key.endsWith("Name") && key !== "name") {
      const base = key.slice(0, -"Name".length);
      if (!Number.isInteger(object[base])) out.push(`${path}.${key}: no integer ${base}`);
      if (item !== null && (typeof item !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(item))) {
        out.push(`${path}.${key}`);
      }
    }
    if ((key.endsWith("Time") || key === "time") && typeof item !== "boolean") {
      if (typeof item !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/.test(item)) {
        if (item !== null) out.push(`${path}.${key}: not an ISO-8601 UTC instant`);
      }
    }
    if (/ZoneOffset$|Duration$/.test(key)) out.push(`${path}.${key}: unconverted Java type`);
    payloadViolations(item, `${path}.${key}`, out);
  }
}

describe("contract fixtures", () => {
  let fixtures: Map<string, RecordInput>;
  let token: string;

  beforeAll(async () => {
    fixtures = await loadFixtures();
    await app.signUp();
    ({ token } = await app.createClient(await app.signIn()));
  });

  test("there is exactly one fixture per connect-client 1.1.0 record class", () => {
    expect([...fixtures.keys()]).toEqual(RECORD_TYPES);
  });

  test("every fixture follows the payload rules and its envelope matches its payload", () => {
    for (const [name, fixture] of fixtures) {
      const { payload } = fixture;
      const violations: string[] = [];
      payloadViolations(payload, name, violations);
      expect(violations).toEqual([]);

      expect(fixture.recordType).toBe(name);
      expect(fixture.origin).toBe("HEALTH_CONNECT");
      expect(Object.keys(payload.metadata).sort()).toEqual([
        "clientRecordId",
        "clientRecordVersion",
        "dataOrigin",
        "device",
        "id",
        "lastModifiedTime",
        "recordingMethod",
        "recordingMethodName",
      ]);
      expect(fixture.sourceRecordId).toBe(payload.metadata.id);
      expect(fixture.dataOrigin).toBe(payload.metadata.dataOrigin);
      expect(fixture.modifiedAt).toBe(payload.metadata.lastModifiedTime);

      if ("time" in payload) {
        expect(fixture.startTime).toBe(payload.time);
        expect(fixture.endTime).toBeNull();
        expect(fixture.startZoneOffsetSeconds).toBe(payload.zoneOffsetSeconds);
        expect(fixture.endZoneOffsetSeconds).toBeNull();
      } else {
        expect(fixture.startTime).toBe(payload.startTime);
        expect(fixture.endTime).toBe(payload.endTime);
        expect(fixture.startZoneOffsetSeconds).toBe(payload.startZoneOffsetSeconds);
        expect(fixture.endZoneOffsetSeconds).toBe(payload.endZoneOffsetSeconds);
      }
    }
  });

  test("every fixture is ingested losslessly and projected without error", async () => {
    const result = await sync(app, token, batch([...fixtures.values()]));
    expect(result.errors).toEqual([]);
    expect(result.data.health.sync.acceptedRecords).toBe(RECORD_TYPES.length);

    const stored = await app.db.select().from(healthRawRecords);
    expect(stored).toHaveLength(RECORD_TYPES.length);
    for (const row of stored) {
      const fixture = fixtures.get(row.recordType)!;
      expect(row.payload).toEqual(fixture.payload);
      expect(row.sourceRecordId).toBe(fixture.sourceRecordId);
      expect(row.projectionError).toBeNull();
      expect(row.projectedAt).not.toBeNull();
    }

    const projected = new Set<string>();
    for (const table of [
      healthQuantitySamples,
      healthSleepSessions,
      healthWorkouts,
      healthNutritionEntries,
    ]) {
      const rows = await app.db
        .select({ recordType: healthRawRecords.recordType })
        .from(table)
        .innerJoin(healthRawRecords, eq(healthRawRecords.id, table.rawRecordId));
      for (const row of rows) projected.add(row.recordType);
    }
    expect([...projected].sort()).toEqual(RECORD_TYPES.filter((type) => !RAW_ONLY.has(type)));
  });

  test("series, sleep, workout and nutrition fixtures project their details", async () => {
    const samples = await app.db.select().from(healthQuantitySamples);
    const of = (metric: string) => samples.filter((s) => s.metric === metric);

    expect(of("HEART_RATE").map((s) => s.value)).toEqual([92, 118, 131]);
    expect(of("HEART_RATE").every((s) => s.endTime === null)).toBe(true);
    expect(of("BLOOD_PRESSURE_SYSTOLIC")[0]?.value).toBe(118);
    expect(of("BLOOD_PRESSURE_DIASTOLIC")[0]?.value).toBe(76);
    expect(of("SKIN_TEMPERATURE_DELTA").map((s) => s.value)).toEqual([-0.2, 0.35]);
    expect(of("SKIN_TEMPERATURE_BASELINE")[0]?.value).toBe(33.9);
    expect(of("BASAL_METABOLIC_RATE")[0]?.value).toBeCloseTo(1662.3, 1);
    expect(of("BASAL_METABOLIC_RATE")[0]?.unit).toBe("kilocaloriesPerDay");
    expect(of("STEPS")[0]).toMatchObject({ value: 5321, unit: "count" });
    expect(of("STEPS")[0]?.endTime).toEqual(new Date("2026-11-10T07:00:00Z"));
    expect(of("STEPS")[0]?.dataOrigin).toBe("com.example.fitness");

    const stages = await app.db.select().from(healthSleepStages);
    expect(stages.map((s): string => s.stage).sort()).toEqual([
      "AWAKE",
      "AWAKE_IN_BED",
      "DEEP",
      "LIGHT",
      "LIGHT",
      "REM",
    ]);

    const [workout] = await app.db.select().from(healthWorkouts);
    expect(workout).toMatchObject({
      activityType: "RUNNING",
      title: "Morning run",
      routeStatus: "DATA",
    });
    expect(await app.db.select().from(healthWorkoutSegments)).toHaveLength(2);
    expect((await app.db.select().from(healthWorkoutLaps))[0]?.lengthMeters).toBe(1000);
    const route = await app.db
      .select()
      .from(healthWorkoutRoutePoints)
      .orderBy(healthWorkoutRoutePoints.time);
    expect(route.map((p) => p.altitudeMeters)).toEqual([12, null]);

    const [meal] = await app.db.select().from(healthNutritionEntries);
    expect(meal).toMatchObject({ mealType: "BREAKFAST", name: "Oats with yoghurt" });
    expect(meal?.energyKilocalories).toBe(356);
    expect(meal?.proteinGrams).toBeCloseTo(18.2);
    expect(meal?.nutrients.vitaminC).toBeCloseTo(0.012);
    expect(meal?.nutrients.energyFromFat).toBe(108.9);
    expect(meal?.nutrients).not.toHaveProperty("protein");
    expect(meal?.nutrients).not.toHaveProperty("biotin");
  });
});
