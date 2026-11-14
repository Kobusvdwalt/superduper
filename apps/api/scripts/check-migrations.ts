import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), "superduper-migrations-"));

try {
  cpSync(join(root, "drizzle"), scratch, { recursive: true });
  const before = readdirSync(scratch).length;
  const result = Bun.spawnSync(
    [
      "bunx",
      "--bun",
      "drizzle-kit",
      "generate",
      "--dialect=postgresql",
      "--schema=./src/db/schema/index.ts",
      `--out=${scratch}`,
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  if (result.exitCode !== 0) {
    console.error(result.stderr.toString() || result.stdout.toString());
    process.exit(1);
  }
  if (readdirSync(scratch).length !== before) {
    console.error("The schema has changes without a migration; run `bun run db:generate`.");
    process.exit(1);
  }
  console.log("Migrations match the schema");
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
