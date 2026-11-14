import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { SamplesTable } from "@/components/health/samples-table";
import { SeriesControls } from "@/components/health/series-controls";
import { SourcePriority } from "@/components/health/source-priority";
import { PageHeader, Section } from "@/components/page";
import { PagedState } from "@/components/paged-state";
import { EmptyState } from "@/components/states";
import { useCoverage, useQuantitySamples } from "@/hooks/use-health";
import {
  aggregationsFor,
  defaultAggregation,
  isCumulative,
  isHealthMetric,
  metricLabel,
} from "@/lib/metrics";
import { seriesSearch } from "@/lib/search";
import { dayRange } from "@/lib/time";

import { MetricChartCard } from "../-components/metric-chart-card";
import { applyPatch, seriesValues } from "../-components/series-search";

export const Route = createFileRoute("/_authenticated/health/metrics/$metric")({
  validateSearch: seriesSearch,
  beforeLoad: ({ params }) => {
    if (!isHealthMetric(params.metric)) throw notFound();
  },
  component: MetricDetail,
});

function MetricDetail() {
  const { metric: param } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const coverage = useCoverage();
  if (!isHealthMetric(param)) return null;
  const metric = param;
  const values = seriesValues(search);
  const allowed = aggregationsFor(metric);
  const aggregation =
    search.aggregation && allowed.includes(search.aggregation)
      ? search.aggregation
      : defaultAggregation(metric);
  const rows = coverage.data?.health.metrics.filter((row) => row.metric === metric) ?? [];
  const origins = rows.flatMap((row) => (row.dataOrigin ? [row.dataOrigin] : [])).sort();

  return (
    <>
      <PageHeader
        title={metricLabel(metric)}
        description={
          <Link to="/health" className="underline-offset-4 hover:underline">
            ← Health overview
          </Link>
        }
      />
      <SeriesControls
        value={{ ...values, aggregation }}
        origins={origins}
        aggregations={allowed}
        onChange={(patch) =>
          void navigate({ search: (prev) => applyPatch(prev, patch), replace: true })
        }
      />
      <div className="mb-8">
        <MetricChartCard
          metric={metric}
          {...values}
          aggregation={aggregation}
          height={360}
          linkToDetail={false}
        />
      </div>
      {isCumulative(metric) ? (
        <Section title="Source priority">
          <SourcePriority metric={metric} />
        </Section>
      ) : null}
      <Section title="Samples">
        <Samples metric={metric} {...dayRange(values.from, values.to)} dataOrigin={values.origin} />
      </Section>
    </>
  );
}

function Samples(props: Parameters<typeof useQuantitySamples>[0]) {
  return (
    <PagedState
      pages={useQuantitySamples(props)}
      items={(page) => page.health.quantitySamples.items}
      empty={<EmptyState title="No samples in this range" />}
    >
      {(samples) => <SamplesTable samples={samples} />}
    </PagedState>
  );
}
