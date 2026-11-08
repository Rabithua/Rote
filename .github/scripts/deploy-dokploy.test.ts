import { expect, test } from "bun:test";
import { deployWithRetry } from "./deploy-dokploy";

const revision = "a".repeat(40);
const previousRevision = "b".repeat(40);
const composeId = "rote-compose";
const apiKey = "fixture-api-key";
const webhookUrl =
  "https://dokploy.example/api/deploy/compose/fixture-webhook-token";
const listPath = "/api/deployment.allByCompose";
const logsPath = "/api/deployment.readLogs";
const runId = "1234";
const runAttempt = "2";
const preDockerFailure = [
  "Initializing deployment",
  "",
  "File 'docker-compose.yml' created: ✅",
  "",
  "Error occurred ❌, check the logs for details.",
  "",
].join("\n");

function title(attempt: number) {
  return `Deploy develop images ${revision} [run ${runId}, attempt ${runAttempt}, deploy ${attempt}]`;
}

function deployment(attempt: number, status = "error") {
  return {
    deploymentId: `deployment-${attempt}`,
    composeId,
    title: title(attempt),
    description: `Hash: ${revision}`,
    status,
    startedAt: "2026-11-08T00:00:00.000Z",
    finishedAt: status === "running" ? null : "2026-11-08T00:00:30.000Z",
  };
}

type FixtureOptions = {
  list?: (poll: number, posts: number) => unknown;
  logs?: () => Response;
  webhook?: (posts: number) => Response;
  isCurrentHead?: () => Promise<boolean>;
  useStatusApi?: boolean;
  statusOrigin?: string;
};

function fixture(options: FixtureOptions = {}) {
  const webhooks: unknown[] = [];
  const logIds: (string | null)[] = [];
  const requests: { url: URL; init?: RequestInit }[] = [];
  const progress: string[] = [];
  let polls = 0;
  const run = () =>
    deployWithRetry({
      webhookUrl,
      revision,
      runId,
      runAttempt,
      statusApi:
        options.useStatusApi === false
          ? undefined
          : {
              apiKey,
              composeId,
              origin: options.statusOrigin ?? new URL(webhookUrl).origin,
            },
      isCurrentHead: options.isCurrentHead ?? (async () => true),
      pollTimeoutMs: 120,
      pollIntervalMs: 1,
      onProgress: (message) => progress.push(message),
      fetch: async (url, init) => {
        requests.push({ url, init });
        if (url.href === webhookUrl && init?.method === "POST") {
          webhooks.push(JSON.parse(String(init.body)).head_commit);
          return (
            options.webhook?.(webhooks.length) ??
            Response.json({ message: "Compose deployed successfully" })
          );
        }
        if (
          url.pathname === listPath &&
          url.searchParams.get("composeId") === composeId
        ) {
          polls++;
          const list = options.list
            ? options.list(polls, webhooks.length)
            : [deployment(1)];
          return list instanceof Response ? list : Response.json(list);
        }
        if (url.pathname === logsPath) {
          logIds.push(url.searchParams.get("deploymentId"));
          return options.logs?.() ?? Response.json(preDockerFailure);
        }
        throw new Error("Unexpected fixture request");
      },
    });
  return { run, webhooks, logIds, requests, progress };
}

test("retries the correlated pre-Docker terminal failure once and uses the same revision", async () => {
  const { run, webhooks, logIds, requests } = fixture({
    list: (poll, posts) => {
      if (posts === 2) return [deployment(2, "done"), deployment(1)];
      return [deployment(1, poll === 1 ? "running" : "error")];
    },
  });

  await run();

  expect(webhooks).toEqual([
    { id: revision, message: title(1) },
    { id: revision, message: title(2) },
  ]);
  expect(logIds).toEqual(["deployment-1"]);
  const secondPostIndex = requests.findLastIndex(
    ({ init }) => init?.method === "POST",
  );
  const logIndex = requests.findIndex(({ url }) => url.pathname === logsPath);
  expect(
    requests
      .slice(logIndex + 1, secondPostIndex)
      .some(({ url }) => url.pathname === listPath),
  ).toBe(true);
  for (const { url, init } of requests) {
    expect(url.origin).toBe(new URL(webhookUrl).origin);
    expect(init?.redirect).toBe("error");
    expect(new Headers(init?.headers).get("x-api-key")).toBe(
      url.href === webhookUrl ? null : apiKey,
    );
  }
});

test("sends only read requests and the read credential to a configured status gateway", async () => {
  const statusOrigin = "https://deployment-status.example";
  const { run, webhooks, requests } = fixture({ statusOrigin });

  await run();

  expect(webhooks).toHaveLength(2);
  for (const { url, init } of requests) {
    const webhook = init?.method === "POST";
    expect(url.origin).toBe(
      webhook ? new URL(webhookUrl).origin : statusOrigin,
    );
    expect(new Headers(init?.headers).get("x-api-key")).toBe(
      webhook ? null : apiKey,
    );
  }
});

test("keeps a second failure to one retry", async () => {
  const { run, webhooks } = fixture({
    list: (_poll, posts) =>
      posts === 2 ? [deployment(2), deployment(1)] : [deployment(1)],
  });

  await run();

  expect(webhooks).toHaveLength(2);
});

test("without deployment status credentials it sends only the original webhook", async () => {
  const { run, webhooks, requests } = fixture({ useStatusApi: false });

  await run();

  expect(webhooks).toHaveLength(1);
  expect(requests).toHaveLength(1);
});

test("skips status access over an insecure origin", async () => {
  const { run, requests } = fixture({ statusOrigin: "http://status.example" });

  await run();

  expect(requests).toHaveLength(1);
  expect(requests[0].init?.method).toBe("POST");
});

test.each([
  ["no matching record", []],
  [
    "a record for the same SHA from another workflow attempt",
    [{ ...deployment(1), title: title(1).replace("attempt 2", "attempt 1") }],
  ],
  [
    "a matching title with a different full hash",
    [{ ...deployment(1), description: `Hash: ${previousRevision}` }],
  ],
  [
    "a matching record for a different Compose",
    [{ ...deployment(1), composeId: "unrelated-compose" }],
  ],
  [
    "duplicate records match this workflow attempt",
    [deployment(1), { ...deployment(1), deploymentId: "duplicate" }],
  ],
  ["a deployment still running", [deployment(1, "running")]],
  ["a completed deployment", [deployment(1, "done")]],
  ["a cancelled deployment", [deployment(1, "cancelled")]],
  ["an unknown deployment status", [deployment(1, "unknown")]],
  ["a newer deployment", [deployment(2, "done"), deployment(1)]],
  ["another running deployment", [deployment(1), deployment(2, "running")]],
  ["a malformed status response", { error: "unexpected" }],
] as const)(
  "leaves final verification to the workflow for %s",
  async (_name, list) => {
    const { run, webhooks, logIds } = fixture({ list: () => list });

    await run();

    expect(webhooks).toHaveLength(1);
    expect(logIds).toHaveLength(0);
  },
);

test.each([
  [
    "a Docker build began",
    preDockerFailure.replace(
      "Error occurred",
      "Build Compose 🐳\nError occurred",
    ),
  ],
  [
    "the log was truncated",
    preDockerFailure.replace("Initializing deployment", ""),
  ],
  [
    "an extra error was recorded",
    preDockerFailure.replace(
      "Error occurred",
      "Invalid compose configuration\nError occurred",
    ),
  ],
  ["the log is empty", ""],
] as const)("does not retry when %s", async (_name, logs) => {
  const { run, webhooks, logIds, progress } = fixture({
    logs: () => Response.json(logs),
  });

  await run();

  expect(webhooks).toHaveLength(1);
  expect(logIds).toEqual(["deployment-1"]);
  expect(progress.join("\n")).not.toContain("Invalid compose configuration");
});

test.each([
  ["status", { list: () => new Response("denied", { status: 403 }) }],
  ["logs", { logs: () => new Response("unavailable", { status: 503 }) }],
] satisfies [string, FixtureOptions][])(
  "does not retry when reading %s fails",
  async (_name, options) => {
    const { run, webhooks } = fixture(options);

    await run();

    expect(webhooks).toHaveLength(1);
  },
);

test("does not retry after the branch advances during deployment", async () => {
  let headIsCurrent = true;
  const { run, webhooks, logIds } = fixture({
    logs: () => {
      headIsCurrent = false;
      return Response.json(preDockerFailure);
    },
    isCurrentHead: async () => headIsCurrent,
  });

  await run();

  expect(webhooks).toHaveLength(1);
  expect(logIds).toEqual(["deployment-1"]);
});

test("does not retry if a competing deployment appears before the second POST", async () => {
  let logsRead = false;
  const { run, webhooks, logIds } = fixture({
    list: () =>
      logsRead ? [deployment(2, "running"), deployment(1)] : [deployment(1)],
    logs: () => {
      logsRead = true;
      return Response.json(preDockerFailure);
    },
  });

  await run();

  expect(webhooks).toHaveLength(1);
  expect(logIds).toEqual(["deployment-1"]);
});

test.each([1, 2])(
  "an ambiguous webhook response on POST %d leaves final verification to the workflow",
  async (ambiguousPost) => {
    const { run, webhooks, progress } = fixture({
      webhook: (posts) => {
        if (posts === ambiguousPost) {
          throw new Error(`Connection ended after sending ${webhookUrl}`);
        }
        return new Response();
      },
    });

    await run();

    expect(webhooks).toHaveLength(ambiguousPost);
    expect(progress.join("\n")).toContain("outcome");
    expect(progress.join("\n")).not.toContain("fixture-webhook-token");
  },
);
