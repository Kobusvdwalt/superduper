import { DateRangeControls, OriginSelect } from "@/components/health/series-controls";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export type RecordFilterValues = {
  from: string;
  to: string;
  type: string | null;
  origin: string | null;
  deleted: boolean;
};

export function RecordFilters({
  value,
  recordTypes,
  origins,
  onChange,
}: {
  value: RecordFilterValues;
  recordTypes: string[];
  origins: string[];
  onChange: (patch: Partial<RecordFilterValues>) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="record-type">Record type</Label>
        <NativeSelect
          id="record-type"
          value={value.type ?? ""}
          onChange={(event) => onChange({ type: event.target.value || null })}
        >
          <NativeSelectOption value="">All types</NativeSelectOption>
          {recordTypes.map((type) => (
            <NativeSelectOption key={type} value={type}>
              {type}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <DateRangeControls from={value.from} to={value.to} onChange={onChange} />
      <OriginSelect
        origins={origins}
        value={value.origin}
        onChange={(origin) => onChange({ origin })}
      />
      <Label className="flex items-center gap-2 pb-2">
        <Checkbox
          checked={value.deleted}
          onCheckedChange={(checked) => onChange({ deleted: checked === true })}
        />
        Include deleted
      </Label>
    </div>
  );
}
