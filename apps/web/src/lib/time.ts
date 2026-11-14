export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** `YYYY-MM-DD` of a date in the browser's time zone. */
function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localMidnight(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1);
}

/** Whole local days, `from` and `to` both inclusive, as an API range with an exclusive end. */
export function dayRange(from: string, to: string): { from: string; to: string } {
  const end = localMidnight(to);
  end.setDate(end.getDate() + 1);
  return { from: localMidnight(from).toISOString(), to: end.toISOString() };
}

/** The last `days` local days, today included. */
export function lastDays(days: number, now: Date = new Date()): { from: string; to: string } {
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  return { from: toDateInput(start), to: toDateInput(now) };
}

export function isDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(localMidnight(value).getTime());
}
