import type { HealthSleepStage } from "@/gql/graphql";

type Interval = { stage: HealthSleepStage; startTime: string; endTime: string };

/** Top to bottom in a hypnogram. */
export const STAGE_ORDER: readonly HealthSleepStage[] = [
  "AWAKE",
  "AWAKE_IN_BED",
  "OUT_OF_BED",
  "REM",
  "LIGHT",
  "SLEEPING",
  "DEEP",
  "UNKNOWN",
];

const NOT_ASLEEP: ReadonlySet<HealthSleepStage> = new Set<HealthSleepStage>([
  "AWAKE",
  "AWAKE_IN_BED",
  "OUT_OF_BED",
  "UNKNOWN",
]);

const length = (interval: Interval) =>
  Math.max(0, new Date(interval.endTime).getTime() - new Date(interval.startTime).getTime());

/** Milliseconds per stage, only for stages that occur. */
export function stageTotals(
  stages: readonly Interval[],
): Partial<Record<HealthSleepStage, number>> {
  const totals: Partial<Record<HealthSleepStage, number>> = {};
  for (const interval of stages) {
    totals[interval.stage] = (totals[interval.stage] ?? 0) + length(interval);
  }
  return totals;
}

/** Time in sleeping stages; null when the session records no stages. */
export function asleepMilliseconds(stages: readonly Interval[]): number | null {
  if (stages.length === 0) return null;
  return stages.reduce(
    (total, interval) => (NOT_ASLEEP.has(interval.stage) ? total : total + length(interval)),
    0,
  );
}
