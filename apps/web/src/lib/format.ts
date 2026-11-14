const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const date = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const time = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });
const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function formatDateTime(value: string | null | undefined): string {
  return value ? dateTime.format(new Date(value)) : "—";
}

export function formatDate(value: string | null | undefined): string {
  return value ? date.format(new Date(value)) : "—";
}

export function formatTime(value: string | null | undefined): string {
  return value ? time.format(new Date(value)) : "—";
}

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : number.format(value);
}

export function formatDuration(milliseconds: number): string {
  const minutes = Math.round(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

export function durationBetween(start: string, end: string): number {
  return new Date(end).getTime() - new Date(start).getTime();
}

/** `RUNNING` → `Running`, `AWAKE_IN_BED` → `Awake in bed`. */
export function humanize(constant: string): string {
  const words = constant.toLowerCase().replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
