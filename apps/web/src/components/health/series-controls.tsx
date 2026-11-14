import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { HealthAggregation, HealthBucket } from "@/gql/graphql";
import { humanize } from "@/lib/format";
import { AGGREGATION_LABELS, BUCKETS } from "@/lib/metrics";
import { lastDays } from "@/lib/time";

export type SeriesControlValues = {
  from: string;
  to: string;
  bucket: HealthBucket;
  origin: string | null;
  sources: "ALL" | null;
  aggregation?: HealthAggregation;
};

const ALL_SOURCES = "*all";

const PRESETS = [7, 28, 90, 365] as const;

export function DateRangeControls({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <Label htmlFor="range-from">From</Label>
        <Input
          id="range-from"
          type="date"
          value={from}
          max={to}
          onChange={(event) => event.target.value && onChange({ from: event.target.value, to })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="range-to">To</Label>
        <Input
          id="range-to"
          type="date"
          value={to}
          min={from}
          onChange={(event) => event.target.value && onChange({ from, to: event.target.value })}
        />
      </div>
      <div className="flex gap-1">
        {PRESETS.map((days) => (
          <Button key={days} variant="outline" size="sm" onClick={() => onChange(lastDays(days))}>
            {days}d
          </Button>
        ))}
      </div>
    </>
  );
}

export function SeriesControls({
  value,
  origins,
  aggregations,
  onChange,
}: {
  value: SeriesControlValues;
  origins: string[];
  aggregations?: HealthAggregation[];
  onChange: (patch: Partial<SeriesControlValues>) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <DateRangeControls from={value.from} to={value.to} onChange={onChange} />
      <div className="flex flex-col gap-1">
        <Label htmlFor="series-bucket">Bucket</Label>
        <NativeSelect
          id="series-bucket"
          value={value.bucket}
          onChange={(event) => onChange({ bucket: event.target.value as HealthBucket })}
        >
          {BUCKETS.map((bucket) => (
            <NativeSelectOption key={bucket} value={bucket}>
              {humanize(bucket)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {aggregations && value.aggregation ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="series-aggregation">Aggregation</Label>
          <NativeSelect
            id="series-aggregation"
            value={value.aggregation}
            onChange={(event) => onChange({ aggregation: event.target.value as HealthAggregation })}
          >
            {aggregations.map((aggregation) => (
              <NativeSelectOption key={aggregation} value={aggregation}>
                {AGGREGATION_LABELS[aggregation]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ) : null}
      <SourceSelect
        origins={origins}
        origin={value.origin}
        sources={value.sources}
        onChange={onChange}
      />
    </div>
  );
}

/** For cumulative metrics the default is one source per day; see `sourceMode` in the API. */
function SourceSelect({
  origins,
  origin,
  sources,
  onChange,
}: {
  origins: string[];
  origin: string | null;
  sources: "ALL" | null;
  onChange: (patch: { origin: string | null; sources: "ALL" | null }) => void;
}) {
  const value = origin ?? (sources === "ALL" ? ALL_SOURCES : "");
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="data-origin">Data origin</Label>
      <NativeSelect
        id="data-origin"
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          if (next === ALL_SOURCES) onChange({ origin: null, sources: "ALL" });
          else onChange({ origin: next || null, sources: null });
        }}
      >
        <NativeSelectOption value="">Preferred source per day</NativeSelectOption>
        <NativeSelectOption value={ALL_SOURCES}>All sources (may double count)</NativeSelectOption>
        {origins.map((item) => (
          <NativeSelectOption key={item} value={item}>
            {item}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

export function OriginSelect({
  origins,
  value,
  onChange,
}: {
  origins: string[];
  value: string | null;
  onChange: (origin: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="data-origin">Data origin</Label>
      <NativeSelect
        id="data-origin"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <NativeSelectOption value="">All origins</NativeSelectOption>
        {origins.map((origin) => (
          <NativeSelectOption key={origin} value={origin}>
            {origin}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
