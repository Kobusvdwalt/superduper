import { createFileRoute, Link } from "@tanstack/react-router";

import { SleepTimeline, StageTotalsTable } from "@/components/health/sleep-components";
import { Facts, PageHeader, Section } from "@/components/page";
import { EmptyState, QueryState } from "@/components/states";
import { useSleepSession } from "@/hooks/use-health";
import { durationBetween, formatDate, formatDateTime, formatDuration } from "@/lib/format";
import { asleepMilliseconds } from "@/lib/sleep";

export const Route = createFileRoute("/_authenticated/health/sleep/$sessionId")({
  component: SleepSessionPage,
});

function SleepSessionPage() {
  const { sessionId } = Route.useParams();
  const query = useSleepSession(sessionId);
  const session = query.data?.health.sleepSession;
  return (
    <>
      <PageHeader
        title={session ? `Sleep · ${formatDate(session.startTime)}` : "Sleep"}
        description={
          <Link to="/health/sleep" className="underline-offset-4 hover:underline">
            ← Sleep
          </Link>
        }
      />
      <QueryState
        query={query}
        isEmpty={(data) => !data.health.sleepSession}
        empty={<EmptyState title="This sleep session does not exist" />}
      >
        {(data) => {
          const detail = data.health.sleepSession;
          if (!detail) return null;
          const asleep = asleepMilliseconds(detail.stages);
          return (
            <>
              <Section title="Summary">
                <Facts
                  items={[
                    ["Title", detail.title ?? "—"],
                    ["Start", formatDateTime(detail.startTime)],
                    ["End", formatDateTime(detail.endTime)],
                    ["In bed", formatDuration(durationBetween(detail.startTime, detail.endTime))],
                    ["Asleep", asleep === null ? "—" : formatDuration(asleep)],
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
              <Section title="Stages">
                <SleepTimeline session={detail} />
              </Section>
              <Section title="Time per stage">
                <StageTotalsTable stages={detail.stages} />
              </Section>
            </>
          );
        }}
      </QueryState>
    </>
  );
}
