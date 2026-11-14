import type { HealthAggregation, HealthBucket } from "@/gql/graphql";
import { resolveRange } from "@/lib/search";

type SeriesSearch = {
  from?: string;
  to?: string;
  bucket?: HealthBucket;
  origin?: string;
  aggregation?: HealthAggregation;
};

type Patch = {
  from?: string;
  to?: string;
  bucket?: HealthBucket;
  origin?: string | null;
  aggregation?: HealthAggregation;
};

export function seriesValues(search: SeriesSearch) {
  return {
    ...resolveRange(search),
    bucket: search.bucket ?? "DAY",
    origin: search.origin ?? null,
  };
}

export function applyPatch(previous: SeriesSearch, patch: Patch): SeriesSearch {
  const next: SeriesSearch = { ...previous, ...patch, origin: previous.origin };
  if ("origin" in patch) next.origin = patch.origin ?? undefined;
  return next;
}
