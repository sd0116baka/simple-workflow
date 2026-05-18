import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  completeRecommendationFlow,
  startRecommendationFlow,
} from "../src/workflow/recommendation-flow.js";

function taskSource() {
  return [
    {
      id: "task-001",
      fileName: "task-001.yaml",
      parsed: {
        id: "task-001",
        title: "展示任务真源",
        type: "feature",
        priority: "normal",
        description: "展示任务",
        acceptance: ["可以看到任务"],
      },
      parseError: null,
      validation: { status: "valid", errors: [] },
    },
  ];
}

const startupCheck = {
  canStartWork: true,
  findings: [],
  runtimeSnapshot: {
    activeWork: null,
    worktree: {
      clean: true,
      changedFiles: [],
    },
  },
};

function commandResult() {
  return {
    stdout: JSON.stringify({
      appendRequest: {
        packageId: "task-context-package:tasks/task-001.yaml",
        artifactType: "executionIntent",
        artifact: {
          recommendedPackageId: "task-context-package:tasks/task-001.yaml",
          confidence: "high",
          selectionReasoning: ["任务可执行"],
          candidateComparison: [
            {
              packageId: "task-context-package:tasks/task-001.yaml",
              decision: "selected",
              reason: "当前最适合执行",
            },
          ],
          executionBrief: {
            goalInterpretation: "展示任务真源",
            expectedOutcome: ["可以看到任务"],
            implementationHints: ["基于任务描述推进"],
            riskSignals: [],
            openQuestions: [],
          },
        },
      },
    }),
    stderr: "",
    exitCode: 0,
    error: null,
  };
}

test("recommendation flow starts a running run with injected candidate tasks", async () => {
  const dir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "flow-prompt");
  await mkdir(dir, { recursive: true });
  const promptPath = join(dir, "recommender-agent.prompt.md");
  await writeFile(promptPath, "推荐一个任务。");

  const { run } = await startRecommendationFlow({
    id: "recommendation-run-flow",
    tasks: taskSource(),
    startupCheck,
    recommendationPromptPath: promptPath,
    now: () => "2026-05-18T10:00:00.000Z",
  });

  assert.equal(run.status, "running");
  assert.match(run.prompt, /candidateTasks/);
  assert.match(run.prompt, /task-001/);
});

test("recommendation flow applies module append requests through the task pool", () => {
  const completed = completeRecommendationFlow({
    run: {
      id: "recommendation-run-flow",
      status: "running",
      startedAt: "2026-05-18T10:00:00.000Z",
      command: "opencode",
      args: ["run", "--format", "json"],
      startupCheck,
      progress: [],
    },
    commandResult: commandResult(),
    tasks: taskSource(),
    startupCheck,
    projectProfile: {
      defaults: {
        maxIterations: 3,
      },
    },
    runMainAgentSession: ({ role, packageId }) => ({
      sessionId: `session:${role}:${packageId}`,
      status: "succeeded",
    }),
    now: () => "2026-05-18T10:00:01.000Z",
  });

  assert.equal(completed.status, "succeeded");
  assert.equal(completed.executionIntentAppendRequest.artifactType, "executionIntent");
  assert.equal(completed.executionAdmission.appendRequest.artifactType, "executionAuthorization");
  assert.equal(completed.taskContextPackage.artifacts.executionIntent.body.confidence, "high");
  assert.equal(
    completed.taskContextPackage.artifacts.executionAuthorization.body.termination.maxIterations,
    3,
  );
  assert.equal(completed.mainAgentInitialization.appendRequest.agentRun.role, "main");
  assert.equal(completed.taskContextPackage.currentWorkStage, "main-agent");
  assert.equal(completed.taskContextPackage.agentRuns[0].sessionId, "session:main:task-context-package:tasks/task-001.yaml");
});
