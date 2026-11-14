import { HEALTH_SLEEP_STAGES, type HealthMetric } from "../../db/schema";
import {
  constantName,
  list,
  number,
  object,
  optionalNumber,
  optionalString,
  optionalUnit,
  ProjectionError,
  time,
  unit,
} from "./read";

export const HEALTH_METRIC_UNITS: Record<HealthMetric, string> = {
  STEPS: "count",
  DISTANCE: "meters",
  FLOORS_CLIMBED: "floors",
  ELEVATION_GAINED: "meters",
  WHEELCHAIR_PUSHES: "count",
  ACTIVE_ENERGY_BURNED: "kilocalories",
  TOTAL_ENERGY_BURNED: "kilocalories",
  BASAL_METABOLIC_RATE: "kilocaloriesPerDay",
  HEART_RATE: "beatsPerMinute",
  RESTING_HEART_RATE: "beatsPerMinute",
  HEART_RATE_VARIABILITY_RMSSD: "milliseconds",
  OXYGEN_SATURATION: "percent",
  RESPIRATORY_RATE: "breathsPerMinute",
  VO2_MAX: "millilitersPerMinuteKilogram",
  WEIGHT: "kilograms",
  HEIGHT: "meters",
  BODY_FAT: "percent",
  LEAN_BODY_MASS: "kilograms",
  BONE_MASS: "kilograms",
  BODY_WATER_MASS: "kilograms",
  BODY_TEMPERATURE: "celsius",
  BASAL_BODY_TEMPERATURE: "celsius",
  SKIN_TEMPERATURE_BASELINE: "celsius",
  SKIN_TEMPERATURE_DELTA: "celsius",
  BLOOD_GLUCOSE: "millimolesPerLiter",
  BLOOD_PRESSURE_SYSTOLIC: "millimetersOfMercury",
  BLOOD_PRESSURE_DIASTOLIC: "millimetersOfMercury",
  HYDRATION: "liters",
  SPEED: "metersPerSecond",
  POWER: "watts",
  CYCLING_PEDALING_CADENCE: "revolutionsPerMinute",
  STEPS_CADENCE: "stepsPerMinute",
};

const KILOCALORIES_PER_DAY_PER_WATT = 86_400 / 4_184;
const GRAMS_PER_KILOGRAM = 1_000;

export type ProjectionSource = {
  recordType: string;
  payload: Record<string, unknown>;
  startTime: Date;
  endTime: Date | null;
  startZoneOffsetSeconds: number | null;
  endZoneOffsetSeconds: number | null;
};

type QuantityRow = {
  metric: HealthMetric;
  startTime: Date;
  endTime: Date | null;
  value: number;
};

type Span = {
  startTime: Date;
  endTime: Date;
  startZoneOffsetSeconds: number | null;
  endZoneOffsetSeconds: number | null;
};

type SleepProjection = Span & {
  title: string | null;
  notes: string | null;
  stages: { stage: (typeof HEALTH_SLEEP_STAGES)[number]; startTime: Date; endTime: Date }[];
};

type WorkoutProjection = Span & {
  activityType: string;
  title: string | null;
  notes: string | null;
  routeStatus: "DATA" | "NO_DATA" | "CONSENT_REQUIRED" | null;
  segments: { segmentType: string; repetitions: number | null; startTime: Date; endTime: Date }[];
  laps: { startTime: Date; endTime: Date; lengthMeters: number | null }[];
  route: {
    time: Date;
    latitude: number;
    longitude: number;
    altitudeMeters: number | null;
    horizontalAccuracyMeters: number | null;
    verticalAccuracyMeters: number | null;
  }[];
};

type NutritionProjection = Span & {
  mealType: string | null;
  name: string | null;
  energyKilocalories: number | null;
  proteinGrams: number | null;
  totalCarbohydrateGrams: number | null;
  totalFatGrams: number | null;
  dietaryFiberGrams: number | null;
  sugarGrams: number | null;
  nutrients: Record<string, number>;
};

export type Projection = {
  quantities: QuantityRow[];
  sleep?: SleepProjection;
  workout?: WorkoutProjection;
  nutrition?: NutritionProjection;
};

type Projector = (source: ProjectionSource) => Projection;

function span(source: ProjectionSource): Span {
  if (!source.endTime) throw new ProjectionError("endTime: expected an interval record");
  return {
    startTime: source.startTime,
    endTime: source.endTime,
    startZoneOffsetSeconds: source.startZoneOffsetSeconds,
    endZoneOffsetSeconds: source.endZoneOffsetSeconds,
  };
}

/** An interval record carrying one total, e.g. `StepsRecord.count`. */
function total(
  metric: HealthMetric,
  read: (payload: Record<string, unknown>) => number,
): Projector {
  return (source) => ({
    quantities: [
      {
        metric,
        startTime: source.startTime,
        endTime: span(source).endTime,
        value: read(source.payload),
      },
    ],
  });
}

/** An instantaneous record carrying one value, e.g. `WeightRecord.weight`. */
function instant(
  metric: HealthMetric,
  read: (payload: Record<string, unknown>) => number,
): Projector {
  return (source) => ({
    quantities: [
      { metric, startTime: source.startTime, endTime: null, value: read(source.payload) },
    ],
  });
}

/** A series record, flattened to one row per sample. */
function series(
  metric: HealthMetric,
  key: string,
  read: (sample: Record<string, unknown>) => number,
): Projector {
  return (source) => ({
    quantities: list(source.payload, key).map((sample) => ({
      metric,
      startTime: time(sample, "time"),
      endTime: null,
      value: read(sample),
    })),
  });
}

function sleep(source: ProjectionSource): Projection {
  const { payload } = source;
  const known = new Set<string>(HEALTH_SLEEP_STAGES);
  return {
    quantities: [],
    sleep: {
      ...span(source),
      title: optionalString(payload, "title"),
      notes: optionalString(payload, "notes"),
      stages: list(payload, "stages").map((stage) => {
        number(stage, "stage");
        const name = constantName(stage, "stage");
        return {
          stage:
            name && known.has(name)
              ? (name as SleepProjection["stages"][number]["stage"])
              : "UNKNOWN",
          startTime: time(stage, "startTime"),
          endTime: time(stage, "endTime"),
        };
      }),
    },
  };
}

const ROUTE_STATUS = {
  Data: "DATA",
  NoData: "NO_DATA",
  ConsentRequired: "CONSENT_REQUIRED",
} as const;

function workout(source: ProjectionSource): Projection {
  const { payload } = source;
  const routeResult =
    payload.exerciseRouteResult === null || payload.exerciseRouteResult === undefined
      ? null
      : object(payload.exerciseRouteResult, "exerciseRouteResult");
  const routeType = routeResult ? optionalString(routeResult, "type") : null;
  const routeStatus =
    routeType && routeType in ROUTE_STATUS
      ? ROUTE_STATUS[routeType as keyof typeof ROUTE_STATUS]
      : null;
  const route =
    routeResult && routeStatus === "DATA"
      ? list(object(routeResult.exerciseRoute, "exerciseRouteResult.exerciseRoute"), "route")
      : [];

  number(payload, "exerciseType");
  return {
    quantities: [],
    workout: {
      ...span(source),
      activityType: constantName(payload, "exerciseType") ?? "UNKNOWN",
      title: optionalString(payload, "title"),
      notes: optionalString(payload, "notes"),
      routeStatus,
      segments: list(payload, "segments").map((segment) => {
        number(segment, "segmentType");
        return {
          segmentType: constantName(segment, "segmentType") ?? "UNKNOWN",
          repetitions: optionalNumber(segment, "repetitions"),
          startTime: time(segment, "startTime"),
          endTime: time(segment, "endTime"),
        };
      }),
      laps: list(payload, "laps").map((lap) => ({
        startTime: time(lap, "startTime"),
        endTime: time(lap, "endTime"),
        lengthMeters: optionalUnit(lap, "length", "meters"),
      })),
      route: route.map((point) => ({
        time: time(point, "time"),
        latitude: number(point, "latitude"),
        longitude: number(point, "longitude"),
        altitudeMeters: optionalUnit(point, "altitude", "meters"),
        horizontalAccuracyMeters: optionalUnit(point, "horizontalAccuracy", "meters"),
        verticalAccuracyMeters: optionalUnit(point, "verticalAccuracy", "meters"),
      })),
    },
  };
}

const NUTRITION_MASSES = [
  "biotin",
  "caffeine",
  "calcium",
  "chloride",
  "cholesterol",
  "chromium",
  "copper",
  "dietaryFiber",
  "folate",
  "folicAcid",
  "iodine",
  "iron",
  "magnesium",
  "manganese",
  "molybdenum",
  "monounsaturatedFat",
  "niacin",
  "pantothenicAcid",
  "phosphorus",
  "polyunsaturatedFat",
  "potassium",
  "protein",
  "riboflavin",
  "saturatedFat",
  "selenium",
  "sodium",
  "sugar",
  "thiamin",
  "totalCarbohydrate",
  "totalFat",
  "transFat",
  "unsaturatedFat",
  "vitaminA",
  "vitaminB12",
  "vitaminB6",
  "vitaminC",
  "vitaminD",
  "vitaminE",
  "vitaminK",
  "zinc",
] as const;

const MACROS = new Set<string>([
  "protein",
  "totalCarbohydrate",
  "totalFat",
  "dietaryFiber",
  "sugar",
]);

function nutrition(source: ProjectionSource): Projection {
  const { payload } = source;
  const grams = (key: string) => {
    const kilograms = optionalUnit(payload, key, "kilograms");
    return kilograms === null ? null : kilograms * GRAMS_PER_KILOGRAM;
  };

  const nutrients: Record<string, number> = {};
  for (const key of NUTRITION_MASSES) {
    const value = grams(key);
    if (value !== null && !MACROS.has(key)) nutrients[key] = value;
  }
  const energyFromFat = optionalUnit(payload, "energyFromFat", "kilocalories");
  if (energyFromFat !== null) nutrients.energyFromFat = energyFromFat;

  return {
    quantities: [],
    nutrition: {
      ...span(source),
      mealType: constantName(payload, "mealType"),
      name: optionalString(payload, "name"),
      energyKilocalories: optionalUnit(payload, "energy", "kilocalories"),
      proteinGrams: grams("protein"),
      totalCarbohydrateGrams: grams("totalCarbohydrate"),
      totalFatGrams: grams("totalFat"),
      dietaryFiberGrams: grams("dietaryFiber"),
      sugarGrams: grams("sugar"),
      nutrients,
    },
  };
}

function skinTemperature(source: ProjectionSource): Projection {
  const { payload } = source;
  const baseline = optionalUnit(payload, "baseline", "celsius");
  return {
    quantities: [
      ...(baseline === null
        ? []
        : [
            {
              metric: "SKIN_TEMPERATURE_BASELINE" as const,
              startTime: source.startTime,
              endTime: span(source).endTime,
              value: baseline,
            },
          ]),
      ...series("SKIN_TEMPERATURE_DELTA", "deltas", (delta) => unit(delta, "delta", "celsius"))(
        source,
      ).quantities,
    ],
  };
}

function bloodPressure(source: ProjectionSource): Projection {
  const { payload, startTime } = source;
  return {
    quantities: [
      {
        metric: "BLOOD_PRESSURE_SYSTOLIC",
        startTime,
        endTime: null,
        value: unit(payload, "systolic", "millimetersOfMercury"),
      },
      {
        metric: "BLOOD_PRESSURE_DIASTOLIC",
        startTime,
        endTime: null,
        value: unit(payload, "diastolic", "millimetersOfMercury"),
      },
    ],
  };
}

/** Health Connect record types with a typed projection; every other type is stored raw only. */
const PROJECTORS: Record<string, Projector> = {
  StepsRecord: total("STEPS", (p) => number(p, "count")),
  DistanceRecord: total("DISTANCE", (p) => unit(p, "distance", "meters")),
  FloorsClimbedRecord: total("FLOORS_CLIMBED", (p) => number(p, "floors")),
  ElevationGainedRecord: total("ELEVATION_GAINED", (p) => unit(p, "elevation", "meters")),
  WheelchairPushesRecord: total("WHEELCHAIR_PUSHES", (p) => number(p, "count")),
  ActiveCaloriesBurnedRecord: total("ACTIVE_ENERGY_BURNED", (p) =>
    unit(p, "energy", "kilocalories"),
  ),
  TotalCaloriesBurnedRecord: total("TOTAL_ENERGY_BURNED", (p) => unit(p, "energy", "kilocalories")),
  HydrationRecord: total("HYDRATION", (p) => unit(p, "volume", "liters")),
  BasalMetabolicRateRecord: instant(
    "BASAL_METABOLIC_RATE",
    (p) => unit(p, "basalMetabolicRate", "watts") * KILOCALORIES_PER_DAY_PER_WATT,
  ),
  RestingHeartRateRecord: instant("RESTING_HEART_RATE", (p) => number(p, "beatsPerMinute")),
  HeartRateVariabilityRmssdRecord: instant("HEART_RATE_VARIABILITY_RMSSD", (p) =>
    number(p, "heartRateVariabilityMillis"),
  ),
  OxygenSaturationRecord: instant("OXYGEN_SATURATION", (p) => unit(p, "percentage", "percent")),
  RespiratoryRateRecord: instant("RESPIRATORY_RATE", (p) => number(p, "rate")),
  Vo2MaxRecord: instant("VO2_MAX", (p) => number(p, "vo2MillilitersPerMinuteKilogram")),
  WeightRecord: instant("WEIGHT", (p) => unit(p, "weight", "kilograms")),
  HeightRecord: instant("HEIGHT", (p) => unit(p, "height", "meters")),
  BodyFatRecord: instant("BODY_FAT", (p) => unit(p, "percentage", "percent")),
  LeanBodyMassRecord: instant("LEAN_BODY_MASS", (p) => unit(p, "mass", "kilograms")),
  BoneMassRecord: instant("BONE_MASS", (p) => unit(p, "mass", "kilograms")),
  BodyWaterMassRecord: instant("BODY_WATER_MASS", (p) => unit(p, "mass", "kilograms")),
  BodyTemperatureRecord: instant("BODY_TEMPERATURE", (p) => unit(p, "temperature", "celsius")),
  BasalBodyTemperatureRecord: instant("BASAL_BODY_TEMPERATURE", (p) =>
    unit(p, "temperature", "celsius"),
  ),
  BloodGlucoseRecord: instant("BLOOD_GLUCOSE", (p) => unit(p, "level", "millimolesPerLiter")),
  BloodPressureRecord: bloodPressure,
  SkinTemperatureRecord: skinTemperature,
  HeartRateRecord: series("HEART_RATE", "samples", (s) => number(s, "beatsPerMinute")),
  SpeedRecord: series("SPEED", "samples", (s) => unit(s, "speed", "metersPerSecond")),
  PowerRecord: series("POWER", "samples", (s) => unit(s, "power", "watts")),
  CyclingPedalingCadenceRecord: series("CYCLING_PEDALING_CADENCE", "samples", (s) =>
    number(s, "revolutionsPerMinute"),
  ),
  StepsCadenceRecord: series("STEPS_CADENCE", "samples", (s) => number(s, "rate")),
  SleepSessionRecord: sleep,
  ExerciseSessionRecord: workout,
  NutritionRecord: nutrition,
};

/** Null for a record type stored raw only. Throws `ProjectionError` for a malformed payload. */
export function project(origin: string, source: ProjectionSource): Projection | null {
  const projector = origin === "HEALTH_CONNECT" ? PROJECTORS[source.recordType] : undefined;
  return projector ? projector(source) : null;
}
