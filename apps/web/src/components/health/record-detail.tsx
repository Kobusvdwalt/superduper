import { Facts, Section } from "@/components/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { RawRecordQuery } from "@/gql/graphql";
import { formatDateTime } from "@/lib/format";

import { JsonView } from "./json-view";

type RawRecord = NonNullable<RawRecordQuery["health"]["rawRecord"]>;

const offset = (seconds: number | null | undefined) =>
  seconds === null || seconds === undefined
    ? "—"
    : `UTC${seconds >= 0 ? "+" : "−"}${Math.abs(seconds / 3600)}`;

export function RecordDetail({ record }: { record: RawRecord }) {
  return (
    <>
      {record.projectionError ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Projection failed</AlertTitle>
          <AlertDescription>{record.projectionError}</AlertDescription>
        </Alert>
      ) : null}
      <Section title="Envelope">
        <Facts
          items={[
            ["Record type", record.recordType],
            ["Origin", record.origin],
            ["Data origin", record.dataOrigin ?? "—"],
            ["Source record id", record.sourceRecordId],
            [
              "Start",
              `${formatDateTime(record.startTime)} (${offset(record.startZoneOffsetSeconds)})`,
            ],
            [
              "End",
              record.endTime
                ? `${formatDateTime(record.endTime)} (${offset(record.endZoneOffsetSeconds)})`
                : "—",
            ],
            ["Modified at origin", formatDateTime(record.modifiedAt)],
            ["Received", formatDateTime(record.receivedAt)],
            ["Deleted", record.deletedAt ? formatDateTime(record.deletedAt) : "—"],
            ["Schema version", String(record.schemaVersion)],
            ["Last received from client", record.clientId ?? "deleted client"],
          ]}
        />
      </Section>
      <Section title="Payload">
        <JsonView value={record.payload} label="Payload JSON" />
      </Section>
      <Section title={`Version history (${record.versions.length})`}>
        <ol className="flex flex-col gap-3">
          {record.versions.map((version, index) => (
            <li key={version.id} className="rounded-lg border p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">#{index + 1}</span>
                <Badge variant={version.operation === "DELETE" ? "secondary" : "outline"}>
                  {version.operation}
                </Badge>
                <Badge variant={version.applied ? "default" : "outline"}>
                  {version.applied ? "applied" : "not applied"}
                </Badge>
                <span className="text-muted-foreground">
                  received {formatDateTime(version.receivedAt)}
                  {` from client ${version.clientId ?? "(deleted)"}`}
                  {version.modifiedAt ? ` · modified ${formatDateTime(version.modifiedAt)}` : ""}
                  {version.deletedAt ? ` · deleted ${formatDateTime(version.deletedAt)}` : ""}
                </span>
              </div>
              {version.payload ? (
                <details>
                  <summary className="cursor-pointer text-sm">Payload</summary>
                  <JsonView value={version.payload} label={`Version ${index + 1} payload`} />
                </details>
              ) : null}
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}
