import { execFileSync, spawn } from "node:child_process";
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_DIR = resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_URL = process.env.SIMPLE_WORKFLOW_SMOKE_URL ?? "http://localhost:5173";
const PORT = new URL(BASE_URL).port || "5173";
const TIMEOUT_MS = Number(process.env.SIMPLE_WORKFLOW_AGENT_FAILURE_E2E_TIMEOUT_MS ?? 90_000);
const POLL_MS = Number(process.env.SIMPLE_WORKFLOW_AGENT_FAILURE_E2E_POLL_MS ?? 1000);

const STAGE_SWITCHES = {
  executionAdmission: true,
  isolatedWorkspace: true,
  mainAgent: true,
  executionAgent: true,
  reviewAgent: true,
  convergence: true,
};

const SCENARIOS = [
  {
    name: "main initialization non-zero exit",
    failureStage: "main-initialization",
    assert(run) {
      assertFailureRun(run, {
        stage: "main-agent",
        runId: "main-agent:initialization",
        role: "main",
      });
      assertEqual(run.executionAgentRuns?.length ?? 0, 0, "main failure should not enter execution");
    },
  },
  {
    name: "execution non-zero exit",
    failureStage: "execution",
    assert(run) {
      assertFailureRun(run, {
        stage: "execution-agent",
        runId: "execution-agent:001",
        role: "execution",
        errorField: "executionAgentErrors",
      });
      assertEqual(
        run.taskContextPackage?.artifacts?.executionReport?.[0]?.body?.status,
        "failed",
        "execution failure should append a failed executionReport",
      );
      assertEqual(run.reviewAgentRuns?.length ?? 0, 0, "execution failure should not enter review");
    },
  },
  {
    name: "review non-zero exit",
    failureStage: "review",
    assert(run) {
      assertFailureRun(run, {
        stage: "review-agent",
        runId: "review-agent:001",
        role: "review",
        errorField: "reviewAgentErrors",
      });
      assertEqual(
        Boolean(run.taskContextPackage?.artifacts?.reviewReport),
        false,
        "review process failure should not append reviewReport",
      );
      assertEqual(run.convergenceRuns?.length ?? 0, 0, "review process failure should not enter convergence");
    },
  },
  {
    name: "convergence non-zero exit",
    failureStage: "main-convergence",
    assert(run) {
      assertFailureRun(run, {
        stage: "convergence",
        runId: "main-agent:convergence:001",
        role: "main",
        errorField: "convergenceErrors",
      });
      const artifacts = run.taskContextPackage?.artifacts ?? {};
      assertEqual(Boolean(artifacts.convergenceAdvice), false, "convergence process failure should not append advice");
      assertEqual(Boolean(artifacts.convergenceFailure), false, "convergence process failure should not append terminal failure");
      assertEqual(Boolean(run.failureHumanDecisionRequest), false, "convergence process failure should not request human decision");
    },
  },
];

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

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, observed ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(values, expected, message) {
  if (!Array.isArray(values) || !values.includes(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(values)} to include ${JSON.stringify(expected)}`);
  }
}

function findAgentRun(run, runId) {
  return run?.taskContextPackage?.agentRuns?.find((agentRun) => agentRun.runId === runId) ?? null;
}

function errorValues(run, errorField) {
  const value = run?.[errorField];
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function expectedFailureMessage(failureStage) {
  return `forced ${failureStage} failure`;
}

function assertFailureRun(run, {
  stage,
  runId,
  role,
  errorField,
}) {
  const failureMessage = expectedFailureMessage(process.env.SIMPLE_WORKFLOW_FAKE_OPENCODE_FAILURE_STAGE);
  assertEqual(
    run?.status,
    "succeeded",
    `recommendation command should complete while downstream agent fails (${JSON.stringify(compactRunSummary(run))})`,
  );
  assertEqual(run?.taskContextPackage?.currentWorkStage, stage, "run should stop at failed agent stage");
  if (errorField) {
    assertIncludes(errorValues(run, errorField), failureMessage, `${errorField} should include structured failure message`);
  }

  const agentRun = findAgentRun(run, runId);
  if (!agentRun) throw new Error(`missing agentRun ${runId}`);
  assertEqual(agentRun.role, role, `${runId} role`);
  assertEqual(agentRun.status, "failed", `${runId} status`);
  assertEqual(agentRun.failure?.code, "agent.non-zero-exit", `${runId} failure code`);
  assertEqual(agentRun.failure?.kind, "non-zero-exit", `${runId} failure kind`);
  assertEqual(agentRun.failure?.message, failureMessage, `${runId} failure message`);
  assertEqual(agentRun.failure?.exitCode, 42, `${runId} failure exitCode`);
}

function parseConfig(output) {
  const config = {};
  for (const line of output.split(/\r?\n/)) {
    const match = /^(?<key>[^=]+)=(?<value>.+)$/.exec(line);
    if (match) config[match.groups.key] = match.groups.value;
  }
  return config;
}

function killPort() {
  if (process.platform !== "win32") return;
  try {
    execFileSync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      [
        `$listeners = Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue`,
        "if ($listeners) {",
        "  $listeners | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {",
        "    Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue",
        "  }",
        "}",
      ].join("\n"),
    ], { stdio: "ignore" });
  } catch {
    // Best effort cleanup; server readiness below will catch a genuinely occupied port.
  }
}

function killProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      // The scenario may have already ended the child process.
    }
    return;
  }
  child.kill("SIGTERM");
}

async function createFakeOpencode(fakeBinDir) {
  await rm(fakeBinDir, { recursive: true, force: true });
  await mkdir(fakeBinDir, { recursive: true });
  const fakeScriptPath = join(fakeBinDir, "fake-opencode.cjs");
  await writeFile(fakeScriptPath, FAKE_OPENCODE_SOURCE, "utf8");
  await writeFile(
    join(fakeBinDir, "opencode.cmd"),
    `@echo off\r\n"${process.execPath}" "${fakeScriptPath}" %*\r\n`,
    "utf8",
  );
  const posixPath = join(fakeBinDir, "opencode");
  await writeFile(posixPath, `#!/usr/bin/env sh\n"${process.execPath}" "${fakeScriptPath}" "$@"\n`, "utf8");
  await chmod(posixPath, 0o755);
}

async function createScenarioEnvironment() {
  const setupOutput = execFileSync(process.execPath, ["scripts/create-test-environment.js"], {
    cwd: PROJECT_DIR,
    encoding: "utf8",
  });
  const config = parseConfig(setupOutput);
  const fakeBinDir = join(PROJECT_DIR, ".workflow", "test-environment", "fake-opencode-bin");
  await createFakeOpencode(fakeBinDir);
  return { config, fakeBinDir };
}

async function waitForServerReady() {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const { startupCheck } = await requestJson("/api/startup-check");
      if (startupCheck?.canStartWork) return startupCheck;
    } catch {
      // server still booting
    }
    await sleep(POLL_MS);
  }
  throw new Error(`server did not become ready within ${TIMEOUT_MS}ms`);
}

function startServer({ config, fakeBinDir, failureStage }) {
  const env = {
    ...process.env,
    PATH: `${fakeBinDir}${delimiter}${process.env.PATH ?? ""}`,
    SIMPLE_WORKFLOW_REPOSITORY_DIR: config.SIMPLE_WORKFLOW_REPOSITORY_DIR,
    SIMPLE_WORKFLOW_TASKS_DIR: config.SIMPLE_WORKFLOW_TASKS_DIR,
    SIMPLE_WORKFLOW_CONTEXT_STORE_DIR: config.SIMPLE_WORKFLOW_CONTEXT_STORE_DIR,
    SIMPLE_WORKFLOW_FAKE_OPENCODE_FAILURE_STAGE: failureStage,
    PORT,
  };
  return spawn(process.execPath, ["src/server/server.js"], {
    cwd: PROJECT_DIR,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
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

function compactRunSummary(run) {
  return {
    id: run?.id ?? null,
    status: run?.status ?? null,
    stage: run?.taskContextPackage?.currentWorkStage ?? null,
    mainError: run?.mainAgentInitializationError ?? null,
    executionErrors: run?.executionAgentErrors ?? [],
    reviewErrors: run?.reviewAgentErrors ?? [],
    convergenceErrors: run?.convergenceErrors ?? [],
    error: run?.error ?? null,
    stderr: run?.stderr ?? null,
    exitCode: run?.exitCode ?? null,
    agentRuns: run?.taskContextPackage?.agentRuns?.map((agentRun) => ({
      runId: agentRun.runId,
      status: agentRun.status,
      failure: agentRun.failure?.code ?? null,
    })) ?? [],
  };
}

async function waitForRecommendationRun() {
  const deadline = Date.now() + TIMEOUT_MS;
  let latestRun = null;
  while (Date.now() < deadline) {
    latestRun = (await requestJson("/api/recommendation-runs/latest")).recommendationRun;
    if (latestRun?.status && latestRun.status !== "running") return latestRun;
    await sleep(POLL_MS);
  }
  throw new Error(`timed out waiting for recommendation run: ${JSON.stringify(compactRunSummary(latestRun))}`);
}

async function runScenario(scenario) {
  killPort();
  const environment = await createScenarioEnvironment();
  const server = startServer({
    ...environment,
    failureStage: scenario.failureStage,
  });
  const stderr = [];
  server.stderr.on("data", (chunk) => stderr.push(String(chunk)));

  try {
    await waitForServerReady();
    const startedRun = await startWorkflowRun();
    console.log(`started ${startedRun.id}: ${scenario.name}`);
    const completedRun = await waitForRecommendationRun();
    if (process.env.SIMPLE_WORKFLOW_AGENT_FAILURE_E2E_DEBUG) {
      console.log(JSON.stringify(compactRunSummary(completedRun), null, 2));
    }
    process.env.SIMPLE_WORKFLOW_FAKE_OPENCODE_FAILURE_STAGE = scenario.failureStage;
    scenario.assert(completedRun);
    return {
      scenario: scenario.name,
      ...compactRunSummary(completedRun),
    };
  } finally {
    killProcessTree(server);
    await sleep(300);
    if (stderr.length > 0 && process.env.SIMPLE_WORKFLOW_AGENT_FAILURE_E2E_DEBUG) {
      console.error(stderr.join(""));
    }
  }
}

async function main() {
  const results = [];
  for (const scenario of SCENARIOS) {
    results.push(await runScenario(scenario));
  }
  console.log("Agent failure E2E smoke passed");
  console.table(results.map((result) => ({
    scenario: result.scenario,
    stage: result.stage,
    agentRuns: result.agentRuns.length,
  })));
}

const FAKE_OPENCODE_SOURCE = String.raw`
const fs = require("node:fs");
const path = require("node:path");

function readStdin() {
  return fs.readFileSync(0, "utf8");
}

function fencedJson(value) {
  const fence = String.fromCharCode(96, 96, 96);
  return fence + "json\n" + JSON.stringify(value) + "\n" + fence;
}

function emitJsonEvents(text, sessionId) {
  console.log(JSON.stringify({ type: "step_start", part: { type: "step-start" } }));
  console.log(JSON.stringify({ type: "session", sessionId }));
  console.log(JSON.stringify({ type: "text", part: { type: "text", text } }));
  console.log(JSON.stringify({ type: "step_finish", part: { reason: "stop" } }));
}

function roleFromPrompt(prompt) {
  if (prompt.includes("任务推荐器探针")) return "recommendation";
  if (prompt.includes("main agent")) {
    if (prompt.includes('"phase": "convergence"')) return "main-convergence";
    return "main-initialization";
  }
  if (prompt.includes("execution agent")) return "execution";
  if (prompt.includes("review agent")) return "review";
  return "unknown";
}

function selectedPackageId(prompt) {
  const injectedPrompt = prompt.slice(Math.max(prompt.indexOf("系统注入的推荐器输入如下"), 0));
  return /"packageId":\s*"([^"]+)"/.exec(injectedPrompt)?.[1] ?? "task-context-package:tasks/task-001.yaml";
}

function recommendationText(prompt) {
  const packageId = selectedPackageId(prompt);
  return fencedJson({
    appendRequest: {
      packageId,
      artifactType: "executionIntent",
      artifact: {
        recommendedPackageId: packageId,
        confidence: "high",
        selectionReasoning: ["failure e2e selects the first candidate task"],
        candidateComparison: [
          {
            packageId,
            decision: "selected",
            reason: "deterministic failure e2e candidate",
          },
        ],
        executionBrief: {
          goalInterpretation: "Run the deterministic failure e2e workflow.",
          expectedOutcome: ["The requested downstream agent failure is recorded."],
          implementationHints: ["Use the fake opencode command output."],
          riskSignals: [],
          openQuestions: [],
        },
      },
    },
  });
}

function mainText(role) {
  return fencedJson({
    summary: role === "main-convergence"
      ? "fake main convergence completed"
      : "fake main initialization completed",
    nextAction: "continue",
    findings: [],
    ...(role === "main-convergence" ? { convergenceDecision: "success" } : {}),
  });
}

function executionText() {
  const outputDir = path.join(process.cwd(), ".workflow-agent-e2e");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "execution.txt"), "fake execution change\n");
  return fencedJson({
    summary: "fake execution completed",
    tests: [{ command: "fake-opencode", status: "passed" }],
    notes: ["fake execution wrote a deterministic file"],
  });
}

function reviewText() {
  return fencedJson({
    outcome: "passed",
    summary: "fake review passed",
    findings: [],
  });
}

const prompt = readStdin();
const role = roleFromPrompt(prompt);
const failureStage = process.env.SIMPLE_WORKFLOW_FAKE_OPENCODE_FAILURE_STAGE;

if (failureStage === role) {
  process.stderr.write("forced " + failureStage + " failure");
  process.exit(42);
}

const textByRole = {
  recommendation: () => recommendationText(prompt),
  "main-initialization": () => mainText(role),
  "main-convergence": () => mainText(role),
  execution: executionText,
  review: reviewText,
};

emitJsonEvents((textByRole[role] ?? (() => fencedJson({ summary: "unknown fake role" })))(), "fake-opencode-session:" + role);
`;

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
