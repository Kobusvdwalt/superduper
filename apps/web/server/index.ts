import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Serves the built SPA. `/api` is routed to the API by the ingress, never here. */
export function createHandler(dist: string): (request: Request) => Response {
  const files = new Map<string, string>();
  for (const path of readdirSync(dist, { recursive: true, encoding: "utf8" })) {
    const absolute = join(dist, path);
    if (statSync(absolute).isFile()) files.set(`/${path.split("\\").join("/")}`, absolute);
  }
  const index = files.get("/index.html");
  if (!index) throw new Error(`${dist} has no index.html; build the app first.`);

  return (request) => {
    const headers = new Headers({ "X-Content-Type-Options": "nosniff" });
    if (request.method !== "GET" && request.method !== "HEAD") {
      headers.set("Allow", "GET, HEAD");
      return new Response("Method Not Allowed", { status: 405, headers });
    }
    const { pathname } = new URL(request.url);
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return new Response("Not Found", { status: 404, headers });
    }
    const file = files.get(pathname);
    if (file) {
      headers.set(
        "Cache-Control",
        pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
      );
      return new Response(Bun.file(file), { headers });
    }
    if (pathname.startsWith("/assets/")) return new Response("Not Found", { status: 404, headers });
    headers.set("Cache-Control", "no-cache");
    headers.set("Content-Type", "text/html; charset=utf-8");
    return new Response(Bun.file(index), { headers });
  };
}

if (import.meta.main) {
  const server = Bun.serve({
    port: Number(process.env.PORT ?? 3000),
    hostname: "0.0.0.0",
    fetch: createHandler(process.env.DIST_DIR ?? join(process.cwd(), "dist")),
  });
  process.stdout.write(`Serving the web app on ${server.url.href}\n`);
  const stop = () => void server.stop().then(() => process.exit(0));
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
