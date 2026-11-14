import { createFileRoute } from "@tanstack/react-router";

import { RecordFilters, type RecordFilterValues } from "@/components/health/record-filters";
import { RecordsTable } from "@/components/health/records-table";
import { PageHeader } from "@/components/page";
import { PagedState } from "@/components/paged-state";
import { EmptyState } from "@/components/states";
import { useCoverage, useRawRecords } from "@/hooks/use-health";
import { recordsSearch, resolveRange } from "@/lib/search";
import { dayRange } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/health/records/")({
  validateSearch: recordsSearch,
  component: RecordsPage,
});

function RecordsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const coverage = useCoverage();
  const values: RecordFilterValues = {
    ...resolveRange(search),
    type: search.type ?? null,
    origin: search.origin ?? null,
    deleted: search.deleted ?? false,
  };
  const recordTypes = coverage.data?.health.recordTypes ?? [];
  const pages = useRawRecords({
    ...dayRange(values.from, values.to),
    recordType: values.type,
    dataOrigin: values.origin,
    includeDeleted: values.deleted,
  });

  return (
    <>
      <PageHeader
        title="Records"
        description="Every record exactly as a client pushed it, in start-time order."
      />
      <RecordFilters
        value={values}
        recordTypes={[...new Set(recordTypes.map((row) => row.recordType))]}
        origins={[
          ...new Set(recordTypes.flatMap((row) => (row.dataOrigin ? [row.dataOrigin] : []))),
        ].sort()}
        onChange={(patch) =>
          void navigate({
            replace: true,
            search: (prev) => {
              const next = { ...prev, ...patch };
              return {
                from: next.from,
                to: next.to,
                type: next.type ?? undefined,
                origin: next.origin ?? undefined,
                deleted: next.deleted || undefined,
              };
            },
          })
        }
      />
      <PagedState
        pages={pages}
        items={(page) => page.health.rawRecords.items}
        empty={<EmptyState title="No records match these filters" />}
      >
        {(records) => <RecordsTable records={records} />}
      </PagedState>
    </>
  );
}
