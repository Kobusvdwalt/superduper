import { readdirSync } from "node:fs";
import { join } from "node:path";

import { env, requireEnv } from "../src/env";

const FIXTURES_DIR = new URL("../../../contracts/health-connect/v1/", import.meta.url).pathname;
const CLIENT_NAME = "Dev seed";
const DAYS = 28;
const BATCH_SIZE = 100;
const ZONE_OFFSET_SECONDS = 7200;
const PHONE = "com.example.phone";
const WATCH = "com.example.watch";

type RecordInput = {
  origin: "HEALTH_CONNECT";
  recordType: string;
  sourceRecordId: string;
  dataOrigin: string;
  startTime: string;
  endTime: string | null;
  startZoneOffsetSeconds: number;
  endZoneOffsetSeconds: number | null;
  modifiedAt: string;
  payload: Record<string, unknown>;
};

const { OWNER_EMAIL, OWNER_PASSWORD } = requireEnv(["OWNER_EMAIL", "OWNER_PASSWORD"]);
const base = env.SEED_API_URL;

let cookie = "";

async function auth(path: string, body: Record<string, string>) {
  const response = await fetch(new URL(`/api/auth/${path}`, base), {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify(body),
  });
  if (response.ok) {
    cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
  }
  return response;
}

async function graphql<T>(query: string, variables: Record<string, unknown>, token?: string) {
  const response = await fetch(new URL("/api/graphql", base), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : { Cookie: cookie }),
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length || !body.data) {
    throw new Error(`GraphQL failed: ${JSON.stringify(body.errors)}`);
  }
  return body.data;
}

/** Deterministic, so every seeded database charts the same. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function metadata(id: string, dataOrigin: string, modifiedAt: string, deviceType: number) {
  return {
    id,
    dataOrigin,
    lastModifiedTime: modifiedAt,
    clientRecordId: null,
    clientRecordVersion: 0,
    recordingMethod: 2,
    recordingMethodName: "AUTOMATICALLY_RECORDED",
    device: {
      manufacturer: "Example",
      model: deviceType === 1 ? "Watch 1" : "Phone 1",
      type: deviceType,
      typeName: deviceType === 1 ? "WATCH" : "PHONE",
    },
  };
}

function interval(
  recordType: string,
  id: string,
  dataOrigin: string,
  start: Date,
  end: Date,
  fields: Record<string, unknown>,
): RecordInput {
  const startTime = start.toISOString();
  const endTime = end.toISOString();
  return {
    origin: "HEALTH_CONNECT",
    recordType,
    sourceRecordId: id,
    dataOrigin,
    startTime,
    endTime,
    startZoneOffsetSeconds: ZONE_OFFSET_SECONDS,
    endZoneOffsetSeconds: ZONE_OFFSET_SECONDS,
    modifiedAt: endTime,
    payload: {
      startTime,
      startZoneOffsetSeconds: ZONE_OFFSET_SECONDS,
      endTime,
      endZoneOffsetSeconds: ZONE_OFFSET_SECONDS,
      ...fields,
      metadata: metadata(id, dataOrigin, endTime, dataOrigin === WATCH ? 1 : 2),
    },
  };
}

const HOUR = 3_600_000;
const MINUTE = 60_000;
const SLEEP_STAGES = [
  [1, "AWAKE"],
  [4, "LIGHT"],
  [5, "DEEP"],
  [6, "REM"],
] as const;

function syntheticRecords(): RecordInput[] {
  const next = random(7);
  const records: RecordInput[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let day = DAYS; day >= 1; day -= 1) {
    const midnight = new Date(today.getTime() - day * 24 * HOUR);

    for (let hour = 4; hour < 21; hour += 1) {
      const start = new Date(midnight.getTime() + hour * HOUR);
      const end = new Date(start.getTime() + HOUR);
      const active = hour >= 5 && hour <= 7 ? 2500 : 400;
      records.push(
        interval("StepsRecord", `seed-steps-${start.toISOString()}`, PHONE, start, end, {
          count: Math.round(active + next() * active),
        }),
      );
    }

    for (let hour = 0; hour < 24; hour += 1) {
      const start = new Date(midnight.getTime() + hour * HOUR);
      const end = new Date(start.getTime() + HOUR);
      const resting = hour < 4 || hour >= 21 ? 52 : 68;
      const samples = Array.from({ length: 12 }, (_, index) => ({
        time: new Date(start.getTime() + index * 5 * MINUTE).toISOString(),
        beatsPerMinute: Math.round(resting + next() * 25),
      }));
      records.push(
        interval("HeartRateRecord", `seed-hr-${start.toISOString()}`, WATCH, start, end, {
          samples,
        }),
      );
    }

    const sleepStart = new Date(midnight.getTime() + 21 * HOUR + Math.round(next() * 60) * MINUTE);
    const stages: Record<string, unknown>[] = [];
    let cursor = sleepStart.getTime();
    const sleepEnd = cursor + (6.5 + next() * 1.5) * HOUR;
    while (cursor < sleepEnd) {
      const [stage, stageName] = SLEEP_STAGES[Math.floor(next() * SLEEP_STAGES.length)] ?? [
        4,
        "LIGHT",
      ];
      const length = Math.min((15 + Math.round(next() * 45)) * MINUTE, sleepEnd - cursor);
      stages.push({
        startTime: new Date(cursor).toISOString(),
        endTime: new Date(cursor + length).toISOString(),
        stage,
        stageName,
      });
      cursor += length;
    }
    records.push(
      interval(
        "SleepSessionRecord",
        `seed-sleep-${sleepStart.toISOString()}`,
        WATCH,
        sleepStart,
        new Date(sleepEnd),
        { title: null, notes: null, stages },
      ),
    );
  }
  return records;
}

async function loadFixtures(): Promise<RecordInput[]> {
  const files = readdirSync(FIXTURES_DIR).filter((file) => file.endsWith(".json"));
  return Promise.all(files.sort().map((file) => Bun.file(join(FIXTURES_DIR, file)).json()));
}

const SYNC = `mutation($input: HealthSyncInput!) {
  health { sync(input: $input) { batchId replayed acceptedRecords acceptedDeletions } }
}`;

type SyncResult = { health: { sync: { replayed: boolean; acceptedRecords: number } } };

async function push(token: string, records: RecordInput[], batchId = crypto.randomUUID()) {
  const input = { batchId, schemaVersion: 1, records, deletions: [] };
  const data = await graphql<SyncResult>(SYNC, { input }, token);
  return { input, result: data.health.sync };
}

let signIn = await auth("sign-in/email", { email: OWNER_EMAIL, password: OWNER_PASSWORD });
if (!signIn.ok) {
  const signUp = await auth("sign-up/email", {
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    name: "Owner",
  });
  if (!signUp.ok) throw new Error(`Sign-up failed: ${await signUp.text()}`);
  signIn = signUp;
  console.log(`Created owner ${OWNER_EMAIL}`);
}

const existing = await graphql<{
  identity: { clients: { name: string; revokedAt: string | null }[] };
}>("{ identity { clients { name revokedAt } } }", {});
if (existing.identity.clients.some((c) => c.name === CLIENT_NAME && !c.revokedAt)) {
  console.log(`A "${CLIENT_NAME}" client already exists; this database is already seeded.`);
  process.exit(0);
}

const created = await graphql<{ identity: { createClient: { token: string } } }>(
  `
    mutation ($input: CreateClientInput!) {
      identity {
        createClient(input: $input) {
          token
        }
      }
    }
  `,
  { input: { name: CLIENT_NAME, kind: "DEVICE", platform: "android" } },
);
const { token } = created.identity.createClient;

const fixtures = await push(token, await loadFixtures());
const replay = await push(token, fixtures.input.records, fixtures.input.batchId);
if (!replay.result.replayed) throw new Error("Replaying the fixture batch was not idempotent.");

const synthetic = syntheticRecords();
for (let at = 0; at < synthetic.length; at += BATCH_SIZE) {
  await push(token, synthetic.slice(at, at + BATCH_SIZE));
}

console.log(
  `Seeded ${fixtures.result.acceptedRecords} fixtures and ${synthetic.length} synthetic records over ${DAYS} days.`,
);
console.log(`Client token (local only): ${token}`);
