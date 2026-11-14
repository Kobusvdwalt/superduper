import { createFileRoute } from "@tanstack/react-router";

import { MetricCoverageTable, RecordTypeCoverageTable } from "@/components/health/coverage-tables";
import { SeriesControls } from "@/components/health/series-controls";
import { PageHeader, Section } from "@/components/page";
import { EmptyState, QueryState } from "@/components/states";
import { useCoverage } from "@/hooks/use-health";
import { seriesSearch } from "@/lib/search";

import { MetricChartCard } from "./-components/metric-chart-card";
import { applyPatch, seriesValues } from "./-components/series-search";

export const Route = createFileRoute("/_authenticated/health/")({
  validateSearch: seriesSearch,
  component: HealthOverview,
});

function HealthOverview() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const values = seriesValues(search);
  const coverage = useCoverage();

  return (
    <>
      <PageHeader title="Health" description="What has been recorded, and how it trends." />
      <QueryState
        query={coverage}
        isEmpty={(data) => data.health.recordTypes.length === 0}
        empty={
          <EmptyState title="No health data yet">
            Pair a device under Settings → This device, or create a client and push a sync.
          </EmptyState>
        }
      >
        {(data) => {
          const origins = [
            ...new Set(
              data.health.metrics.flatMap((row) => (row.dataOrigin ? [row.dataOrigin] : [])),
            ),
          ].sort();
          const metrics = [
            ...new Set(
              data.health.metrics
                .filter((row) => !values.origin || row.dataOrigin === values.origin)
                .map((row) => row.metric),
            ),
          ];
          return (
            <>
              <Section title="Trends">
                <SeriesControls
                  value={values}
                  origins={origins}
                  onChange={(patch) =>
                    void navigate({ search: (prev) => applyPatch(prev, patch), replace: true })
                  }
                />
                {metrics.length === 0 ? (
                  <EmptyState title="No metrics from this data origin" />
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {metrics.map((metric) => (
                      <MetricChartCard key={metric} metric={metric} {...values} />
                    ))}
                  </div>
                )}
              </Section>
              <Section title="Metric coverage">
                <MetricCoverageTable rows={data.health.metrics} />
              </Section>
              <Section title="Record types">
                <RecordTypeCoverageTable rows={data.health.recordTypes} />
              </Section>
            </>
          );
        }}
      </QueryState>
    </>
  );
}
