import { createFileRoute } from "@tanstack/react-router";

import { DateRangeControls } from "@/components/health/series-controls";
import { WorkoutsTable } from "@/components/health/workout-components";
import { PageHeader } from "@/components/page";
import { PagedState } from "@/components/paged-state";
import { EmptyState } from "@/components/states";
import { useWorkouts } from "@/hooks/use-health";
import { rangeSearch, resolveRange } from "@/lib/search";
import { dayRange } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/health/workouts/")({
  validateSearch: rangeSearch,
  component: WorkoutsPage,
});

function WorkoutsPage() {
  const range = resolveRange(Route.useSearch());
  const navigate = Route.useNavigate();
  const pages = useWorkouts(dayRange(range.from, range.to));
  return (
    <>
      <PageHeader
        title="Workouts"
        description="Exercise sessions that started in the selected days."
      />
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <DateRangeControls
          {...range}
          onChange={(next) => void navigate({ search: next, replace: true })}
        />
      </div>
      <PagedState
        pages={pages}
        items={(page) => page.health.workouts.items}
        empty={<EmptyState title="No workouts in this range" />}
      >
        {(workouts) => <WorkoutsTable workouts={workouts} />}
      </PagedState>
    </>
  );
}
