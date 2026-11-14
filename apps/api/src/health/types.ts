export const HEALTH_SCHEMA_VERSION = 1;
export const MAX_RECORDS_PER_BATCH = 1000;
export const MAX_DELETIONS_PER_BATCH = 1000;

type HealthOrigin = "HEALTH_CONNECT";

export type HealthRecordInput = {
  origin: HealthOrigin;
  recordType: string;
  sourceRecordId: string;
  dataOrigin?: string | null;
  startTime: Date;
  endTime?: Date | null;
  startZoneOffsetSeconds?: number | null;
  endZoneOffsetSeconds?: number | null;
  modifiedAt: Date;
  payload: Record<string, unknown>;
};

export type HealthRecordDeletionInput = {
  origin: HealthOrigin;
  recordType: string;
  sourceRecordId: string;
  deletedAt: Date;
};

export type HealthSyncInput = {
  batchId: string;
  schemaVersion: number;
  records: HealthRecordInput[];
  deletions: HealthRecordDeletionInput[];
};

export type HealthSyncResult = {
  batchId: string;
  replayed: boolean;
  acceptedRecords: number;
  acceptedDeletions: number;
};
