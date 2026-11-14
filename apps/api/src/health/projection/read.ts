export class ProjectionError extends Error {}

type Json = Record<string, unknown>;

function fail(path: string, expected: string): never {
  throw new ProjectionError(`${path}: expected ${expected}`);
}

export function object(value: unknown, path: string): Json {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(path, "an object");
  return value as Json;
}

export function list(source: Json, key: string): Json[] {
  const value = source[key];
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) fail(key, "an array");
  return value.map((item, index) => object(item, `${key}[${index}]`));
}

export function number(source: Json, key: string): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) fail(key, "a number");
  return value;
}

export function optionalNumber(source: Json, key: string): number | null {
  return source[key] === null || source[key] === undefined ? null : number(source, key);
}

export function optionalString(source: Json, key: string): string | null {
  const value = source[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") fail(key, "a string");
  return value;
}

export function time(source: Json, key: string): Date {
  const value = source[key];
  const date = typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) fail(key, "an ISO-8601 instant");
  return date;
}

/** A unit value `{ value, unit }`, which must be in the contract's canonical unit. */
export function optionalUnit(source: Json, key: string, unit: string): number | null {
  const raw = source[key];
  if (raw === null || raw === undefined) return null;
  const value = object(raw, key);
  if (value.unit !== unit) fail(`${key}.unit`, `"${unit}"`);
  return number(value, "value");
}

export function unit(source: Json, key: string, expected: string): number {
  const value = optionalUnit(source, key, expected);
  if (value === null) fail(key, `a ${expected} value`);
  return value;
}

/** The constant name the contract puts beside an integer constant, as `<property>Name`. */
export function constantName(source: Json, key: string): string | null {
  return optionalString(source, `${key}Name`);
}
