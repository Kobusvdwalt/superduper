import type { ObjectRef } from "@pothos/core";

import { builder, type Types } from "./builder";
import { apiError } from "./errors";

const LIMIT_DEFAULT = 100;
const LIMIT_MAX = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Page<T> = { items: T[]; nextCursor: string | null };

/** Keyset position: the sort time and id of the last item returned. */
export type Cursor = { time: Date; id: string };

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.time.toISOString()}|${cursor.id}`).toString("base64url");
}

export function decodeCursor(value: string | null | undefined): Cursor | null {
  if (!value) return null;
  const [time, id] = Buffer.from(value, "base64url").toString().split("|");
  const date = new Date(time ?? "");
  if (!id || !UUID.test(id) || Number.isNaN(date.getTime()))
    throw apiError("BAD_USER_INPUT", "Invalid cursor.");
  return { time: date, id };
}

export function clampLimit(limit: number | null | undefined): number {
  if (limit === null || limit === undefined) return LIMIT_DEFAULT;
  if (limit < 1) throw apiError("BAD_USER_INPUT", "limit must be at least 1.");
  return Math.min(limit, LIMIT_MAX);
}

/** Expects `rows` fetched with `limit + 1` to detect a further page. */
export function toPage<T>(rows: T[], limit: number, position: (row: T) => Cursor): Page<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor: rows.length > limit && last ? encodeCursor(position(last)) : null,
  };
}

export function pageType<T>(name: string, item: ObjectRef<Types, T>) {
  return builder.objectRef<Page<T>>(name).implement({
    fields: (t) => ({
      items: t.field({ type: [item], resolve: (page) => page.items }),
      nextCursor: t.exposeString("nextCursor", {
        nullable: true,
        description: "Pass as `after` for the next page; null on the last page.",
      }),
    }),
  });
}
