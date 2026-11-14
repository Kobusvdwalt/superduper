import { createFileRoute, Link } from "@tanstack/react-router";

import { RecordDetail } from "@/components/health/record-detail";
import { PageHeader } from "@/components/page";
import { EmptyState, QueryState } from "@/components/states";
import { useRawRecord } from "@/hooks/use-health";

export const Route = createFileRoute("/_authenticated/health/records/$recordId")({
  component: RecordPage,
});

function RecordPage() {
  const { recordId } = Route.useParams();
  const record = useRawRecord(recordId);
  return (
    <>
      <PageHeader
        title={record.data?.health.rawRecord?.recordType ?? "Record"}
        description={
          <Link to="/health/records" className="underline-offset-4 hover:underline">
            ← Records
          </Link>
        }
      />
      <QueryState
        query={record}
        isEmpty={(data) => !data.health.rawRecord}
        empty={<EmptyState title="This record does not exist" />}
      >
        {(data) => (data.health.rawRecord ? <RecordDetail record={data.health.rawRecord} /> : null)}
      </QueryState>
    </>
  );
}
