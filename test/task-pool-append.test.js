import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyAppendRequest,
  buildTaskPool,
  findTaskContextPackage,
} from "../src/workflow/task-pool.js";
import { createTask003Source } from "./support/task-pool-fixtures.js";

function createTask003Pool() {
  return buildTaskPool([createTask003Source()]);
}

test("task pool applies append requests to the target task context package", () => {
  const withIntent = applyAppendRequest(
    createTask003Pool(),
    {
      packageId: "task-context-package:tasks/task-003.yaml",
      artifactType: "executionIntent",
      artifact: {
        recommendedPackageId: "task-context-package:tasks/task-003.yaml",
        confidence: "high",
      },
    },
    { currentWorkStage: "task-recommender" },
  );

  const taskPackage = findTaskContextPackage(
    withIntent,
    "task-context-package:tasks/task-003.yaml",
  );

  assert.equal(taskPackage.currentWorkStage, "task-recommender");
  assert.equal(taskPackage.artifacts.executionIntent.artifactId, "executionIntent");
  assert.equal(taskPackage.artifacts.executionIntent.body.confidence, "high");
  assert.equal(taskPackage.timeline[0].artifactType, "executionIntent");
  assert.equal(taskPackage.timeline[0].artifactId, "executionIntent");
});

test("task pool records agent runs and generated multi artifact refs", () => {
  const withReport = applyAppendRequest(
    createTask003Pool(),
    {
      packageId: "task-context-package:tasks/task-003.yaml",
      artifactType: "executionReport",
      artifact: {
        summary: "完成监听实现",
      },
      agentRun: {
        runId: "execution-agent:001",
        role: "execution",
        sessionId: "opencode-session-execution-002",
        inputArtifactRefs: ["taskDraft", "executionAuthorization"],
        outputArtifactRefs: [],
        status: "succeeded",
        startedAt: "2026-05-18T10:00:00.000Z",
        finishedAt: "2026-05-18T10:10:00.000Z",
      },
    },
    { currentWorkStage: "execution-agent" },
  );

  const taskPackage = findTaskContextPackage(
    withReport,
    "task-context-package:tasks/task-003.yaml",
  );

  assert.equal(taskPackage.currentWorkStage, "execution-agent");
  assert.equal(taskPackage.artifacts.executionReport[0].artifactId, "executionReport:001");
  assert.equal(taskPackage.artifacts.executionReport[0].body.summary, "完成监听实现");
  assert.equal(taskPackage.agentRuns[0].sessionId, "opencode-session-execution-002");
  assert.deepEqual(taskPackage.agentRuns[0].outputArtifactRefs, ["executionReport:001"]);
  assert.equal(taskPackage.timeline[0].agentRunId, "execution-agent:001");
});

test("task pool records a main agent run without requiring an artifact", () => {
  const withMainRun = applyAppendRequest(
    createTask003Pool(),
    {
      packageId: "task-context-package:tasks/task-003.yaml",
      agentRun: {
        runId: "main-agent:initialization",
        role: "main",
        sessionId: "opencode-session-main-task-003",
        inputArtifactRefs: ["taskDraft", "executionIntent", "executionAuthorization"],
        outputArtifactRefs: [],
        status: "succeeded",
        startedAt: "2026-05-18T10:00:00.000Z",
        finishedAt: "2026-05-18T10:00:10.000Z",
      },
    },
    { currentWorkStage: "main-agent" },
  );

  const taskPackage = findTaskContextPackage(
    withMainRun,
    "task-context-package:tasks/task-003.yaml",
  );

  assert.equal(taskPackage.currentWorkStage, "main-agent");
  assert.deepEqual(taskPackage.artifacts, {});
  assert.equal(taskPackage.agentRuns[0].role, "main");
  assert.deepEqual(taskPackage.agentRuns[0].outputArtifactRefs, []);
  assert.equal(taskPackage.timeline[0].artifactId, null);
  assert.equal(taskPackage.timeline[0].agentRunId, "main-agent:initialization");
});
