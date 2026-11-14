import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "@/components/states";
import type { HealthBucket } from "@/gql/graphql";
import { formatNumber } from "@/lib/format";

type Bucket = { bucketStart: string; value: number; count: number };

const TICK_FORMATS: Record<HealthBucket, Intl.DateTimeFormatOptions> = {
  HOUR: { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
  DAY: { day: "numeric", month: "short" },
  WEEK: { day: "numeric", month: "short" },
  MONTH: { month: "short", year: "numeric" },
};

export function SeriesChart({
  buckets,
  bucket,
  unit,
  kind,
  label,
  height = 240,
}: {
  buckets: Bucket[];
  bucket: HealthBucket;
  unit: string;
  kind: "bar" | "line";
  label: string;
  height?: number;
}) {
  if (buckets.length === 0) {
    return <EmptyState title="No samples in this range" />;
  }
  const tick = new Intl.DateTimeFormat(undefined, TICK_FORMATS[bucket]);
  const formatTick = (value: string) => tick.format(new Date(value));
  const common = {
    data: buckets,
    margin: { top: 8, right: 8, bottom: 0, left: 0 },
  };
  const axes = (
    <>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis dataKey="bucketStart" tickFormatter={formatTick} minTickGap={24} fontSize={12} />
      <YAxis
        width={56}
        fontSize={12}
        domain={kind === "line" ? ["auto", "auto"] : [0, "auto"]}
        tickFormatter={(value: number) => formatNumber(value)}
      />
      <Tooltip
        labelFormatter={(value) => (typeof value === "string" ? formatTick(value) : "")}
        formatter={(value) => [`${formatNumber(Number(value))} ${unit}`, label]}
      />
    </>
  );
  return (
    <div style={{ height }} aria-label={`${label} chart`}>
      <ResponsiveContainer width="100%" height="100%">
        {kind === "bar" ? (
          <BarChart {...common}>
            {axes}
            <Bar dataKey="value" fill="var(--chart-2)" isAnimationActive={false} />
          </BarChart>
        ) : (
          <LineChart {...common}>
            {axes}
            <Line
              dataKey="value"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={buckets.length < 40}
              isAnimationActive={false}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
