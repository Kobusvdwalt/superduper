import { Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { HealthSleepStage } from "@/gql/graphql";
import { durationBetween, formatDate, formatDuration, formatTime, humanize } from "@/lib/format";
import { asleepMilliseconds, STAGE_ORDER, stageTotals } from "@/lib/sleep";

type Stage = { stage: HealthSleepStage; startTime: string; endTime: string };
type Session = {
  id: string;
  title?: string | null;
  startTime: string;
  endTime: string;
  dataOrigin?: string | null;
  stages: Stage[];
};

const STAGE_COLORS: Record<HealthSleepStage, string> = {
  AWAKE: "var(--chart-5)",
  AWAKE_IN_BED: "var(--chart-4)",
  OUT_OF_BED: "var(--chart-4)",
  REM: "var(--chart-1)",
  LIGHT: "var(--chart-2)",
  SLEEPING: "var(--chart-2)",
  DEEP: "var(--chart-3)",
  UNKNOWN: "var(--muted-foreground)",
};

export function SleepTable({ sessions }: { sessions: Session[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Night of</TableHead>
          <TableHead>Bedtime</TableHead>
          <TableHead>Wake</TableHead>
          <TableHead>In bed</TableHead>
          <TableHead>Asleep</TableHead>
          <TableHead>Data origin</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((session) => {
          const asleep = asleepMilliseconds(session.stages);
          return (
            <TableRow key={session.id}>
              <TableCell>
                <Link
                  to="/health/sleep/$sessionId"
                  params={{ sessionId: session.id }}
                  className="underline-offset-4 hover:underline"
                >
                  {formatDate(session.startTime)}
                </Link>
                {session.title ? ` · ${session.title}` : null}
              </TableCell>
              <TableCell>{formatTime(session.startTime)}</TableCell>
              <TableCell>{formatTime(session.endTime)}</TableCell>
              <TableCell>
                {formatDuration(durationBetween(session.startTime, session.endTime))}
              </TableCell>
              <TableCell>{asleep === null ? "—" : formatDuration(asleep)}</TableCell>
              <TableCell>{session.dataOrigin ?? "—"}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** Hours per stage for each night, stacked. */
export function SleepStagesChart({ sessions }: { sessions: Session[] }) {
  const present = STAGE_ORDER.filter((stage) =>
    sessions.some((session) => session.stages.some((s) => s.stage === stage)),
  );
  const data = sessions.map((session) => {
    const totals = stageTotals(session.stages);
    return {
      night: formatDate(session.startTime),
      ...Object.fromEntries(present.map((stage) => [stage, (totals[stage] ?? 0) / 3_600_000])),
    };
  });
  if (present.length === 0) return null;
  return (
    <div style={{ height: 260 }} aria-label="Sleep stages per night chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="night" fontSize={12} minTickGap={24} />
          <YAxis width={40} fontSize={12} unit="h" />
          <Tooltip formatter={(value) => formatDuration(Number(value) * 3_600_000)} />
          <Legend formatter={(value: string) => humanize(value)} />
          {present.map((stage) => (
            <Bar
              key={stage}
              dataKey={stage}
              stackId="stages"
              fill={STAGE_COLORS[stage]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const ROW_HEIGHT = 28;
const LABEL_WIDTH = 110;
const WIDTH = 900;

/** A hypnogram: one row per stage, time left to right. */
export function SleepTimeline({ session }: { session: Session }) {
  const rows = STAGE_ORDER.filter((stage) => session.stages.some((s) => s.stage === stage));
  const start = new Date(session.startTime).getTime();
  const span = Math.max(1, new Date(session.endTime).getTime() - start);
  const x = (time: string) =>
    LABEL_WIDTH + ((new Date(time).getTime() - start) / span) * (WIDTH - LABEL_WIDTH);
  const height = rows.length * ROW_HEIGHT + 24;
  const hours: number[] = [];
  const firstHour = new Date(start);
  firstHour.setMinutes(0, 0, 0);
  for (let t = firstHour.getTime() + 3_600_000; t < start + span; t += 3_600_000) hours.push(t);

  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">No stages recorded.</p>;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      className="w-full"
      role="img"
      aria-label="Sleep stages timeline"
    >
      {rows.map((stage, index) => (
        <text
          key={stage}
          x={0}
          y={index * ROW_HEIGHT + ROW_HEIGHT / 2 + 4}
          fontSize={12}
          fill="currentColor"
        >
          {humanize(stage)}
        </text>
      ))}
      {hours.map((time) => {
        const position = x(new Date(time).toISOString());
        return (
          <g key={time}>
            <line
              x1={position}
              x2={position}
              y1={0}
              y2={rows.length * ROW_HEIGHT}
              stroke="var(--border)"
            />
            <text x={position} y={height - 6} fontSize={11} textAnchor="middle" fill="currentColor">
              {formatTime(new Date(time).toISOString())}
            </text>
          </g>
        );
      })}
      {session.stages.map((interval) => {
        const row = rows.indexOf(interval.stage);
        return (
          <rect
            key={`${interval.stage}-${interval.startTime}`}
            x={x(interval.startTime)}
            width={Math.max(1, x(interval.endTime) - x(interval.startTime))}
            y={row * ROW_HEIGHT + 4}
            height={ROW_HEIGHT - 8}
            fill={STAGE_COLORS[interval.stage]}
          >
            <title>
              {humanize(interval.stage)}: {formatTime(interval.startTime)}–
              {formatTime(interval.endTime)}
            </title>
          </rect>
        );
      })}
    </svg>
  );
}

export function StageTotalsTable({ stages }: { stages: Stage[] }) {
  const totals = stageTotals(stages);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Stage</TableHead>
          <TableHead>Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {STAGE_ORDER.filter((stage) => totals[stage] !== undefined).map((stage) => (
          <TableRow key={stage}>
            <TableCell>{humanize(stage)}</TableCell>
            <TableCell>{formatDuration(totals[stage] ?? 0)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
