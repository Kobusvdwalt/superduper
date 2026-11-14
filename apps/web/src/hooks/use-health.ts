import { graphql } from "@/gql";
import type {
  HealthAggregation,
  HealthBucket,
  HealthMetric,
  RawRecordsQueryVariables,
} from "@/gql/graphql";
import { useGqlPages, useGqlQuery } from "@/lib/graphql-hooks";

const Coverage = graphql(`
  query Coverage {
    health {
      metrics {
        metric
        unit
        dataOrigin
        count
        firstTime
        lastTime
      }
      recordTypes {
        recordType
        dataOrigin
        count
        projectionErrors
        firstTime
        lastTime
      }
    }
  }
`);

export function useCoverage() {
  return useGqlQuery(Coverage);
}

const QuantitySeries = graphql(`
  query QuantitySeries(
    $metric: HealthMetric!
    $from: DateTime!
    $to: DateTime!
    $bucket: HealthBucket!
    $aggregation: HealthAggregation!
    $dataOrigin: String
    $timeZone: String!
  ) {
    health {
      quantitySeries(
        metric: $metric
        from: $from
        to: $to
        bucket: $bucket
        aggregation: $aggregation
        dataOrigin: $dataOrigin
        timeZone: $timeZone
      ) {
        metric
        unit
        buckets {
          bucketStart
          value
          count
        }
      }
    }
  }
`);

export type SeriesInput = {
  metric: HealthMetric;
  from: string;
  to: string;
  bucket: HealthBucket;
  aggregation: HealthAggregation;
  dataOrigin: string | null;
  timeZone: string;
};

export function useQuantitySeries(input: SeriesInput) {
  return useGqlQuery(QuantitySeries, { variables: input, keepPrevious: true });
}

const QuantitySamples = graphql(`
  query QuantitySamples(
    $metric: HealthMetric!
    $from: DateTime
    $to: DateTime
    $dataOrigin: String
    $after: String
  ) {
    health {
      quantitySamples(
        metric: $metric
        from: $from
        to: $to
        dataOrigin: $dataOrigin
        after: $after
        limit: 50
      ) {
        items {
          id
          startTime
          endTime
          value
          unit
          dataOrigin
          rawRecordId
        }
        nextCursor
      }
    }
  }
`);

export function useQuantitySamples(variables: {
  metric: HealthMetric;
  from: string;
  to: string;
  dataOrigin: string | null;
}) {
  return useGqlPages(QuantitySamples, {
    variables,
    nextCursor: (page) => page.health.quantitySamples.nextCursor,
  });
}

const RawRecords = graphql(`
  query RawRecords(
    $recordType: String
    $from: DateTime
    $to: DateTime
    $dataOrigin: String
    $includeDeleted: Boolean
    $after: String
  ) {
    health {
      rawRecords(
        recordType: $recordType
        from: $from
        to: $to
        dataOrigin: $dataOrigin
        includeDeleted: $includeDeleted
        after: $after
        limit: 50
      ) {
        items {
          id
          recordType
          dataOrigin
          startTime
          endTime
          modifiedAt
          deletedAt
          projectionError
        }
        nextCursor
      }
    }
  }
`);

export function useRawRecords(variables: Omit<RawRecordsQueryVariables, "after">) {
  return useGqlPages(RawRecords, {
    variables,
    nextCursor: (page) => page.health.rawRecords.nextCursor,
  });
}

const RawRecord = graphql(`
  query RawRecord($id: UUID!) {
    health {
      rawRecord(id: $id) {
        id
        clientId
        origin
        recordType
        sourceRecordId
        dataOrigin
        startTime
        endTime
        startZoneOffsetSeconds
        endZoneOffsetSeconds
        modifiedAt
        receivedAt
        deletedAt
        schemaVersion
        projectionError
        payload
        versions {
          id
          operation
          applied
          modifiedAt
          deletedAt
          receivedAt
          schemaVersion
          syncBatchId
          payload
        }
      }
    }
  }
`);

export function useRawRecord(id: string) {
  return useGqlQuery(RawRecord, { variables: { id } });
}

const SleepSessions = graphql(`
  query SleepSessions($from: DateTime, $to: DateTime, $after: String) {
    health {
      sleepSessions(from: $from, to: $to, after: $after, limit: 50) {
        items {
          id
          title
          startTime
          endTime
          dataOrigin
          stages {
            stage
            startTime
            endTime
          }
        }
        nextCursor
      }
    }
  }
`);

export function useSleepSessions(variables: { from: string; to: string }) {
  return useGqlPages(SleepSessions, {
    variables,
    nextCursor: (page) => page.health.sleepSessions.nextCursor,
  });
}

const SleepSession = graphql(`
  query SleepSession($id: UUID!) {
    health {
      sleepSession(id: $id) {
        id
        title
        notes
        startTime
        endTime
        startZoneOffsetSeconds
        dataOrigin
        rawRecordId
        stages {
          stage
          startTime
          endTime
        }
      }
    }
  }
`);

export function useSleepSession(id: string) {
  return useGqlQuery(SleepSession, { variables: { id } });
}

const Workouts = graphql(`
  query Workouts($from: DateTime, $to: DateTime, $after: String) {
    health {
      workouts(from: $from, to: $to, after: $after, limit: 50) {
        items {
          id
          activityType
          title
          startTime
          endTime
          routeStatus
          dataOrigin
        }
        nextCursor
      }
    }
  }
`);

export function useWorkouts(variables: { from: string; to: string }) {
  return useGqlPages(Workouts, {
    variables,
    nextCursor: (page) => page.health.workouts.nextCursor,
  });
}

const Workout = graphql(`
  query Workout($id: UUID!) {
    health {
      workout(id: $id) {
        id
        activityType
        title
        notes
        startTime
        endTime
        routeStatus
        dataOrigin
        rawRecordId
        segments {
          segmentType
          repetitions
          startTime
          endTime
        }
        laps {
          startTime
          endTime
          lengthMeters
        }
        route {
          time
          latitude
          longitude
          altitudeMeters
        }
      }
    }
  }
`);

export function useWorkout(id: string) {
  return useGqlQuery(Workout, { variables: { id } });
}
