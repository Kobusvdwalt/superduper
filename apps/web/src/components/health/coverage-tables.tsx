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
import type { CoverageQuery } from "@/gql/graphql";
import { formatDateTime, formatNumber } from "@/lib/format";
import { metricLabel } from "@/lib/metrics";

type MetricRow = CoverageQuery["health"]["metrics"][number];
type RecordTypeRow = CoverageQuery["health"]["recordTypes"][number];

export function MetricCoverageTable({ rows }: { rows: MetricRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Metric</TableHead>
          <TableHead>Data origin</TableHead>
          <TableHead className="text-right">Samples</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>First</TableHead>
          <TableHead>Last</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.metric}|${row.dataOrigin ?? ""}`}>
            <TableCell>
              <Link
                to="/health/metrics/$metric"
                params={{ metric: row.metric }}
                search={{ origin: row.dataOrigin ?? undefined }}
                className="underline-offset-4 hover:underline"
              >
                {metricLabel(row.metric)}
              </Link>
            </TableCell>
            <TableCell>{row.dataOrigin ?? "—"}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(row.count)}</TableCell>
            <TableCell>{row.unit}</TableCell>
            <TableCell>{formatDateTime(row.firstTime)}</TableCell>
            <TableCell>{formatDateTime(row.lastTime)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function RecordTypeCoverageTable({ rows }: { rows: RecordTypeRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Record type</TableHead>
          <TableHead>Data origin</TableHead>
          <TableHead className="text-right">Records</TableHead>
          <TableHead>First</TableHead>
          <TableHead>Last</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.recordType}|${row.dataOrigin ?? ""}`}>
            <TableCell>
              <Link
                to="/health/records"
                search={{ type: row.recordType, origin: row.dataOrigin ?? undefined }}
                className="underline-offset-4 hover:underline"
              >
                {row.recordType}
              </Link>
              {row.projectionErrors > 0 ? (
                <Badge variant="destructive" className="ml-2">
                  {row.projectionErrors} projection errors
                </Badge>
              ) : null}
            </TableCell>
            <TableCell>{row.dataOrigin ?? "—"}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(row.count)}</TableCell>
            <TableCell>{formatDateTime(row.firstTime)}</TableCell>
            <TableCell>{formatDateTime(row.lastTime)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
