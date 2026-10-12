import assert from "node:assert/strict";

interface DeploymentTarget {
  backendOrigin: string;
  frontendOrigin: string;
  releaseVersion: string;
  revision: string;
}

interface VerificationOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
  requestTimeoutMs?: number;
  onProgress?: (message: string) => void;
}

export async function verifyDeployment(
  target: DeploymentTarget,
  options: VerificationOptions = {},
) {
  assert.match(
    target.revision,
    /^[a-f0-9]{40}$/,
    "Expected a full Git commit SHA",
  );
  assert(target.releaseVersion, "Expected a backend release version");
  const deadline = Date.now() + (options.timeoutMs ?? 300_000);
  let lastFailure = "No successful response";

  async function get(origin: string, path: string) {
    const url = new URL(path, origin);
    url.searchParams.set(
      "deployment-check",
      `${target.revision}-${Date.now()}`,
    );
    const response = await fetch(url, {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(
        Math.max(
          1,
          Math.min(options.requestTimeoutMs ?? 10_000, deadline - Date.now()),
        ),
      ),
    });
    assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
    return response;
  }

  while (Date.now() < deadline) {
    try {
      const status = await (
        await get(target.backendOrigin, "/v2/api/site/status")
      ).json();
      assert.equal(
        status.data?.system?.releaseVersion,
        target.releaseVersion,
        `Backend is still ${status.data?.system?.releaseVersion ?? "unknown"}`,
      );
      assert.equal(
        status.data?.databaseConnected,
        true,
        "Backend database is not connected",
      );

      const index = await get(target.frontendOrigin, "/index.html");
      assert.match(
        index.headers.get("cache-control") ?? "",
        /\bno-store\b/,
        "Frontend HTML must not be cached",
      );
      const html = await index.text();
      const revision = html.match(
        /<meta\s+name="rote-revision"\s+content="([a-f0-9]{40})"\s*\/?\s*>/,
      )?.[1];
      assert.equal(
        revision,
        target.revision,
        `Frontend is still ${revision ?? "an unstamped build"}`,
      );
      const entry = html.match(/src="(\/assets\/[^"\s]+\.js)"/)?.[1];
      assert(entry, "Frontend entry script is missing");
      const script = await get(target.frontendOrigin, entry);
      assert.match(
        script.headers.get("content-type") ?? "",
        /javascript/,
        "Entry script must be JavaScript",
      );
      await script.arrayBuffer();
      const worker = await get(target.frontendOrigin, "/sw.js");
      assert.match(
        worker.headers.get("cache-control") ?? "",
        /\bno-store\b/,
        "Service Worker must not be cached",
      );
      assert(
        (await worker.text()).includes(entry.slice(1)),
        "Service Worker still references a different entry script",
      );
      options.onProgress?.(
        `Deployment verified: backend ${target.releaseVersion}; frontend ${target.revision}`,
      );
      return;
    } catch (error) {
      // Containers switch asynchronously after the webhook. Keep the last concrete
      // failure visible, and fail CI if the expected release never becomes ready.
      lastFailure = error instanceof Error ? error.message : String(error);
      options.onProgress?.(`Waiting for deployment: ${lastFailure}`);
    }
    const remaining = deadline - Date.now();
    if (remaining > 0)
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Math.min(options.pollIntervalMs ?? 15_000, remaining),
        ),
      );
  }
  throw new Error(
    `Deployment did not become ready within ${options.timeoutMs ?? 300_000}ms. Last check: ${lastFailure}`,
  );
}

if (import.meta.main) {
  await verifyDeployment(
    {
      backendOrigin: process.env.ROTE_BACKEND_ORIGIN || "https://api.rote.ink",
      frontendOrigin: process.env.ROTE_FRONTEND_ORIGIN || "https://rote.ink",
      releaseVersion: process.env.ROTE_EXPECTED_RELEASE_VERSION || "",
      revision: process.env.ROTE_EXPECTED_REVISION || "",
    },
    { onProgress: (message) => process.stdout.write(`${message}\n`) },
  );
}
