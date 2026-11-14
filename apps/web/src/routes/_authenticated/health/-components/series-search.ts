import type { HealthAggregation, HealthBucket } from "@/gql/graphql";
import { resolveRange } from "@/lib/search";

type SeriesSearch = {
  from?: string;
  to?: string;
  bucket?: HealthBucket;
  origin?: string;
  sources?: "ALL";
  aggregation?: HealthAggregation;
};

type Patch = {
  from?: string;
  to?: string;
  bucket?: HealthBucket;
  origin?: string | null;
  sources?: "ALL" | null;
  aggregation?: HealthAggregation;
};

export function seriesValues(search: SeriesSearch) {
  return {
    ...resolveRange(search),
    bucket: search.bucket ?? "DAY",
    origin: search.origin ?? null,
    sources: search.origin ? null : (search.sources ?? null),
  };
}

export function applyPatch(previous: SeriesSearch, patch: Patch): SeriesSearch {
  const next: SeriesSearch = {
    ...previous,
    ...patch,
    origin: previous.origin,
    sources: previous.sources,
  };
  if ("origin" in patch) next.origin = patch.origin ?? undefined;
  if ("sources" in patch) next.sources = patch.sources ?? undefined;
  return next;
}
