import { apiError } from "../graphql/errors";
import {
  HEALTH_SCHEMA_VERSION,
  MAX_DELETIONS_PER_BATCH,
  MAX_RECORDS_PER_BATCH,
  type HealthSyncInput,
} from "./types";

const RECORD_TYPE = /^[A-Za-z][A-Za-z0-9]{0,127}$/;
const MAX_ID_LENGTH = 512;
const MAX_ZONE_OFFSET_SECONDS = 18 * 3600;

function fail(message: string): never {
  throw apiError("BAD_USER_INPUT", message);
}

function checkKey(at: string, recordType: string, sourceRecordId: string) {
  if (!RECORD_TYPE.test(recordType)) fail(`${at}.recordType is not a valid type name.`);
  if (sourceRecordId.length === 0 || sourceRecordId.length > MAX_ID_LENGTH) {
    fail(`${at}.sourceRecordId must be 1 to ${MAX_ID_LENGTH} characters.`);
  }
}

function checkOffset(at: string, value: number | null | undefined) {
  if (value !== null && value !== undefined && Math.abs(value) > MAX_ZONE_OFFSET_SECONDS) {
    fail(`${at} must be within ±18 hours.`);
  }
}

export function validateSyncInput(input: HealthSyncInput): void {
  if (input.schemaVersion !== HEALTH_SCHEMA_VERSION) {
    fail(`schemaVersion ${input.schemaVersion} is not supported; send ${HEALTH_SCHEMA_VERSION}.`);
  }
  if (input.records.length > MAX_RECORDS_PER_BATCH) {
    fail(`A batch holds at most ${MAX_RECORDS_PER_BATCH} records.`);
  }
  if (input.deletions.length > MAX_DELETIONS_PER_BATCH) {
    fail(`A batch holds at most ${MAX_DELETIONS_PER_BATCH} deletions.`);
  }

  input.records.forEach((record, index) => {
    const at = `records[${index}]`;
    checkKey(at, record.recordType, record.sourceRecordId);
    if (record.endTime && record.endTime < record.startTime)
      fail(`${at}.endTime precedes startTime.`);
    if (record.dataOrigin && record.dataOrigin.length > MAX_ID_LENGTH) {
      fail(`${at}.dataOrigin must be at most ${MAX_ID_LENGTH} characters.`);
    }
    checkOffset(`${at}.startZoneOffsetSeconds`, record.startZoneOffsetSeconds);
    checkOffset(`${at}.endZoneOffsetSeconds`, record.endZoneOffsetSeconds);
  });

  input.deletions.forEach((deletion, index) => {
    checkKey(`deletions[${index}]`, deletion.recordType, deletion.sourceRecordId);
  });
}
