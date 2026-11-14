import { describe, expect, test } from "bun:test";

import { durationBetween, formatDuration, humanize } from "@/lib/format";
import { aggregationsFor, defaultAggregation, isHealthMetric } from "@/lib/metrics";
import { safeRedirect } from "@/lib/redirect";
import { projectRoute } from "@/lib/route";
import { resolveRange } from "@/lib/search";
import { asleepMilliseconds, stageTotals } from "@/lib/sleep";
import { dayRange, isDateInput, lastDays } from "@/lib/time";

describe("time", () => {
  test("dayRange covers whole local days with an exclusive end", () => {
    const { from, to } = dayRange("2026-11-01", "2026-11-03");
    expect(new Date(from).getTime()).toBe(new Date(2026, 10, 1).getTime());
    expect(new Date(to).getTime()).toBe(new Date(2026, 10, 4).getTime());
  });

  test("lastDays includes today", () => {
    expect(lastDays(7, new Date(2026, 10, 14, 15))).toEqual({
      from: "2026-11-08",
      to: "2026-11-14",
    });
  });

  test("resolveRange falls back for missing or inverted bounds", () => {
    expect(resolveRange({ from: "2026-01-01", to: "2026-01-31" })).toEqual({
      from: "2026-01-01",
      to: "2026-01-31",
    });
    expect(resolveRange({ from: "2026-02-01", to: "2026-01-01" })).toEqual(lastDays(28));
    expect(resolveRange({})).toEqual(lastDays(28));
  });

  test("isDateInput accepts only YYYY-MM-DD", () => {
    expect(isDateInput("2026-11-14")).toBe(true);
    expect(isDateInput("14/11/2026")).toBe(false);
  });
});

describe("metrics", () => {
  test("cumulative metrics sum, the rest average", () => {
    expect(defaultAggregation("STEPS")).toBe("SUM");
    expect(aggregationsFor("STEPS")).not.toContain("AVG");
    expect(defaultAggregation("HEART_RATE")).toBe("AVG");
    expect(aggregationsFor("HEART_RATE")).toEqual(["AVG", "MIN", "MAX", "COUNT"]);
  });

  test("isHealthMetric guards route params", () => {
    expect(isHealthMetric("HEART_RATE")).toBe(true);
    expect(isHealthMetric("toString")).toBe(false);
    expect(isHealthMetric("nope")).toBe(false);
  });
});

describe("sleep", () => {
  const stages = [
    { stage: "AWAKE" as const, startTime: "2026-11-10T21:00:00Z", endTime: "2026-11-10T21:30:00Z" },
    { stage: "LIGHT" as const, startTime: "2026-11-10T21:30:00Z", endTime: "2026-11-10T23:30:00Z" },
    { stage: "DEEP" as const, startTime: "2026-11-10T23:30:00Z", endTime: "2026-11-11T00:30:00Z" },
    { stage: "LIGHT" as const, startTime: "2026-11-11T00:30:00Z", endTime: "2026-11-11T01:00:00Z" },
  ];

  test("stageTotals adds up time per stage", () => {
    expect(stageTotals(stages)).toEqual({
      AWAKE: 30 * 60_000,
      LIGHT: 150 * 60_000,
      DEEP: 60 * 60_000,
    });
  });

  test("asleep excludes awake stages and is null without stages", () => {
    expect(asleepMilliseconds(stages)).toBe(210 * 60_000);
    expect(asleepMilliseconds([])).toBeNull();
  });
});

describe("route projection", () => {
  test("fits the route inside the box with north up", () => {
    const points = projectRoute(
      [
        { latitude: -33.92, longitude: 18.42 },
        { latitude: -33.91, longitude: 18.43 },
      ],
      100,
      100,
      0,
    );
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(100);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(100);
    }
    expect(points[1]!.y).toBeLessThan(points[0]!.y);
    expect(points[1]!.x).toBeGreaterThan(points[0]!.x);
  });

  test("a single point lands in the middle", () => {
    expect(projectRoute([{ latitude: 1, longitude: 1 }], 100, 50)).toEqual([{ x: 50, y: 25 }]);
  });
});

describe("format and redirect", () => {
  test("humanize and durations", () => {
    expect(humanize("AWAKE_IN_BED")).toBe("Awake in bed");
    expect(formatDuration(durationBetween("2026-11-10T21:00:00Z", "2026-11-11T04:05:00Z"))).toBe(
      "7h 05m",
    );
    expect(formatDuration(45 * 60_000)).toBe("45m");
  });

  test("safeRedirect keeps only same-origin paths", () => {
    expect(safeRedirect("/health/sleep?from=2026-01-01")).toBe("/health/sleep?from=2026-01-01");
    expect(safeRedirect("//evil.example")).toBe("/");
    expect(safeRedirect("https://evil.example")).toBe("/");
    expect(safeRedirect(undefined)).toBe("/");
  });
});
