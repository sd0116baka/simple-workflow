import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  completeRecommendationFlow,
  startRecommendationFlow,
} from "../src/workflow/recommendation-flow.js";

function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function createGitRepository(t) {
  const repositoryDir = await mkdtemp(join(tmpdir(), "simple-workflow-flow-"));
  t.after(() => rm(repositoryDir, { recursive: true, force: true }));

  runGit(["init", "-b", "main"], repositoryDir);
  await writeFile(join(repositoryDir, "README.md"), "test repository\n");
  runGit(["add", "README.md"], repositoryDir);
  runGit([
    "-c",
    "user.name=Simple Workflow Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "initial commit",
  ], repositoryDir);

  return repositoryDir;
}

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

test("recommendation flow blocks when there are no candidate tasks", async () => {
  const dir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "flow-no-candidates");
  await mkdir(dir, { recursive: true });
  const promptPath = join(dir, "recommender-agent.prompt.md");
  await writeFile(promptPath, "推荐一个任务。");

  const { run } = await startRecommendationFlow({
    id: "recommendation-run-flow",
    tasks: [
      {
        id: "task-invalid",
        fileName: "task-invalid.yaml",
        parsed: {
          id: "task-invalid",
          type: "feature",
        },
        parseError: null,
        validation: { status: "invalid", errors: ["title must be a non-empty string"] },
      },
    ],
    startupCheck,
    recommendationPromptPath: promptPath,
    now: () => "2026-05-18T10:00:00.000Z",
  });

  assert.equal(run.status, "blocked");
  assert.equal(run.error, "没有可推荐候选任务。");
  assert.equal(run.startupCheck.findings[0].code, "NO_CANDIDATE_TASKS");
});

test("recommendation flow applies module append requests through the task pool", async (t) => {
  const repositoryDir = await createGitRepository(t);
  let convergenceCount = 0;
  const completed = await completeRecommendationFlow({
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
    runConvergenceSession: ({ role, sessionId }) => {
      convergenceCount += 1;
      return {
        sessionId: `resumed:${role}:${sessionId}`,
        status: "succeeded",
        convergenceDecision: convergenceCount === 1 ? "advice" : "success",
      };
    },
    repositoryDir,
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
  assert.equal(completed.isolatedWorkspaceAllocation.appendRequest.artifactType, "isolatedWorkspace");
  assert.equal(
    completed.taskContextPackage.artifacts.isolatedWorkspace.body.worktreePath,
    ".workflow/worktrees/tasks/tasks-task-001",
  );
  assert.match(completed.taskContextPackage.artifacts.isolatedWorkspace.body.baseCommit, /^[0-9a-f]{40}$/);
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
  assert.equal(completed.convergenceRuns[1].appendRequest.artifactType, "convergenceSuccess");
  assert.equal(completed.successHumanDecisionRequest.appendRequest.artifactType, "humanDecisionRequest");
  assert.equal(completed.taskContextPackage.currentWorkStage, "human-decision");
  assert.equal(completed.taskContextPackage.agentRuns[0].sessionId, "session:main:task-context-package:tasks/task-001.yaml");
  assert.equal(completed.taskContextPackage.agentRuns[1].sessionId, "session:execution:task-context-package:tasks/task-001.yaml");
  assert.equal(completed.taskContextPackage.agentRuns[2].sessionId, "session:review:task-context-package:tasks/task-001.yaml");
  assert.equal(completed.taskContextPackage.agentRuns[3].sessionId, "resumed:main:session:main:task-context-package:tasks/task-001.yaml");
  assert.equal(completed.taskContextPackage.agentRuns[4].sessionId, "session:execution:task-context-package:tasks/task-001.yaml");
  assert.equal(completed.taskContextPackage.agentRuns[5].sessionId, "session:review:task-context-package:tasks/task-001.yaml");
  assert.equal(completed.taskContextPackage.agentRuns[6].sessionId, "resumed:main:session:main:task-context-package:tasks/task-001.yaml");
  assert.equal(completed.taskContextPackage.artifacts.executionReport[0].artifactId, "executionReport:001");
  assert.equal(completed.taskContextPackage.artifacts.executionReport[1].artifactId, "executionReport:002");
  assert.equal(
    completed.taskContextPackage.artifacts.executionReport[0].body.cwd,
    ".workflow/worktrees/tasks/tasks-task-001",
  );
  assert.deepEqual(completed.taskContextPackage.artifacts.executionReport[0].body.changedFiles, []);
  assert.deepEqual(completed.taskContextPackage.artifacts.executionReport[1].body.changedFiles, []);
  assert.equal(completed.taskContextPackage.artifacts.reviewReport[0].artifactId, "reviewReport:001");
  assert.equal(completed.taskContextPackage.artifacts.reviewReport[1].artifactId, "reviewReport:002");
  assert.equal(completed.taskContextPackage.artifacts.convergenceAdvice[0].artifactId, "convergenceAdvice:001");
  assert.equal(completed.taskContextPackage.artifacts.convergenceSuccess.artifactId, "convergenceSuccess");
  assert.equal(
    completed.taskContextPackage.artifacts.humanDecisionRequest.body.convergenceSuccessRef,
    "convergenceSuccess",
  );
  assert.deepEqual(completed.taskContextPackage.agentRuns[1].outputArtifactRefs, ["executionReport:001"]);
  assert.deepEqual(completed.taskContextPackage.agentRuns[2].outputArtifactRefs, ["reviewReport:001"]);
  assert.deepEqual(completed.taskContextPackage.agentRuns[3].outputArtifactRefs, ["convergenceAdvice:001"]);
  assert.deepEqual(completed.taskContextPackage.agentRuns[1].inputArtifactRefs, [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "isolatedWorkspace",
  ]);
  assert.deepEqual(completed.taskContextPackage.agentRuns[2].inputArtifactRefs, [
    "taskDraft",
    "executionAuthorization",
    "isolatedWorkspace",
    "executionReport:001",
  ]);
  assert.deepEqual(completed.taskContextPackage.agentRuns[4].inputArtifactRefs, [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "convergenceAdvice:001",
    "isolatedWorkspace",
  ]);
  assert.deepEqual(completed.taskContextPackage.agentRuns[4].outputArtifactRefs, ["executionReport:002"]);
  assert.deepEqual(completed.taskContextPackage.agentRuns[5].inputArtifactRefs, [
    "taskDraft",
    "executionAuthorization",
    "convergenceAdvice:001",
    "isolatedWorkspace",
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
  assert.deepEqual(completed.taskContextPackage.agentRuns[6].outputArtifactRefs, ["convergenceSuccess"]);
  assert.equal(completed.taskContextPackage.timeline[2].artifactId, "isolatedWorkspace");
  assert.equal(completed.taskContextPackage.timeline.at(-1).artifactId, "humanDecisionRequest");
});

test("recommendation flow probe mode stops after parsing execution intent", async (t) => {
  const repositoryDir = await createGitRepository(t);
  let executionAgentCalled = false;
  const completed = await completeRecommendationFlow({
    mode: "probe",
    run: {
      id: "recommendation-run-flow",
      mode: "probe",
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
    runExecutionAgentSession: () => {
      executionAgentCalled = true;
      return { status: "succeeded" };
    },
    repositoryDir,
    now: () => "2026-05-18T10:00:01.000Z",
  });

  assert.equal(completed.status, "succeeded");
  assert.equal(completed.mode, "probe");
  assert.equal(completed.executionIntentAppendRequest.artifactType, "executionIntent");
  assert.equal(completed.executionAdmission, null);
  assert.equal(completed.isolatedWorkspaceAllocation, null);
  assert.equal(completed.mainAgentInitialization, null);
  assert.deepEqual(completed.executionAgentRuns, []);
  assert.equal(completed.taskContextPackage, null);
  assert.equal(executionAgentCalled, false);
});

test("recommendation flow stops before review when execution agent fails", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const completed = await completeRecommendationFlow({
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
      status: "failed",
      rawOutput: {
        stdout: "",
        stderr: "execution failed",
        exitCode: 1,
        error: null,
      },
    }),
    repositoryDir,
    now: () => "2026-05-18T10:00:01.000Z",
  });

  assert.equal(completed.status, "succeeded");
  assert.equal(completed.taskContextPackage.currentWorkStage, "execution-agent");
  assert.equal(completed.executionAgentRuns.length, 1);
  assert.deepEqual(completed.executionAgentErrors, ["execution failed"]);
  assert.deepEqual(completed.reviewAgentRuns, []);
  assert.deepEqual(completed.convergenceRuns, []);
  assert.equal(completed.successHumanDecisionRequest, null);
  assert.equal(completed.taskContextPackage.artifacts.executionReport[0].body.status, "failed");
});
