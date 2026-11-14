import { Link } from "@tanstack/react-router";

import { EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { HealthRouteStatus, WorkoutQuery } from "@/gql/graphql";
import {
  durationBetween,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatTime,
  humanize,
} from "@/lib/format";
import { projectRoute } from "@/lib/route";

type WorkoutRow = {
  id: string;
  activityType: string;
  title?: string | null;
  startTime: string;
  endTime: string;
  routeStatus?: HealthRouteStatus | null;
  dataOrigin?: string | null;
};
type Workout = NonNullable<WorkoutQuery["health"]["workout"]>;

export function RouteStatusBadge({ status }: { status: HealthRouteStatus | null | undefined }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant={status === "DATA" ? "default" : "outline"}>
      {status === "DATA" ? "route" : humanize(status)}
    </Badge>
  );
}

export function WorkoutsTable({ workouts }: { workouts: WorkoutRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Start</TableHead>
          <TableHead>Activity</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Route</TableHead>
          <TableHead>Data origin</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workouts.map((workout) => (
          <TableRow key={workout.id}>
            <TableCell>
              <Link
                to="/health/workouts/$workoutId"
                params={{ workoutId: workout.id }}
                className="underline-offset-4 hover:underline"
              >
                {formatDateTime(workout.startTime)}
              </Link>
            </TableCell>
            <TableCell>
              {humanize(workout.activityType)}
              {workout.title ? ` · ${workout.title}` : null}
            </TableCell>
            <TableCell>
              {formatDuration(durationBetween(workout.startTime, workout.endTime))}
            </TableCell>
            <TableCell>
              <RouteStatusBadge status={workout.routeStatus} />
            </TableCell>
            <TableCell>{workout.dataOrigin ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function SegmentsTable({ segments }: { segments: Workout["segments"] }) {
  if (segments.length === 0) return <EmptyState title="No segments recorded" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Segment</TableHead>
          <TableHead>Start</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead className="text-right">Repetitions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {segments.map((segment) => (
          <TableRow key={`${segment.segmentType}-${segment.startTime}`}>
            <TableCell>{humanize(segment.segmentType)}</TableCell>
            <TableCell>{formatTime(segment.startTime)}</TableCell>
            <TableCell>
              {formatDuration(durationBetween(segment.startTime, segment.endTime))}
            </TableCell>
            <TableCell className="text-right">{formatNumber(segment.repetitions)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function LapsTable({ laps }: { laps: Workout["laps"] }) {
  if (laps.length === 0) return <EmptyState title="No laps recorded" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lap</TableHead>
          <TableHead>Start</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead className="text-right">Length (m)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {laps.map((lap, index) => (
          <TableRow key={lap.startTime}>
            <TableCell>{index + 1}</TableCell>
            <TableCell>{formatTime(lap.startTime)}</TableCell>
            <TableCell>{formatDuration(durationBetween(lap.startTime, lap.endTime))}</TableCell>
            <TableCell className="text-right">{formatNumber(lap.lengthMeters)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const ROUTE_WIDTH = 480;
const ROUTE_HEIGHT = 320;

export function RouteMap({ route }: { route: Workout["route"] }) {
  const points = projectRoute(route, ROUTE_WIDTH, ROUTE_HEIGHT);
  const first = points[0];
  const last = points.at(-1);
  return (
    <svg
      viewBox={`0 0 ${ROUTE_WIDTH} ${ROUTE_HEIGHT}`}
      className="w-full max-w-xl rounded-lg border"
      role="img"
      aria-label={`Route with ${route.length} points`}
    >
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {first ? <circle cx={first.x} cy={first.y} r={5} fill="var(--chart-2)" /> : null}
      {last && points.length > 1 ? (
        <circle cx={last.x} cy={last.y} r={5} fill="var(--chart-5)" />
      ) : null}
    </svg>
  );
}
