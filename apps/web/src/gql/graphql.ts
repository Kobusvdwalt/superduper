/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type ClientKind =
  | 'CONNECTOR'
  | 'DEVICE';

export type CreateClientInput = {
  kind: ClientKind;
  name: string;
  platform?: string | null | undefined;
};

export type HealthAggregation =
  | 'AVG'
  | 'COUNT'
  | 'MAX'
  | 'MIN'
  | 'SUM';

export type HealthBucket =
  | 'DAY'
  | 'HOUR'
  | 'MONTH'
  | 'WEEK';

/** A numeric health measurement. Each has one canonical unit; see `HealthMetricCoverage.unit`. */
export type HealthMetric =
  | 'ACTIVE_ENERGY_BURNED'
  | 'BASAL_BODY_TEMPERATURE'
  | 'BASAL_METABOLIC_RATE'
  | 'BLOOD_GLUCOSE'
  | 'BLOOD_PRESSURE_DIASTOLIC'
  | 'BLOOD_PRESSURE_SYSTOLIC'
  | 'BODY_FAT'
  | 'BODY_TEMPERATURE'
  | 'BODY_WATER_MASS'
  | 'BONE_MASS'
  | 'CYCLING_PEDALING_CADENCE'
  | 'DISTANCE'
  | 'ELEVATION_GAINED'
  | 'FLOORS_CLIMBED'
  | 'HEART_RATE'
  | 'HEART_RATE_VARIABILITY_RMSSD'
  | 'HEIGHT'
  | 'HYDRATION'
  | 'LEAN_BODY_MASS'
  | 'OXYGEN_SATURATION'
  | 'POWER'
  | 'RESPIRATORY_RATE'
  | 'RESTING_HEART_RATE'
  | 'SKIN_TEMPERATURE_BASELINE'
  | 'SKIN_TEMPERATURE_DELTA'
  | 'SPEED'
  | 'STEPS'
  | 'STEPS_CADENCE'
  | 'TOTAL_ENERGY_BURNED'
  | 'VO2_MAX'
  | 'WEIGHT'
  | 'WHEELCHAIR_PUSHES';

export type HealthOrigin =
  | 'HEALTH_CONNECT';

export type HealthRecordOperation =
  | 'DELETE'
  | 'UPSERT';

export type HealthRouteStatus =
  | 'CONSENT_REQUIRED'
  | 'DATA'
  | 'NO_DATA';

export type HealthSleepStage =
  | 'AWAKE'
  | 'AWAKE_IN_BED'
  | 'DEEP'
  | 'LIGHT'
  | 'OUT_OF_BED'
  | 'REM'
  | 'SLEEPING'
  | 'UNKNOWN';

export type HealthSourceMode =
  /** Every sample; overlapping origins of a cumulative metric add up. */
  | 'ALL'
  /** Per local day, only the highest-priority data origin with samples that day (see `HealthQuery.sourcePriority`). Intervals that overlap within a day are not split between origins. */
  | 'PREFERRED';

export type ClientsQueryVariables = Exact<{ [key: string]: never; }>;


export type ClientsQuery = { identity: { clients: Array<{ id: string, name: string, kind: ClientKind, platform: string | null, createdAt: string, lastSeenAt: string | null, revokedAt: string | null }> }, health: { clientSyncs: Array<{ lastSyncedAt: string, batches: number, client: { id: string } }> } };

export type CreateClientMutationVariables = Exact<{
  input: CreateClientInput;
}>;


export type CreateClientMutation = { identity: { createClient: { token: string, client: { id: string, name: string } } } };

export type RevokeClientMutationVariables = Exact<{
  id: string;
}>;


export type RevokeClientMutation = { identity: { revokeClient: { id: string, revokedAt: string | null } } };

export type CreateDeviceClientMutationVariables = Exact<{
  input: CreateClientInput;
}>;


export type CreateDeviceClientMutation = { identity: { createClient: { token: string, client: { id: string } } } };

export type RevokeDeviceClientMutationVariables = Exact<{
  id: string;
}>;


export type RevokeDeviceClientMutation = { identity: { revokeClient: { id: string } } };

export type CoverageQueryVariables = Exact<{ [key: string]: never; }>;


export type CoverageQuery = { health: { metrics: Array<{ metric: HealthMetric, unit: string, dataOrigin: string | null, count: number, firstTime: string | null, lastTime: string | null }>, recordTypes: Array<{ recordType: string, dataOrigin: string | null, count: number, projectionErrors: number, firstTime: string | null, lastTime: string | null }> } };

export type QuantitySeriesQueryVariables = Exact<{
  metric: HealthMetric;
  from: string;
  to: string;
  bucket: HealthBucket;
  aggregation: HealthAggregation;
  dataOrigin?: string | null | undefined;
  sourceMode?: HealthSourceMode | null | undefined;
  timeZone: string;
}>;


export type QuantitySeriesQuery = { health: { quantitySeries: { metric: HealthMetric, unit: string, cumulative: boolean, sourceMode: HealthSourceMode, buckets: Array<{ bucketStart: string, value: number, count: number, dataOrigins: Array<string | null> }>, sources: Array<{ dataOrigin: string | null, days: number, samples: number }> } } };

export type QuantitySamplesQueryVariables = Exact<{
  metric: HealthMetric;
  from?: string | null | undefined;
  to?: string | null | undefined;
  dataOrigin?: string | null | undefined;
  after?: string | null | undefined;
}>;


export type QuantitySamplesQuery = { health: { quantitySamples: { nextCursor: string | null, items: Array<{ id: string, startTime: string, endTime: string | null, value: number, unit: string, dataOrigin: string | null, rawRecordId: string }> } } };

export type RawRecordsQueryVariables = Exact<{
  recordType?: string | null | undefined;
  from?: string | null | undefined;
  to?: string | null | undefined;
  dataOrigin?: string | null | undefined;
  includeDeleted?: boolean | null | undefined;
  after?: string | null | undefined;
}>;


export type RawRecordsQuery = { health: { rawRecords: { nextCursor: string | null, items: Array<{ id: string, recordType: string, dataOrigin: string | null, startTime: string, endTime: string | null, modifiedAt: string, deletedAt: string | null, projectionError: string | null }> } } };

export type RawRecordQueryVariables = Exact<{
  id: string;
}>;


export type RawRecordQuery = { health: { rawRecord: { id: string, clientId: string | null, origin: HealthOrigin, recordType: string, sourceRecordId: string, dataOrigin: string | null, startTime: string, endTime: string | null, startZoneOffsetSeconds: number | null, endZoneOffsetSeconds: number | null, modifiedAt: string, receivedAt: string, deletedAt: string | null, schemaVersion: number, projectionError: string | null, payload: unknown, versions: Array<{ id: string, operation: HealthRecordOperation, applied: boolean, modifiedAt: string | null, deletedAt: string | null, receivedAt: string, clientId: string | null, schemaVersion: number, syncBatchId: string, payload: unknown }> } | null } };

export type SleepSessionsQueryVariables = Exact<{
  from?: string | null | undefined;
  to?: string | null | undefined;
  after?: string | null | undefined;
}>;


export type SleepSessionsQuery = { health: { sleepSessions: { nextCursor: string | null, items: Array<{ id: string, title: string | null, startTime: string, endTime: string, dataOrigin: string | null, stages: Array<{ stage: HealthSleepStage, startTime: string, endTime: string }> }> } } };

export type SleepSessionQueryVariables = Exact<{
  id: string;
}>;


export type SleepSessionQuery = { health: { sleepSession: { id: string, title: string | null, notes: string | null, startTime: string, endTime: string, startZoneOffsetSeconds: number | null, dataOrigin: string | null, rawRecordId: string, stages: Array<{ stage: HealthSleepStage, startTime: string, endTime: string }> } | null } };

export type WorkoutsQueryVariables = Exact<{
  from?: string | null | undefined;
  to?: string | null | undefined;
  after?: string | null | undefined;
}>;


export type WorkoutsQuery = { health: { workouts: { nextCursor: string | null, items: Array<{ id: string, activityType: string, title: string | null, startTime: string, endTime: string, routeStatus: HealthRouteStatus | null, dataOrigin: string | null }> } } };

export type WorkoutQueryVariables = Exact<{
  id: string;
}>;


export type WorkoutQuery = { health: { workout: { id: string, activityType: string, title: string | null, notes: string | null, startTime: string, endTime: string, routeStatus: HealthRouteStatus | null, dataOrigin: string | null, rawRecordId: string, segments: Array<{ segmentType: string, repetitions: number | null, startTime: string, endTime: string }>, laps: Array<{ startTime: string, endTime: string, lengthMeters: number | null }>, route: Array<{ time: string, latitude: number, longitude: number, altitudeMeters: number | null }> } | null } };

export type SourcePriorityQueryVariables = Exact<{
  metric: HealthMetric;
  timeZone: string;
}>;


export type SourcePriorityQuery = { health: { sourcePriority: { metric: HealthMetric, savedOrder: Array<string>, origins: Array<{ dataOrigin: string | null, rank: number, saved: boolean, days: number, samples: number }> } } };

export type SetSourcePriorityMutationVariables = Exact<{
  metric: HealthMetric;
  dataOrigins: Array<string> | string;
  timeZone: string;
}>;


export type SetSourcePriorityMutation = { health: { setSourcePriority: { metric: HealthMetric } } };


export const ClientsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Clients"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"identity"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clients"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"platform"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastSeenAt"}},{"kind":"Field","name":{"kind":"Name","value":"revokedAt"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"health"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clientSyncs"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"client"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"lastSyncedAt"}},{"kind":"Field","name":{"kind":"Name","value":"batches"}}]}}]}}]}}]} as unknown as DocumentNode<ClientsQuery, ClientsQueryVariables>;
export const CreateClientDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateClient"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateClientInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"identity"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createClient"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"client"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<CreateClientMutation, CreateClientMutationVariables>;
export const RevokeClientDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RevokeClient"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UUID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"identity"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"revokeClient"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"revokedAt"}}]}}]}}]}}]} as unknown as DocumentNode<RevokeClientMutation, RevokeClientMutationVariables>;
export const CreateDeviceClientDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateDeviceClient"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateClientInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"identity"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createClient"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"client"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]} as unknown as DocumentNode<CreateDeviceClientMutation, CreateDeviceClientMutationVariables>;
export const RevokeDeviceClientDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RevokeDeviceClient"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UUID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"identity"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"revokeClient"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<RevokeDeviceClientMutation, RevokeDeviceClientMutationVariables>;
export const CoverageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Coverage"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"health"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metrics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metric"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"dataOrigin"}},{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"firstTime"}},{"kind":"Field","name":{"kind":"Name","value":"lastTime"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recordTypes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordType"}},{"kind":"Field","name":{"kind":"Name","value":"dataOrigin"}},{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"projectionErrors"}},{"kind":"Field","name":{"kind":"Name","value":"firstTime"}},{"kind":"Field","name":{"kind":"Name","value":"lastTime"}}]}}]}}]}}]} as unknown as DocumentNode<CoverageQuery, CoverageQueryVariables>;
export const QuantitySeriesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"QuantitySeries"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"metric"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"HealthMetric"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"from"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DateTime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"to"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DateTime"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"bucket"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"HealthBucket"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"aggregation"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"HealthAggregation"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"dataOrigin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sourceMode"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"HealthSourceMode"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"timeZone"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"health"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"quantitySeries"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"metric"},"value":{"kind":"Variable","name":{"kind":"Name","value":"metric"}}},{"kind":"Argument","name":{"kind":"Name","value":"from"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}},{"kind":"Argument","name":{"kind":"Name","value":"to"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}},{"kind":"Argument","name":{"kind":"Name","value":"bucket"},"value":{"kind":"Variable","name":{"kind":"Name","value":"bucket"}}},{"kind":"Argument","name":{"kind":"Name","value":"aggregation"},"value":{"kind":"Variable","name":{"kind":"Name","value":"aggregation"}}},{"kind":"Argument","name":{"kind":"Name","value":"dataOrigin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"dataOrigin"}}},{"kind":"Argument","name":{"kind":"Name","value":"sourceMode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sourceMode"}}},{"kind":"Argument","name":{"kind":"Name","value":"timeZone"},"value":{"kind":"Variable","name":{"kind":"Name","value":"timeZone"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metric"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"cumulative"}},{"kind":"Field","name":{"kind":"Name","value":"sourceMode"}},{"kind":"Field","name":{"kind":"Name","value":"buckets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bucketStart"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"dataOrigins"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sources"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dataOrigin"}},{"kind":"Field","name":{"kind":"Name","value":"days"}},{"kind":"Field","name":{"kind":"Name","value":"samples"}}]}}]}}]}}]}}]} as unknown as DocumentNode<QuantitySeriesQuery, QuantitySeriesQueryVariables>;
export const QuantitySamplesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"QuantitySamples"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"metric"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"HealthMetric"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"from"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"DateTime"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"to"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"DateTime"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"dataOrigin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"health"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"quantitySamples"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"metric"},"value":{"kind":"Variable","name":{"kind":"Name","value":"metric"}}},{"kind":"Argument","name":{"kind":"Name","value":"from"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}},{"kind":"Argument","name":{"kind":"Name","value":"to"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}},{"kind":"Argument","name":{"kind":"Name","value":"dataOrigin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"dataOrigin"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"50"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"endTime"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"dataOrigin"}},{"kind":"Field","name":{"kind":"Name","value":"rawRecordId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nextCursor"}}]}}]}}]}}]} as unknown as DocumentNode<QuantitySamplesQuery, QuantitySamplesQueryVariables>;
export const RawRecordsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RawRecords"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"recordType"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"from"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"DateTime"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"to"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"DateTime"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"dataOrigin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeDeleted"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"health"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rawRecords"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"recordType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"recordType"}}},{"kind":"Argument","name":{"kind":"Name","value":"from"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}},{"kind":"Argument","name":{"kind":"Name","value":"to"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}},{"kind":"Argument","name":{"kind":"Name","value":"dataOrigin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"dataOrigin"}}},{"kind":"Argument","name":{"kind":"Name","value":"includeDeleted"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeDeleted"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"50"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"recordType"}},{"kind":"Field","name":{"kind":"Name","value":"dataOrigin"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"endTime"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedAt"}},{"kind":"Field","name":{"kind":"Name","value":"deletedAt"}},{"kind":"Field","name":{"kind":"Name","value":"projectionError"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nextCursor"}}]}}]}}]}}]} as unknown as DocumentNode<RawRecordsQuery, RawRecordsQueryVariables>;
export const RawRecordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RawRecord"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UUID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"health"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rawRecord"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clientId"}},{"kind":"Field","name":{"kind":"Name","value":"origin"}},{"kind":"Field","name":{"kind":"Name","value":"recordType"}},{"kind":"Field","name":{"kind":"Name","value":"sourceRecordId"}},{"kind":"Field","name":{"kind":"Name","value":"dataOrigin"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"endTime"}},{"kind":"Field","name":{"kind":"Name","value":"startZoneOffsetSeconds"}},{"kind":"Field","name":{"kind":"Name","value":"endZoneOffsetSeconds"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedAt"}},{"kind":"Field","name":{"kind":"Name","value":"receivedAt"}},{"kind":"Field","name":{"kind":"Name","value":"deletedAt"}},{"kind":"Field","name":{"kind":"Name","value":"schemaVersion"}},{"kind":"Field","name":{"kind":"Name","value":"projectionError"}},{"kind":"Field","name":{"kind":"Name","value":"payload"}},{"kind":"Field","name":{"kind":"Name","value":"versions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"operation"}},{"kind":"Field","name":{"kind":"Name","value":"applied"}},{"kind":"Field","name":{"kind":"Name","value":"modifiedAt"}},{"kind":"Field","name":{"kind":"Name","value":"deletedAt"}},{"kind":"Field","name":{"kind":"Name","value":"receivedAt"}},{"kind":"Field","name":{"kind":"Name","value":"clientId"}},{"kind":"Field","name":{"kind":"Name","value":"schemaVersion"}},{"kind":"Field","name":{"kind":"Name","value":"syncBatchId"}},{"kind":"Field","name":{"kind":"Name","value":"payload"}}]}}]}}]}}]}}]} as unknown as DocumentNode<RawRecordQuery, RawRecordQueryVariables>;
export const SleepSessionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SleepSessions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"from"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"DateTime"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"to"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"DateTime"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"health"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sleepSessions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"from"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}},{"kind":"Argument","name":{"kind":"Name","value":"to"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"50"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"endTime"}},{"kind":"Field","name":{"kind":"Name","value":"dataOrigin"}},{"kind":"Field","name":{"kind":"Name","value":"stages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"stage"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"endTime"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"nextCursor"}}]}}]}}]}}]} as unknown as DocumentNode<SleepSessionsQuery, SleepSessionsQueryVariables>;
export const SleepSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SleepSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UUID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"health"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sleepSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"endTime"}},{"kind":"Field","name":{"kind":"Name","value":"startZoneOffsetSeconds"}},{"kind":"Field","name":{"kind":"Name","value":"dataOrigin"}},{"kind":"Field","name":{"kind":"Name","value":"rawRecordId"}},{"kind":"Field","name":{"kind":"Name","value":"stages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"stage"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"endTime"}}]}}]}}]}}]}}]} as unknown as DocumentNode<SleepSessionQuery, SleepSessionQueryVariables>;
export const WorkoutsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Workouts"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"from"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"DateTime"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"to"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"DateTime"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"health"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"workouts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"from"},"value":{"kind":"Variable","name":{"kind":"Name","value":"from"}}},{"kind":"Argument","name":{"kind":"Name","value":"to"},"value":{"kind":"Variable","name":{"kind":"Name","value":"to"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"50"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"activityType"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"endTime"}},{"kind":"Field","name":{"kind":"Name","value":"routeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"dataOrigin"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nextCursor"}}]}}]}}]}}]} as unknown as DocumentNode<WorkoutsQuery, WorkoutsQueryVariables>;
export const WorkoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Workout"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UUID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"health"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"workout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"activityType"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"endTime"}},{"kind":"Field","name":{"kind":"Name","value":"routeStatus"}},{"kind":"Field","name":{"kind":"Name","value":"dataOrigin"}},{"kind":"Field","name":{"kind":"Name","value":"rawRecordId"}},{"kind":"Field","name":{"kind":"Name","value":"segments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"segmentType"}},{"kind":"Field","name":{"kind":"Name","value":"repetitions"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"endTime"}}]}},{"kind":"Field","name":{"kind":"Name","value":"laps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"endTime"}},{"kind":"Field","name":{"kind":"Name","value":"lengthMeters"}}]}},{"kind":"Field","name":{"kind":"Name","value":"route"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"time"}},{"kind":"Field","name":{"kind":"Name","value":"latitude"}},{"kind":"Field","name":{"kind":"Name","value":"longitude"}},{"kind":"Field","name":{"kind":"Name","value":"altitudeMeters"}}]}}]}}]}}]}}]} as unknown as DocumentNode<WorkoutQuery, WorkoutQueryVariables>;
export const SourcePriorityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SourcePriority"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"metric"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"HealthMetric"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"timeZone"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"health"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sourcePriority"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"metric"},"value":{"kind":"Variable","name":{"kind":"Name","value":"metric"}}},{"kind":"Argument","name":{"kind":"Name","value":"timeZone"},"value":{"kind":"Variable","name":{"kind":"Name","value":"timeZone"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metric"}},{"kind":"Field","name":{"kind":"Name","value":"savedOrder"}},{"kind":"Field","name":{"kind":"Name","value":"origins"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"dataOrigin"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"saved"}},{"kind":"Field","name":{"kind":"Name","value":"days"}},{"kind":"Field","name":{"kind":"Name","value":"samples"}}]}}]}}]}}]}}]} as unknown as DocumentNode<SourcePriorityQuery, SourcePriorityQueryVariables>;
export const SetSourcePriorityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetSourcePriority"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"metric"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"HealthMetric"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"dataOrigins"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"timeZone"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"health"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setSourcePriority"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"metric"},"value":{"kind":"Variable","name":{"kind":"Name","value":"metric"}}},{"kind":"Argument","name":{"kind":"Name","value":"dataOrigins"},"value":{"kind":"Variable","name":{"kind":"Name","value":"dataOrigins"}}},{"kind":"Argument","name":{"kind":"Name","value":"timeZone"},"value":{"kind":"Variable","name":{"kind":"Name","value":"timeZone"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metric"}}]}}]}}]}}]} as unknown as DocumentNode<SetSourcePriorityMutation, SetSourcePriorityMutationVariables>;