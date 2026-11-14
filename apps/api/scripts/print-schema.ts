import { lexicographicSortSchema, printSchema } from "graphql";

import { schema } from "../src/graphql/schema";

const path = new URL("../schema.graphql", import.meta.url).pathname;
const sdl = `${printSchema(lexicographicSortSchema(schema))}\n`;

if (process.argv.includes("--check")) {
  const current = await Bun.file(path)
    .text()
    .catch(() => "");
  if (current !== sdl) {
    console.error("schema.graphql is stale; run `bun run schema` and commit the result.");
    process.exit(1);
  }
  console.log("schema.graphql is up to date");
} else {
  await Bun.write(path, sdl);
  console.log(`Wrote ${path}`);
}
