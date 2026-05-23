import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createWorkflowApiClient,
  WorkflowApiError,
} from "../public/workflow-api-client.js";

function jsonResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => payload,
  };
}

test("workflow API client loads the workflow snapshot from the three source endpoints", async () => {
  const calls = [];
  const client = createWorkflowApiClient({
    fetchImpl: async (path, options = {}) => {
      calls.push({ path, options });
      if (path === "/api/tasks") return jsonResponse({ tasks: [{ fileName: "task-001.yaml" }] });
      if (path === "/api/task-pool") return jsonResponse({ taskPool: { entries: [{ id: "task-001" }] } });
      if (path === "/api/startup-check") return jsonResponse({ startupCheck: { canStartWork: true } });
      throw new Error(`unexpected path: ${path}`);
    },
  });

  const snapshot = await client.loadWorkflowSnapshot();

  assert.deepEqual(snapshot, {
    tasks: [{ fileName: "task-001.yaml" }],
    taskPool: { entries: [{ id: "task-001" }] },
    startupCheck: { canStartWork: true },
  });
  assert.deepEqual(calls.map((call) => call.path), [
    "/api/tasks",
    "/api/task-pool",
    "/api/startup-check",
  ]);
});

test("workflow API client posts action payloads as JSON", async () => {
  const calls = [];
  const client = createWorkflowApiClient({
    fetchImpl: async (path, options = {}) => {
      calls.push({ path, options });
      return jsonResponse({ recommendationRun: { id: "recommendation-run:001" } });
    },
  });

  const payload = await client.continueConvergenceWithGuidance({
    packageId: "task-context-package:tasks/task-001.yaml",
    guidance: "补充边界测试",
    expectedNextOutcome: "下一轮收敛成功",
  });

  assert.equal(payload.recommendationRun.id, "recommendation-run:001");
  assert.equal(calls[0].path, "/api/human-decisions/continue-convergence-with-guidance");
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    packageId: "task-context-package:tasks/task-001.yaml",
    guidance: "补充边界测试",
    expectedNextOutcome: "下一轮收敛成功",
  });
  assert.deepEqual(calls[0].options.headers, {
    "content-type": "application/json",
  });
});

test("workflow API client posts recommendation run mode as JSON", async () => {
  const calls = [];
  const client = createWorkflowApiClient({
    fetchImpl: async (path, options = {}) => {
      calls.push({ path, options });
      return jsonResponse({ recommendationRun: { id: "recommendation-run:001" } });
    },
  });

  await client.startRecommendationRun({ mode: "probe" });

  assert.equal(calls[0].path, "/api/recommendation-runs");
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), { mode: "probe" });
  assert.deepEqual(calls[0].options.headers, {
    "content-type": "application/json",
  });
});

test("workflow API client posts recommendation stage switches as JSON", async () => {
  const calls = [];
  const stageSwitches = {
    executionAdmission: true,
    isolatedWorkspace: false,
    mainAgent: true,
    executionAgent: false,
    reviewAgent: false,
    convergence: false,
  };
  const client = createWorkflowApiClient({
    fetchImpl: async (path, options = {}) => {
      calls.push({ path, options });
      return jsonResponse({ recommendationRun: { id: "recommendation-run:001" } });
    },
  });

  await client.startRecommendationRun({ mode: "workflow", stageSwitches });

  assert.equal(calls[0].path, "/api/recommendation-runs");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    mode: "workflow",
    stageSwitches,
  });
});


test("workflow API client posts terminal session actions as JSON", async () => {
  const calls = [];
  const client = createWorkflowApiClient({
    fetchImpl: async (path, options = {}) => {
      calls.push({ path, options });
      return jsonResponse({ terminalSession: { id: "terminal-session-1" } });
    },
  });

  await client.startTerminalSession({ command: "node", args: ["-i"] });
  await client.writeTerminalSessionInput({
    sessionId: "terminal-session-1",
    input: "1 + 1\n",
  });
  await client.cancelTerminalSession({ sessionId: "terminal-session-1" });

  assert.deepEqual(calls.map((call) => [call.path, JSON.parse(call.options.body)]), [
    ["/api/terminal-sessions", { command: "node", args: ["-i"] }],
    ["/api/terminal-sessions/input", {
      sessionId: "terminal-session-1",
      input: "1 + 1\n",
    }],
    ["/api/terminal-sessions/cancel", { sessionId: "terminal-session-1" }],
  ]);
});

test("workflow API client posts task draft discussion as JSON", async () => {
  const calls = [];
  const client = createWorkflowApiClient({
    fetchImpl: async (path, options = {}) => {
      calls.push({ path, options });
      return jsonResponse({ taskDraft: { assistantMessage: "继续讨论。" } });
    },
  });

  await client.discussTaskSourceDraft({
    mode: "finalize",
    messages: [{ role: "user", content: "敲定" }],
  });

  assert.equal(calls[0].path, "/api/task-draft-assistant");
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    mode: "finalize",
    messages: [{ role: "user", content: "敲定" }],
  });
});

test("workflow API client posts task source draft creation as JSON", async () => {
  const calls = [];
  const client = createWorkflowApiClient({
    fetchImpl: async (path, options = {}) => {
      calls.push({ path, options });
      return jsonResponse({ taskSource: { fileName: "drafted-task.yaml" } });
    },
  });

  await client.createTaskSourceFromDraft({
    taskSourceText: "id: drafted-task\n",
  });

  assert.equal(calls[0].path, "/api/task-draft-assistant/task-source");
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    taskSourceText: "id: drafted-task\n",
  });
});

test("workflow API client preserves error status and payload", async () => {
  const client = createWorkflowApiClient({
    fetchImpl: async () => jsonResponse(
      {
        error: "已有推荐运行正在执行。",
        recommendationRun: { id: "recommendation-run:running" },
      },
      { ok: false, status: 409 },
    ),
  });

  await assert.rejects(
    () => client.startRecommendationRun(),
    (error) => {
      assert.equal(error instanceof WorkflowApiError, true);
      assert.equal(error.status, 409);
      assert.equal(error.message, "已有推荐运行正在执行。");
      assert.equal(error.payload.recommendationRun.id, "recommendation-run:running");
      return true;
    },
  );
});

test("workflow API client probes restart readiness without forcing JSON parsing", async () => {
  const calls = [];
  const response = { ok: true, status: 204 };
  const client = createWorkflowApiClient({
    now: () => 123456,
    fetchImpl: async (path, options = {}) => {
      calls.push({ path, options });
      return response;
    },
  });

  assert.equal(await client.probeStartupCheck(), response);
  assert.equal(calls[0].path, "/api/startup-check?restartProbe=123456");
  assert.deepEqual(calls[0].options, { cache: "no-store" });
});
