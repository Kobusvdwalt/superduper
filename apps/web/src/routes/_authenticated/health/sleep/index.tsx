import { createFileRoute } from "@tanstack/react-router";

import { DateRangeControls } from "@/components/health/series-controls";
import { SleepStagesChart, SleepTable } from "@/components/health/sleep-components";
import { PageHeader, Section } from "@/components/page";
import { PagedState } from "@/components/paged-state";
import { EmptyState } from "@/components/states";
import { useSleepSessions } from "@/hooks/use-health";
import { rangeSearch, resolveRange } from "@/lib/search";
import { dayRange } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/health/sleep/")({
  validateSearch: rangeSearch,
  component: SleepPage,
});

function SleepPage() {
  const range = resolveRange(Route.useSearch());
  const navigate = Route.useNavigate();
  const pages = useSleepSessions(dayRange(range.from, range.to));
  return (
    <>
      <PageHeader title="Sleep" description="Sessions that started in the selected days." />
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <DateRangeControls
          {...range}
          onChange={(next) => void navigate({ search: next, replace: true })}
        />
      </div>
      <PagedState
        pages={pages}
        items={(page) => page.health.sleepSessions.items}
        empty={<EmptyState title="No sleep sessions in this range" />}
      >
        {(sessions) => (
          <>
            <Section title="Stages per night">
              <SleepStagesChart sessions={sessions} />
            </Section>
            <Section title="Sessions">
              <SleepTable sessions={sessions} />
            </Section>
          </>
        )}
      </PagedState>
    </>
  );
}
