import type { HealthAggregation, HealthMetric } from "@/gql/graphql";

/** Metrics whose samples are amounts over an interval; their buckets add up. */
const CUMULATIVE: ReadonlySet<HealthMetric> = new Set<HealthMetric>([
  "ACTIVE_ENERGY_BURNED",
  "DISTANCE",
  "ELEVATION_GAINED",
  "FLOORS_CLIMBED",
  "HYDRATION",
  "STEPS",
  "TOTAL_ENERGY_BURNED",
  "WHEELCHAIR_PUSHES",
]);

const LABELS: Partial<Record<HealthMetric, string>> = {
  HEART_RATE_VARIABILITY_RMSSD: "Heart rate variability (RMSSD)",
  VO2_MAX: "VO2 max",
};

export function metricLabel(metric: HealthMetric): string {
  const words = metric.toLowerCase().replaceAll("_", " ");
  return LABELS[metric] ?? words.charAt(0).toUpperCase() + words.slice(1);
}

export function isCumulative(metric: HealthMetric): boolean {
  return CUMULATIVE.has(metric);
}

export function aggregationsFor(metric: HealthMetric): HealthAggregation[] {
  return isCumulative(metric) ? ["SUM", "COUNT"] : ["AVG", "MIN", "MAX", "COUNT"];
}

export function defaultAggregation(metric: HealthMetric): HealthAggregation {
  return isCumulative(metric) ? "SUM" : "AVG";
}

export const AGGREGATION_LABELS: Record<HealthAggregation, string> = {
  SUM: "Sum",
  AVG: "Average",
  MIN: "Minimum",
  MAX: "Maximum",
  COUNT: "Sample count",
};

export const BUCKETS = ["HOUR", "DAY", "WEEK", "MONTH"] as const;

const METRIC_SET: Record<HealthMetric, true> = {
  ACTIVE_ENERGY_BURNED: true,
  BASAL_BODY_TEMPERATURE: true,
  BASAL_METABOLIC_RATE: true,
  BLOOD_GLUCOSE: true,
  BLOOD_PRESSURE_DIASTOLIC: true,
  BLOOD_PRESSURE_SYSTOLIC: true,
  BODY_FAT: true,
  BODY_TEMPERATURE: true,
  BODY_WATER_MASS: true,
  BONE_MASS: true,
  CYCLING_PEDALING_CADENCE: true,
  DISTANCE: true,
  ELEVATION_GAINED: true,
  FLOORS_CLIMBED: true,
  HEART_RATE: true,
  HEART_RATE_VARIABILITY_RMSSD: true,
  HEIGHT: true,
  HYDRATION: true,
  LEAN_BODY_MASS: true,
  OXYGEN_SATURATION: true,
  POWER: true,
  RESPIRATORY_RATE: true,
  RESTING_HEART_RATE: true,
  SKIN_TEMPERATURE_BASELINE: true,
  SKIN_TEMPERATURE_DELTA: true,
  SPEED: true,
  STEPS: true,
  STEPS_CADENCE: true,
  TOTAL_ENERGY_BURNED: true,
  VO2_MAX: true,
  WEIGHT: true,
  WHEELCHAIR_PUSHES: true,
};

export function isHealthMetric(value: string): value is HealthMetric {
  return Object.hasOwn(METRIC_SET, value);
}
