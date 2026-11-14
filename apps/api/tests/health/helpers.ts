import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { TestApp } from "../_hooks/app";

const FIXTURES_DIR = new URL("../../../../contracts/health-connect/v1/", import.meta.url).pathname;

export type RecordInput = {
  origin: "HEALTH_CONNECT";
  recordType: string;
  sourceRecordId: string;
  dataOrigin: string | null;
  startTime: string;
  endTime: string | null;
  startZoneOffsetSeconds: number | null;
  endZoneOffsetSeconds: number | null;
  modifiedAt: string;
  payload: Record<string, any>;
};

export type DeletionInput = {
  origin: "HEALTH_CONNECT";
  recordType: string;
  sourceRecordId: string;
  deletedAt: string;
};

export async function loadFixtures(): Promise<Map<string, RecordInput>> {
  const fixtures = new Map<string, RecordInput>();
  for (const file of readdirSync(FIXTURES_DIR).sort()) {
    if (!file.endsWith(".json")) continue;
    fixtures.set(file.replace(/\.json$/, ""), await Bun.file(join(FIXTURES_DIR, file)).json());
  }
  return fixtures;
}

const SYNC = `mutation($input: HealthSyncInput!) {
  health { sync(input: $input) { batchId replayed acceptedRecords acceptedDeletions } }
}`;

export function batch(
  records: RecordInput[] = [],
  deletions: DeletionInput[] = [],
  batchId: string = crypto.randomUUID(),
) {
  return { batchId, schemaVersion: 1, records, deletions };
}

export function sync(app: TestApp, token: string, input: ReturnType<typeof batch>) {
  return app.execute(SYNC, { token, variables: { input } });
}

export function steps(
  sourceRecordId: string,
  count: number,
  modifiedAt: string,
  overrides: Partial<RecordInput> = {},
): RecordInput {
  return {
    origin: "HEALTH_CONNECT",
    recordType: "StepsRecord",
    sourceRecordId,
    dataOrigin: "com.example.fitness",
    startTime: "2026-11-10T06:00:00Z",
    endTime: "2026-11-10T07:00:00Z",
    startZoneOffsetSeconds: 7200,
    endZoneOffsetSeconds: 7200,
    modifiedAt,
    payload: {
      startTime: "2026-11-10T06:00:00Z",
      startZoneOffsetSeconds: 7200,
      endTime: "2026-11-10T07:00:00Z",
      endZoneOffsetSeconds: 7200,
      count,
      metadata: {
        id: sourceRecordId,
        dataOrigin: "com.example.fitness",
        lastModifiedTime: modifiedAt,
        clientRecordId: null,
        clientRecordVersion: 0,
        recordingMethod: 2,
        recordingMethodName: "AUTOMATICALLY_RECORDED",
        device: null,
      },
    },
    ...overrides,
  };
}

export function deletion(sourceRecordId: string, deletedAt: string, recordType = "StepsRecord") {
  return { origin: "HEALTH_CONNECT" as const, recordType, sourceRecordId, deletedAt };
}
