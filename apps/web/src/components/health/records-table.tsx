import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RawRecordsQuery } from "@/gql/graphql";
import { formatDateTime } from "@/lib/format";

type RecordRow = RawRecordsQuery["health"]["rawRecords"]["items"][number];

export function RecordsTable({ records }: { records: RecordRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Start</TableHead>
          <TableHead>Record type</TableHead>
          <TableHead>Data origin</TableHead>
          <TableHead>Modified</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => (
          <TableRow key={record.id}>
            <TableCell>
              <Link
                to="/health/records/$recordId"
                params={{ recordId: record.id }}
                className="underline-offset-4 hover:underline"
              >
                {formatDateTime(record.startTime)}
              </Link>
            </TableCell>
            <TableCell>{record.recordType}</TableCell>
            <TableCell>{record.dataOrigin ?? "—"}</TableCell>
            <TableCell>{formatDateTime(record.modifiedAt)}</TableCell>
            <TableCell className="flex gap-1">
              {record.deletedAt ? <Badge variant="secondary">deleted</Badge> : null}
              {record.projectionError ? (
                <Badge variant="destructive" title={record.projectionError}>
                  projection error
                </Badge>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
