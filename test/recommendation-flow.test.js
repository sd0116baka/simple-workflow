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
    runExecutionAgentSession: ({ role, packageId }) => ({
      sessionId: `session:${role}:${packageId}`,
      status: "succeeded",
    }),
    runReviewAgentSession: ({ role, packageId }) => ({
      sessionId: `session:${role}:${packageId}`,
      status: "succeeded",
    }),
    runConvergenceSession: ({ role, sessionId }) => ({
      sessionId: `resumed:${role}:${sessionId}`,
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
  assert.equal(completed.executionAgentRuns.length, 2);
  assert.equal(completed.executionAgentRuns[0].appendRequest.agentRun.role, "execution");
  assert.equal(completed.executionAgentRuns[1].appendRequest.agentRun.runId, "execution-agent:002");
  assert.equal(completed.reviewAgentRuns.length, 2);
  assert.equal(completed.reviewAgentRuns[0].appendRequest.agentRun.role, "review");
  assert.equal(completed.reviewAgentRuns[1].appendRequest.agentRun.runId, "review-agent:002");
  assert.equal(completed.convergenceRuns.length, 2);
  assert.equal(completed.convergenceRuns[0].appendRequest.agentRun.runId, "main-agent:convergence:001");
  assert.equal(completed.convergenceRuns[1].appendRequest.agentRun.runId, "main-agent:convergence:002");
  assert.equal(completed.convergenceRuns[1].appendRequest.artifactType, "taskCompletion");
  assert.equal(completed.taskContextPackage.currentWorkStage, "task-completion");
  assert.equal(completed.taskContextPackage.agentRuns[0].sessionId, "session:main:task-context-package:tasks/task-001.yaml");
  assert.equal(completed.taskContextPackage.agentRuns[1].sessionId, "session:execution:task-context-package:tasks/task-001.yaml");
  assert.equal(completed.taskContextPackage.agentRuns[2].sessionId, "session:review:task-context-package:tasks/task-001.yaml");
  assert.equal(completed.taskContextPackage.agentRuns[3].sessionId, "resumed:main:session:main:task-context-package:tasks/task-001.yaml");
  assert.equal(completed.taskContextPackage.agentRuns[4].sessionId, "session:execution:task-context-package:tasks/task-001.yaml");
  assert.equal(completed.taskContextPackage.agentRuns[5].sessionId, "session:review:task-context-package:tasks/task-001.yaml");
  assert.equal(completed.taskContextPackage.agentRuns[6].sessionId, "resumed:main:session:main:task-context-package:tasks/task-001.yaml");
  assert.equal(completed.taskContextPackage.artifacts.executionReport[0].artifactId, "executionReport:001");
  assert.equal(completed.taskContextPackage.artifacts.executionReport[1].artifactId, "executionReport:002");
  assert.equal(completed.taskContextPackage.artifacts.reviewReport[0].artifactId, "reviewReport:001");
  assert.equal(completed.taskContextPackage.artifacts.reviewReport[1].artifactId, "reviewReport:002");
  assert.equal(completed.taskContextPackage.artifacts.convergenceAdvice[0].artifactId, "convergenceAdvice:001");
  assert.equal(completed.taskContextPackage.artifacts.taskCompletion.artifactId, "taskCompletion");
  assert.deepEqual(completed.taskContextPackage.agentRuns[1].outputArtifactRefs, ["executionReport:001"]);
  assert.deepEqual(completed.taskContextPackage.agentRuns[2].outputArtifactRefs, ["reviewReport:001"]);
  assert.deepEqual(completed.taskContextPackage.agentRuns[3].outputArtifactRefs, ["convergenceAdvice:001"]);
  assert.deepEqual(completed.taskContextPackage.agentRuns[4].inputArtifactRefs, [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "convergenceAdvice:001",
  ]);
  assert.deepEqual(completed.taskContextPackage.agentRuns[4].outputArtifactRefs, ["executionReport:002"]);
  assert.deepEqual(completed.taskContextPackage.agentRuns[5].inputArtifactRefs, [
    "taskDraft",
    "executionAuthorization",
    "convergenceAdvice:001",
    "executionReport:002",
  ]);
  assert.deepEqual(completed.taskContextPackage.agentRuns[5].outputArtifactRefs, ["reviewReport:002"]);
  assert.deepEqual(completed.taskContextPackage.agentRuns[6].inputArtifactRefs, [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "convergenceAdvice:001",
    "executionReport:002",
    "reviewReport:002",
  ]);
  assert.deepEqual(completed.taskContextPackage.agentRuns[6].outputArtifactRefs, ["taskCompletion"]);
});
