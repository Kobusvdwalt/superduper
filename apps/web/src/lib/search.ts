import { z } from "zod";

import { BUCKETS } from "@/lib/metrics";
import { isDateInput, lastDays } from "@/lib/time";

const day = z.string().refine(isDateInput).optional().catch(undefined);
const text = z.string().min(1).optional().catch(undefined);

export const rangeSearch = z.object({ from: day, to: day });

export const seriesSearch = rangeSearch.extend({
  bucket: z.enum(BUCKETS).optional().catch(undefined),
  origin: text,
  aggregation: z.enum(["SUM", "AVG", "MIN", "MAX", "COUNT"]).optional().catch(undefined),
});

export const recordsSearch = rangeSearch.extend({
  type: text,
  origin: text,
  deleted: z.boolean().optional().catch(undefined),
});

const DEFAULT_DAYS = 28;

/** Missing or inverted bounds fall back to the last 28 days. */
export function resolveRange(search: { from?: string; to?: string }): { from: string; to: string } {
  const fallback = lastDays(DEFAULT_DAYS);
  const from = search.from ?? fallback.from;
  const to = search.to ?? fallback.to;
  return from <= to ? { from, to } : fallback;
}
