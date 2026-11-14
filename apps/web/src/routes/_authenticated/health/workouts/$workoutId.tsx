import { createFileRoute, Link } from "@tanstack/react-router";

import {
  LapsTable,
  RouteMap,
  RouteStatusBadge,
  SegmentsTable,
} from "@/components/health/workout-components";
import { Facts, PageHeader, Section } from "@/components/page";
import { EmptyState, QueryState } from "@/components/states";
import { useWorkout } from "@/hooks/use-health";
import { durationBetween, formatDateTime, formatDuration, humanize } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/health/workouts/$workoutId")({
  component: WorkoutPage,
});

const ROUTE_MESSAGES = {
  NO_DATA: "The origin recorded no route for this workout.",
  CONSENT_REQUIRED: "A route exists, but reading it needs consent on the device.",
} as const;

function WorkoutPage() {
  const { workoutId } = Route.useParams();
  const query = useWorkout(workoutId);
  const workout = query.data?.health.workout;
  return (
    <>
      <PageHeader
        title={workout ? (workout.title ?? humanize(workout.activityType)) : "Workout"}
        description={
          <Link to="/health/workouts" className="underline-offset-4 hover:underline">
            ← Workouts
          </Link>
        }
      />
      <QueryState
        query={query}
        isEmpty={(data) => !data.health.workout}
        empty={<EmptyState title="This workout does not exist" />}
      >
        {(data) => {
          const detail = data.health.workout;
          if (!detail) return null;
          return (
            <>
              <Section title="Summary">
                <Facts
                  items={[
                    ["Activity", humanize(detail.activityType)],
                    ["Start", formatDateTime(detail.startTime)],
                    ["End", formatDateTime(detail.endTime)],
                    ["Duration", formatDuration(durationBetween(detail.startTime, detail.endTime))],
                    ["Route", <RouteStatusBadge key="route" status={detail.routeStatus} />],
                    ["Data origin", detail.dataOrigin ?? "—"],
                    ["Notes", detail.notes ?? "—"],
                    [
                      "Raw record",
                      <Link
                        key="raw"
                        to="/health/records/$recordId"
                        params={{ recordId: detail.rawRecordId }}
                        className="underline"
                      >
                        view payload
                      </Link>,
                    ],
                  ]}
                />
              </Section>
              <Section title="Route">
                {detail.route.length > 0 ? (
                  <RouteMap route={detail.route} />
                ) : (
                  <EmptyState title="No route points">
                    {detail.routeStatus && detail.routeStatus !== "DATA"
                      ? ROUTE_MESSAGES[detail.routeStatus]
                      : null}
                  </EmptyState>
                )}
              </Section>
              <Section title="Segments">
                <SegmentsTable segments={detail.segments} />
              </Section>
              <Section title="Laps">
                <LapsTable laps={detail.laps} />
              </Section>
            </>
          );
        }}
      </QueryState>
    </>
  );
}
