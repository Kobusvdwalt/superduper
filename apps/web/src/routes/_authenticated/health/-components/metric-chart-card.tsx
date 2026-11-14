import { Link } from "@tanstack/react-router";

import { SeriesChart } from "@/components/health/series-chart";
import { QueryState } from "@/components/states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  HealthAggregation,
  HealthBucket,
  HealthMetric,
  QuantitySeriesQuery,
} from "@/gql/graphql";
import { useQuantitySeries } from "@/hooks/use-health";
import { AGGREGATION_LABELS, defaultAggregation, isCumulative, metricLabel } from "@/lib/metrics";
import { browserTimeZone, dayRange } from "@/lib/time";

export function MetricChartCard({
  metric,
  from,
  to,
  bucket,
  origin,
  sources,
  aggregation = defaultAggregation(metric),
  height,
  linkToDetail = true,
}: {
  metric: HealthMetric;
  from: string;
  to: string;
  bucket: HealthBucket;
  origin: string | null;
  sources: "ALL" | null;
  aggregation?: HealthAggregation;
  height?: number;
  linkToDetail?: boolean;
}) {
  const series = useQuantitySeries({
    metric,
    ...dayRange(from, to),
    bucket,
    aggregation,
    dataOrigin: origin,
    sourceMode: sources,
    timeZone: browserTimeZone(),
  });
  const label = metricLabel(metric);
  const unit = series.data?.health.quantitySeries.unit ?? "";
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {linkToDetail ? (
            <Link
              to="/health/metrics/$metric"
              params={{ metric }}
              search={{
                from,
                to,
                bucket,
                origin: origin ?? undefined,
                sources: sources ?? undefined,
              }}
              className="underline-offset-4 hover:underline"
            >
              {label}
            </Link>
          ) : (
            label
          )}
        </CardTitle>
        <CardDescription>
          {AGGREGATION_LABELS[aggregation]} per {bucket.toLowerCase()}
          {unit && aggregation !== "COUNT" ? ` · ${unit}` : ""}
          {series.data ? <SourceLine series={series.data.health.quantitySeries} /> : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryState query={series}>
          {(data) => (
            <SeriesChart
              buckets={data.health.quantitySeries.buckets}
              bucket={bucket}
              unit={aggregation === "COUNT" ? "samples" : data.health.quantitySeries.unit}
              kind={isCumulative(metric) || aggregation === "COUNT" ? "bar" : "line"}
              label={label}
              height={height}
            />
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function SourceLine({ series }: { series: QuantitySeriesQuery["health"]["quantitySeries"] }) {
  const names = series.sources
    .map((source) => `${source.dataOrigin ?? "unknown"} (${source.days} d)`)
    .join(", ");
  if (!names) return null;
  if (!series.cumulative) return <span className="block">Sources: {names}</span>;
  return series.sourceMode === "PREFERRED" ? (
    <span className="block">Preferred source per day: {names}</span>
  ) : (
    <span className="block">All sources added up, may double count: {names}</span>
  );
}
