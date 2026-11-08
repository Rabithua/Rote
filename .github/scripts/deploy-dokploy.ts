interface StatusApi {
  apiKey: string;
  composeId: string;
  origin: string;
}

interface DeployOptions {
  webhookUrl: string;
  revision: string;
  runId: string;
  runAttempt: string;
  statusApi?: StatusApi;
  isCurrentHead: () => Promise<boolean>;
  fetch?: (input: URL, init?: RequestInit) => Promise<Response>;
  pollTimeoutMs?: number;
  pollIntervalMs?: number;
  onProgress?: (message: string) => void;
}

interface DeploymentRecord {
  deploymentId: string;
  composeId: string;
  title: string;
  description: string | null;
  status: string;
}

const preDockerFailureLog = [
  "Initializing deployment",
  "File 'docker-compose.yml' created: ✅",
  "Error occurred ❌, check the logs for details.",
].join("\n");

function isDeploymentRecord(value: unknown): value is DeploymentRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<DeploymentRecord>;
  return (
    typeof record.deploymentId === "string" &&
    record.deploymentId.length > 0 &&
    typeof record.composeId === "string" &&
    typeof record.title === "string" &&
    (typeof record.description === "string" || record.description === null) &&
    typeof record.status === "string"
  );
}

function isLatestTerminalFailure(
  records: DeploymentRecord[],
  failure: DeploymentRecord,
) {
  return (
    records[0]?.deploymentId === failure.deploymentId &&
    records[0].status === "error" &&
    records.every(({ status }) => status === "done" || status === "error")
  );
}

export async function deployWithRetry({
  webhookUrl,
  revision,
  runId,
  runAttempt,
  statusApi,
  isCurrentHead,
  fetch: request = globalThis.fetch,
  pollTimeoutMs = 90_000,
  pollIntervalMs = 7_500,
  onProgress = () => {},
}: DeployOptions) {
  if (
    !/^[a-f0-9]{40}$/.test(revision) ||
    !/^\d+$/.test(runId) ||
    !/^\d+$/.test(runAttempt)
  ) {
    throw new Error(
      "Expected a full commit SHA and numeric GitHub run identifiers",
    );
  }

  let webhook: URL;
  try {
    webhook = new URL(webhookUrl);
  } catch {
    throw new Error("Dokploy Compose webhook URL is missing or invalid");
  }
  if (webhook.protocol !== "https:" || webhook.username || webhook.password) {
    throw new Error(
      "Dokploy Compose webhook must use HTTPS without URL credentials",
    );
  }

  const title = (attempt: number) =>
    `Deploy develop images ${revision} [run ${runId}, attempt ${runAttempt}, deploy ${attempt}]`;

  async function enqueue(attempt: number) {
    let response: Response;
    try {
      response = await request(webhook, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        headers: {
          "content-type": "application/json",
          "x-github-event": "push",
        },
        body: JSON.stringify({
          head_commit: { id: revision, message: title(attempt) },
        }),
      });
    } catch {
      onProgress(
        `Dokploy webhook outcome for deployment ${attempt} is unknown. Continuing to online version verification.`,
      );
      return false;
    }
    if (!response.ok) {
      throw new Error(
        `Dokploy Compose webhook failed with HTTP ${response.status}`,
      );
    }
    onProgress(
      `Dokploy accepted the Compose webhook for deployment ${attempt}.`,
    );
    return true;
  }

  if (!(await enqueue(1))) return;
  if (!statusApi) {
    onProgress(
      "Dokploy status access is not configured. Automatic retry is disabled.",
    );
    return;
  }

  const { apiKey, composeId } = statusApi;
  const statusOrigin = URL.parse(statusApi.origin);
  if (
    !statusOrigin ||
    statusOrigin.protocol !== "https:" ||
    statusOrigin.username ||
    statusOrigin.password
  ) {
    onProgress(
      "Dokploy status access must use HTTPS without URL credentials. Skipping automatic retry.",
    );
    return;
  }
  const listUrl = new URL("/api/deployment.allByCompose", statusOrigin.origin);
  listUrl.searchParams.set("composeId", composeId);

  async function read(url: URL, timeoutMs = 10_000): Promise<unknown> {
    const response = await request(url, {
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "x-api-key": apiKey },
    });
    if (!response.ok) throw new Error("Dokploy status API returned an error");
    return response.json();
  }

  async function list(timeoutMs?: number): Promise<DeploymentRecord[]> {
    const records = await read(listUrl, timeoutMs);
    if (
      !Array.isArray(records) ||
      !records.every(
        (record) =>
          isDeploymentRecord(record) && record.composeId === composeId,
      )
    ) {
      throw new Error("Unexpected Dokploy deployment list");
    }
    return records;
  }

  const matchesFirstAttempt = (record: DeploymentRecord) =>
    record.title === title(1) && record.description === `Hash: ${revision}`;

  let failure: DeploymentRecord | undefined;
  const deadline = Date.now() + pollTimeoutMs;
  try {
    while (Date.now() < deadline) {
      const records = await list(
        Math.min(10_000, Math.max(1, deadline - Date.now())),
      );
      const matches = records.filter(matchesFirstAttempt);
      const deployment = matches[0];

      if (matches.length > 1) {
        onProgress(
          "Multiple Dokploy records match this attempt. Skipping automatic retry.",
        );
        return;
      }
      if (deployment?.status === "done") return;
      if (deployment?.status === "error") {
        if (!isLatestTerminalFailure(records, deployment)) {
          onProgress(
            "A newer or unfinished Dokploy deployment exists. Skipping automatic retry.",
          );
          return;
        }
        failure = deployment;
        break;
      }
      if (
        deployment &&
        !["running", "queued", "pending"].includes(deployment.status)
      ) {
        onProgress(
          "Dokploy returned an unrecognized deployment status. Skipping automatic retry.",
        );
        return;
      }

      const remaining = deadline - Date.now();
      if (remaining > 0) await Bun.sleep(Math.min(pollIntervalMs, remaining));
    }
    if (!failure) {
      onProgress(
        "No failed Dokploy record was confirmed before the deadline. Skipping automatic retry.",
      );
      return;
    }

    // The current Dokploy version suppresses SSH ExecError details in deployment logs.
    // Require the full known failure sequence. Additional output or a missing marker is inconclusive.
    const logUrl = new URL("/api/deployment.readLogs", statusOrigin.origin);
    logUrl.searchParams.set("deploymentId", failure.deploymentId);
    logUrl.searchParams.set("tail", "100");
    const log = await read(logUrl);
    const lines =
      typeof log === "string"
        ? log
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .join("\n")
        : null;
    if (lines !== preDockerFailureLog) {
      onProgress(
        "Dokploy logs do not confirm a failure before Docker started. Skipping automatic retry.",
      );
      return;
    }

    const [headIsCurrent, latest] = await Promise.all([
      isCurrentHead(),
      list(),
    ]);
    if (!headIsCurrent) {
      onProgress(
        "The revision is no longer the develop head. Skipping automatic retry.",
      );
      return;
    }
    if (
      latest.filter(matchesFirstAttempt).length !== 1 ||
      !isLatestTerminalFailure(latest, failure)
    ) {
      onProgress("Dokploy deployment state changed. Skipping automatic retry.");
      return;
    }
  } catch {
    // Do not expose request URLs, keys, or deployment logs. The public version check still runs.
    onProgress(
      "Could not confirm a safe Dokploy retry. Continuing to online version verification.",
    );
    return;
  }

  onProgress(
    "Dokploy failed before Docker started. Retrying once with the existing images.",
  );
  await enqueue(2);
}

if (import.meta.main) {
  const revision = Bun.env.GITHUB_SHA ?? "";
  const apiKey = Bun.env.DOKPLOY_STATUS_API_KEY;
  const composeId = Bun.env.DOKPLOY_COMPOSE_ID;
  const origin = Bun.env.DOKPLOY_STATUS_API_ORIGIN;
  await deployWithRetry({
    webhookUrl: Bun.env.DOKPLOY_COMPOSE_WEBHOOK_URL ?? "",
    revision,
    runId: Bun.env.GITHUB_RUN_ID ?? "",
    runAttempt: Bun.env.GITHUB_RUN_ATTEMPT ?? "",
    statusApi:
      apiKey && composeId && origin ? { apiKey, composeId, origin } : undefined,
    isCurrentHead: async () => {
      const git = Bun.spawn(
        ["git", "ls-remote", "--exit-code", "origin", "refs/heads/develop"],
        {
          stdout: "pipe",
          stderr: "ignore",
          signal: AbortSignal.timeout(10_000),
        },
      );
      const [ref, exitCode] = await Promise.all([
        git.stdout.text(),
        git.exited,
      ]);
      return exitCode === 0 && ref.trim() === `${revision}\trefs/heads/develop`;
    },
    onProgress: console.log,
  });
}
