const BASE_URL = process.env.SIMPLE_WORKFLOW_SMOKE_URL ?? "http://localhost:5173";
const TIMEOUT_MS = Number(process.env.SIMPLE_WORKFLOW_AGENT_E2E_TIMEOUT_MS ?? 12 * 60 * 1000);
const POLL_MS = Number(process.env.SIMPLE_WORKFLOW_AGENT_E2E_POLL_MS ?? 5000);
const CLOSEOUT_MODE = process.env.SIMPLE_WORKFLOW_AGENT_E2E_CLOSEOUT ?? "none";

const STAGE_SWITCHES = {
  executionAdmission: true,
  isolatedWorkspace: true,
  mainAgent: true,
  executionAgent: true,
  reviewAgent: true,
  convergence: true,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...(options.headers ?? {}),
    },
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${payload.error ?? ""}`.trim());
  }
  return payload;
}

function compactRunSummary(run) {
  const progress = run?.progress ?? [];
  const lastProgress = progress.at(-1) ?? null;
  return {
    id: run?.id ?? null,
    status: run?.status ?? null,
    mode: run?.mode ?? null,
    packageId: run?.taskContextPackage?.packageId ?? null,
    currentWorkStage: run?.taskContextPackage?.currentWorkStage ?? null,
    progressCount: progress.length,
    lastType: lastProgress?.type ?? null,
    lastStream: lastProgress?.stream ?? null,
    lastMessage: lastProgress?.message ?? null,
    executionRuns: run?.executionAgentRuns?.length ?? 0,
    reviewRuns: run?.reviewAgentRuns?.length ?? 0,
    convergenceRuns: run?.convergenceRuns?.length ?? 0,
    successRequest: Boolean(run?.successHumanDecisionRequest),
    failureRequest: Boolean(run?.failureHumanDecisionRequest),
    error: run?.error ?? null,
  };
}

function progressSignature(summary) {
  return [
    summary.status,
    summary.currentWorkStage,
    summary.progressCount,
    summary.lastType,
    summary.lastStream,
    summary.executionRuns,
    summary.reviewRuns,
    summary.convergenceRuns,
  ].join("|");
}

function assertStartupReady(startupCheck) {
  if (startupCheck?.canStartWork) return;
  const findings = (startupCheck?.findings ?? [])
    .map((finding) => `${finding.code}: ${finding.message}`)
    .join("; ");
  throw new Error(`startup check is not ready${findings ? `: ${findings}` : ""}`);
}

function assertAgentRunReachedHumanDecision(run) {
  const summary = compactRunSummary(run);
  const streams = new Set((run?.progress ?? []).map((entry) => entry.stream).filter(Boolean));
  const missingStreams = [
    "execution-agent",
    "review-agent",
    "main-agent",
  ].filter((stream) => !streams.has(stream));

  if (run?.status !== "succeeded") {
    throw new Error(`expected succeeded run, observed ${run?.status ?? "missing"}: ${run?.error ?? ""}`.trim());
  }
  if (!run.taskContextPackage?.packageId) {
    throw new Error("run did not produce a taskContextPackage");
  }
  if (run.taskContextPackage.currentWorkStage !== "human-decision") {
    throw new Error(`expected human-decision stage, observed ${run.taskContextPackage.currentWorkStage}`);
  }
  if (!run.successHumanDecisionRequest) {
    throw new Error("run did not request a success human decision");
  }
  if (summary.executionRuns < 1 || summary.reviewRuns < 1 || summary.convergenceRuns < 1) {
    throw new Error(`run did not execute all agent roles: ${JSON.stringify(summary)}`);
  }
  if (missingStreams.length > 0) {
    throw new Error(`run progress missed streams: ${missingStreams.join(", ")}`);
  }
}

async function assertServerReady() {
  const response = await fetch(BASE_URL);
  if (!response.ok) {
    throw new Error(`GET / failed: ${response.status}`);
  }
}

async function assertNoActiveRun() {
  const { recommendationRun } = await requestJson("/api/recommendation-runs/latest");
  if (recommendationRun?.status === "running") {
    throw new Error(`recommendation run is already running: ${recommendationRun.id}`);
  }
}

async function startWorkflowRun() {
  const { recommendationRun } = await requestJson("/api/recommendation-runs", {
    method: "POST",
    body: JSON.stringify({
      mode: "workflow",
      stageSwitches: STAGE_SWITCHES,
    }),
  });
  return recommendationRun;
}

async function waitForRecommendationRun() {
  const deadline = Date.now() + TIMEOUT_MS;
  let lastSignature = null;
  let latestRun = null;

  while (Date.now() < deadline) {
    const { recommendationRun } = await requestJson("/api/recommendation-runs/latest");
    latestRun = recommendationRun;
    const summary = compactRunSummary(latestRun);
    const signature = progressSignature(summary);
    if (signature !== lastSignature) {
      console.log(JSON.stringify(summary));
      lastSignature = signature;
    }
    if (latestRun?.status && latestRun.status !== "running") {
      return latestRun;
    }
    await sleep(POLL_MS);
  }

  throw new Error(`timed out after ${TIMEOUT_MS}ms waiting for recommendation run`);
}

async function cancelTask(packageId) {
  const result = await requestJson("/api/human-decisions/cancel-task", {
    method: "POST",
    body: JSON.stringify({ packageId }),
  });
  return result.recommendationRun;
}

async function acceptThenCancelIfRejected(packageId) {
  const accepted = await requestJson("/api/human-decisions/accept-convergence", {
    method: "POST",
    body: JSON.stringify({ packageId }),
  });
  const run = accepted.recommendationRun;
  if (run?.taskContextPackage?.currentWorkStage !== "human-decision") {
    return run;
  }
  if (!run.autoMergePlanning?.appendRequest || run.autoMergePlanning.appendRequest.artifactType !== "autoMergeRejection") {
    return run;
  }
  return cancelTask(packageId);
}

async function closeoutIfRequested(run) {
  if (CLOSEOUT_MODE === "none") return run;
  const packageId = run.taskContextPackage?.packageId;
  if (!packageId) throw new Error("cannot close out run without packageId");
  if (CLOSEOUT_MODE === "cancel") return cancelTask(packageId);
  if (CLOSEOUT_MODE === "accept-cancel") return acceptThenCancelIfRejected(packageId);
  throw new Error(`unsupported SIMPLE_WORKFLOW_AGENT_E2E_CLOSEOUT: ${CLOSEOUT_MODE}`);
}

async function main() {
  await assertServerReady();
  assertStartupReady((await requestJson("/api/startup-check")).startupCheck);
  await assertNoActiveRun();

  const startedRun = await startWorkflowRun();
  console.log(`started ${startedRun.id} at ${BASE_URL}`);

  const completedRun = await waitForRecommendationRun();
  assertAgentRunReachedHumanDecision(completedRun);
  const closedRun = await closeoutIfRequested(completedRun);

  const finalSummary = compactRunSummary(closedRun);
  console.log("Agent E2E smoke passed");
  console.table([{
    run: finalSummary.id,
    package: finalSummary.packageId,
    stage: finalSummary.currentWorkStage,
    execution: finalSummary.executionRuns,
    review: finalSummary.reviewRuns,
    convergence: finalSummary.convergenceRuns,
    closeout: CLOSEOUT_MODE,
  }]);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
