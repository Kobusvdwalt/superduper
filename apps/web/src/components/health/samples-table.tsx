import { Link } from "@tanstack/react-router";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { QuantitySamplesQuery } from "@/gql/graphql";
import { formatDateTime, formatNumber } from "@/lib/format";

type Sample = QuantitySamplesQuery["health"]["quantitySamples"]["items"][number];

export function SamplesTable({ samples }: { samples: Sample[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Start</TableHead>
          <TableHead>End</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead>Data origin</TableHead>
          <TableHead>Record</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {samples.map((sample) => (
          <TableRow key={sample.id}>
            <TableCell>{formatDateTime(sample.startTime)}</TableCell>
            <TableCell>{sample.endTime ? formatDateTime(sample.endTime) : "instant"}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatNumber(sample.value)} {sample.unit}
            </TableCell>
            <TableCell>{sample.dataOrigin ?? "—"}</TableCell>
            <TableCell>
              <Link
                to="/health/records/$recordId"
                params={{ recordId: sample.rawRecordId }}
                className="underline-offset-4 hover:underline"
              >
                raw
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
