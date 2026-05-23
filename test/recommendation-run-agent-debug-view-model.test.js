import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRecommendationRunAgentDebugViewModel } from "../public/recommendation-run-agent-debug-view-model.js";
import { createAgentRunFixture } from "./support/task-context-package-fixtures.js";

test("agent debug view model groups live progress by agent run", () => {
  const viewModel = buildRecommendationRunAgentDebugViewModel({
    status: "running",
    progress: [
      {
        type: "execution_process_start",
        stream: "execution-agent",
        message: "启动 execution-agent:001：opencode run --format json",
        terminalLine: "$ opencode run --format json\ncwd: D:\\repo\\.workflow\\worktrees\\tasks\\task-001\nrunId: execution-agent:001\npid: 4312",
        timestamp: "2026-05-23T10:00:00.000Z",
      },
      {
        type: "execution_stdout",
        stream: "execution-stdout",
        message: "execution-agent:001 stdout 20 chars",
        terminalLine: "{\"type\":\"text\"}",
        timestamp: "2026-05-23T10:00:01.000Z",
      },
      {
        type: "execution_heartbeat",
        stream: "execution-agent",
        message: "execution-agent:001 仍在运行，10s 无新输出",
        timestamp: "2026-05-23T10:00:11.000Z",
      },
      {
        type: "execution_process_close",
        stream: "execution-agent",
        message: "execution-agent:001 退出：0",
        terminalLine: "execution-agent:001: exited with code 0",
        timestamp: "2026-05-23T10:00:12.000Z",
      },
    ],
  });

  assert.equal(viewModel.statusText, "1 个 agent run · running 0 · done 1 · failed 0");
  assert.equal(viewModel.runs.length, 1);
  assert.equal(viewModel.runs[0].runId, "execution-agent:001");
  assert.equal(viewModel.runs[0].roleLabel, "execution");
  assert.equal(viewModel.runs[0].status, "exited");
  assert.equal(viewModel.runs[0].pid, "4312");
  assert.equal(viewModel.runs[0].cwd, "D:\\repo\\.workflow\\worktrees\\tasks\\task-001");
  assert.equal(viewModel.runs[0].exitCode, 0);
  assert.deepEqual(viewModel.runs[0].counts, {
    events: 4,
    stdout: 1,
    stderr: 0,
    heartbeats: 1,
  });
});

test("agent debug view model merges final agent run metadata", () => {
  const viewModel = buildRecommendationRunAgentDebugViewModel({
    status: "succeeded",
    progress: [
      {
        type: "review_process_start",
        stream: "review-agent",
        message: "启动 review-agent:001：opencode run --format json",
        terminalLine: "$ opencode run --format json\ncwd: D:\\repo\\.workflow\\worktrees\\tasks\\task-001\nrunId: review-agent:001\npid: 9912",
        timestamp: "2026-05-23T10:00:00.000Z",
      },
    ],
    taskContextPackage: {
      agentRuns: [
        {
          runId: "review-agent:001",
          role: "review",
          sessionId: "ses_review_001",
          status: "succeeded",
          startedAt: "2026-05-23T10:00:00.000Z",
          finishedAt: "2026-05-23T10:00:30.000Z",
          inputArtifactRefs: ["executionReport:001"],
          outputArtifactRefs: ["reviewReport:001"],
        },
      ],
    },
  });

  assert.equal(viewModel.runs[0].status, "succeeded");
  assert.equal(viewModel.runs[0].sessionId, "ses_review_001");
  assert.deepEqual(viewModel.runs[0].inputArtifactRefs, ["executionReport:001"]);
  assert.deepEqual(viewModel.runs[0].outputArtifactRefs, ["reviewReport:001"]);
});

test("agent debug view model returns empty state without a run", () => {
  const viewModel = buildRecommendationRunAgentDebugViewModel(null);

  assert.equal(viewModel.statusText, "未运行");
  assert.deepEqual(viewModel.runs, []);
});

test("agent debug view model reads finalized package agent runs", () => {
  const viewModel = buildRecommendationRunAgentDebugViewModel(null, {
    taskContextPackage: {
      agentRuns: [
        createAgentRunFixture({
          runId: "main-agent:initialization",
          sessionId: "ses_main_001",
        }),
      ],
    },
  });

  assert.equal(viewModel.statusText, "1 个 agent run · running 0 · done 1 · failed 0");
  assert.equal(viewModel.runs[0].runId, "main-agent:initialization");
  assert.equal(viewModel.runs[0].sessionId, "ses_main_001");
});
