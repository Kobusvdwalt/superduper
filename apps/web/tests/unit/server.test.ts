import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GlobalRegistrator } from "@happy-dom/global-registrator";

import { createHandler } from "../../server/index";

describe("static server", () => {
  let dist: string;
  let handle: (request: Request) => Response;

  beforeAll(async () => {
    // Happy DOM replaces the global Response with one that cannot stream a Bun.file.
    await GlobalRegistrator.unregister();
    dist = mkdtempSync(join(tmpdir(), "superduper-web-"));
    mkdirSync(join(dist, "assets"));
    writeFileSync(join(dist, "index.html"), "<html>app</html>");
    writeFileSync(join(dist, "assets", "main-abc.js"), "console.log(1)");
    writeFileSync(join(dist, "favicon.svg"), "<svg/>");
    handle = createHandler(dist);
  });

  afterAll(() => {
    rmSync(dist, { recursive: true, force: true });
    GlobalRegistrator.register({ width: 1280, height: 800, url: "http://localhost:4401/" });
  });

  const get = (path: string, method = "GET") =>
    handle(new Request(`http://localhost${path}`, { method }));

  test("serves hashed assets as immutable", async () => {
    const response = get("/assets/main-abc.js");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(await response.text()).toBe("console.log(1)");
  });

  test("serves other files without long caching", () => {
    expect(get("/favicon.svg").headers.get("cache-control")).toBe("no-cache");
  });

  test("answers app routes with index.html", async () => {
    for (const path of ["/", "/health/sleep", "/settings/clients?x=1"]) {
      const response = get(path);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(await response.text()).toBe("<html>app</html>");
    }
  });

  test("missing assets and /api are 404, other methods 405", () => {
    expect(get("/assets/gone.js").status).toBe(404);
    expect(get("/api/graphql").status).toBe(404);
    expect(get("/api").status).toBe(404);
    expect(get("/", "POST").status).toBe(405);
  });

  test("refuses to start without a build", () => {
    const empty = mkdtempSync(join(tmpdir(), "superduper-web-empty-"));
    expect(() => createHandler(empty)).toThrow("no index.html");
    rmSync(empty, { recursive: true, force: true });
  });
});
