import { afterEach, expect, test } from "bun:test";
import { verifyDeployment } from "./verify-deployment";

const revision = "a".repeat(40);
const previous = "b".repeat(40);
const servers: ReturnType<typeof Bun.serve>[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true);
});

function fixture(overrides: Record<string, () => Response> = {}) {
  const routes: Record<string, () => Response> = {
    "/v2/api/site/status": () =>
      Response.json({
        data: { databaseConnected: true, system: { releaseVersion: "v2.6.0" } },
      }),
    "/index.html": () =>
      new Response(
        `<meta name="rote-revision" content="${revision}"><script type="module" src="/assets/index-new.js"></script>`,
        { headers: { "cache-control": "no-store" } },
      ),
    "/assets/index-new.js": () =>
      new Response("export {}", {
        headers: { "content-type": "application/javascript" },
      }),
    "/sw.js": () =>
      new Response('precache("assets/index-new.js")', {
        headers: { "cache-control": "no-store" },
      }),
    ...overrides,
  };
  const server = Bun.serve({
    port: 0,
    fetch: (request) =>
      routes[new URL(request.url).pathname]?.() ??
      new Response("missing", { status: 404 }),
  });
  servers.push(server);
  return {
    backendOrigin: server.url.toString(),
    frontendOrigin: server.url.toString(),
    releaseVersion: "v2.6.0",
    revision,
  };
}

const fast = { timeoutMs: 250, pollIntervalMs: 5, requestTimeoutMs: 100 };

test("accepts matching healthy backend, frontend, asset and worker", async () => {
  await expect(verifyDeployment(fixture(), fast)).resolves.toBeUndefined();
});

test("waits through a rolling restart before succeeding", async () => {
  let calls = 0;
  const target = fixture({
    "/v2/api/site/status": () =>
      ++calls === 1
        ? new Response("restarting", { status: 503 })
        : Response.json({
            data: {
              databaseConnected: true,
              system: { releaseVersion: "v2.6.0" },
            },
          }),
  });
  await verifyDeployment(target, fast);
  expect(calls).toBe(2);
});

test.each([
  [
    "old backend",
    "/v2/api/site/status",
    () =>
      Response.json({
        data: { databaseConnected: true, system: { releaseVersion: "v2.5.2" } },
      }),
    "Backend is still v2.5.2",
  ],
  [
    "unhealthy database",
    "/v2/api/site/status",
    () =>
      Response.json({
        data: {
          databaseConnected: false,
          system: { releaseVersion: "v2.6.0" },
        },
      }),
    "database is not connected",
  ],
  [
    "old frontend",
    "/index.html",
    () =>
      new Response(`<meta name="rote-revision" content="${previous}">`, {
        headers: { "cache-control": "no-store" },
      }),
    "Frontend is still",
  ],
  [
    "missing asset",
    "/assets/index-new.js",
    () => new Response("missing", { status: 404 }),
    "HTTP 404",
  ],
  [
    "HTML fallback asset",
    "/assets/index-new.js",
    () => new Response("<html>", { headers: { "content-type": "text/html" } }),
    "must be JavaScript",
  ],
  [
    "old worker",
    "/sw.js",
    () =>
      new Response('precache("assets/index-old.js")', {
        headers: { "cache-control": "no-store" },
      }),
    "different entry script",
  ],
] as const)(
  "fails within the deadline for %s",
  async (_name, path, response, message) => {
    await expect(
      verifyDeployment(fixture({ [path]: response }), fast),
    ).rejects.toThrow(message);
  },
);

test("times out a hanging status request", async () => {
  const server = Bun.serve({
    port: 0,
    fetch: () => new Promise<Response>(() => {}),
  });
  servers.push(server);
  await expect(
    verifyDeployment(
      {
        backendOrigin: server.url.toString(),
        frontendOrigin: server.url.toString(),
        releaseVersion: "v2.6.0",
        revision,
      },
      fast,
    ),
  ).rejects.toThrow("did not become ready");
});
