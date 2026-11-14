import { parseArgs } from "node:util";

import { createDatabase, createDrizzleDb } from "../src/db";
import { env } from "../src/env";
import { reprojectAll } from "../src/health/projection/reproject";

const { values } = parseArgs({
  options: { "record-type": { type: "string" }, user: { type: "string" } },
});

const client = createDatabase(env.DATABASE_URL, 2);
try {
  const started = Date.now();
  const result = await reprojectAll(createDrizzleDb(client), {
    recordType: values["record-type"],
    userId: values.user,
  });
  console.log(
    `Reprojected ${result.records} raw records in ${Date.now() - started} ms; ${result.errors} failed to project.`,
  );
} finally {
  await client.close();
}
