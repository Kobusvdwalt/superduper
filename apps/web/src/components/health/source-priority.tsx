import { useState } from "react";

import { QueryState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { HealthMetric, SourcePriorityQuery } from "@/gql/graphql";
import { useSetSourcePriority, useSourcePriority } from "@/hooks/use-health";
import { formatNumber } from "@/lib/format";
import { browserTimeZone } from "@/lib/time";

type Origin = SourcePriorityQuery["health"]["sourcePriority"]["origins"][number];

export function SourcePriority({ metric }: { metric: HealthMetric }) {
  const timeZone = browserTimeZone();
  const priority = useSourcePriority({ metric, timeZone });
  return (
    <QueryState query={priority}>
      {(data) => (
        <SourcePriorityEditor
          key={data.health.sourcePriority.origins.map((o) => o.dataOrigin).join("|")}
          metric={metric}
          timeZone={timeZone}
          origins={data.health.sourcePriority.origins}
          saved={data.health.sourcePriority.savedOrder.length > 0}
        />
      )}
    </QueryState>
  );
}

function SourcePriorityEditor({
  metric,
  timeZone,
  origins,
  saved,
}: {
  metric: HealthMetric;
  timeZone: string;
  origins: Origin[];
  saved: boolean;
}) {
  const [order, setOrder] = useState(origins);
  const save = useSetSourcePriority();
  const changed = order.some((origin, index) => origin !== origins[index]);

  const move = (index: number, by: -1 | 1) =>
    setOrder((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (item) next.splice(index + by, 0, item);
      return next;
    });
  const submit = (dataOrigins: string[]) => save.mutate({ metric, timeZone, dataOrigins });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        With the preferred source, each day uses only the first origin below that has data that day.{" "}
        {saved
          ? "This order is saved."
          : "No order is saved, so this is the default: most days covered, then most samples."}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Data origin</TableHead>
            <TableHead className="text-right">Days</TableHead>
            <TableHead className="text-right">Samples</TableHead>
            <TableHead>Order from</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.map((origin, index) => (
            <TableRow key={origin.dataOrigin ?? ""}>
              <TableCell>{index + 1}</TableCell>
              <TableCell className="font-mono text-xs">{origin.dataOrigin ?? "unknown"}</TableCell>
              <TableCell className="text-right">{formatNumber(origin.days)}</TableCell>
              <TableCell className="text-right">{formatNumber(origin.samples)}</TableCell>
              <TableCell>
                <Badge variant="outline">{origin.saved ? "saved" : "default"}</Badge>
              </TableCell>
              <TableCell className="flex gap-1">
                <Button
                  variant="outline"
                  size="xs"
                  disabled={index === 0}
                  aria-label={`Move ${origin.dataOrigin ?? "unknown"} up`}
                  onClick={() => move(index, -1)}
                >
                  Up
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={index === order.length - 1}
                  aria-label={`Move ${origin.dataOrigin ?? "unknown"} down`}
                  onClick={() => move(index, 1)}
                >
                  Down
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!changed || save.isPending}
          onClick={() =>
            submit(order.flatMap((origin) => (origin.dataOrigin ? [origin.dataOrigin] : [])))
          }
        >
          Save order
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!saved || save.isPending}
          onClick={() => submit([])}
        >
          Reset to default
        </Button>
      </div>
      {save.error ? <p className="text-sm text-destructive">{save.error.message}</p> : null}
    </div>
  );
}
