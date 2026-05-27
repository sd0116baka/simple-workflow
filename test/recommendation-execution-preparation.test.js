import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareRecommendationExecution } from "../src/workflow/recommendation-execution-preparation.js";
import { applyAppendRequest, buildTaskPool } from "../src/workflow/task-pool.js";

function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function createGitRepository(t) {
  const repositoryDir = await mkdtemp(join(tmpdir(), "simple-workflow-preparation-"));
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

function startupCheck() {
  return {
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
}

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

test("recommendation execution preparation reaches main agent initialization", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const result = await prepareRecommendationExecution({
    commandResult: commandResult(),
    tasks: taskSource(),
    startupCheck: startupCheck(),
    projectProfile: {
      defaults: {
        maxIterations: 3,
      },
    },
    runMainAgentSession: ({ role, packageId }) => ({
      sessionId: `session:${role}:${packageId}`,
      status: "succeeded",
    }),
    repositoryDir,
    now: () => "2026-05-22T10:00:00.000Z",
  });

  assert.equal(result.commandFailed, false);
  assert.equal(result.packageId, "task-context-package:tasks/task-001.yaml");
  assert.equal(result.parsed.appendRequest.artifactType, "executionIntent");
  assert.equal(result.executionAdmission.appendRequest.artifactType, "executionAuthorization");
  assert.equal(result.isolatedWorkspaceAllocation.appendRequest.artifactType, "isolatedWorkspace");
  assert.equal(result.mainAgentInitialization.appendRequest.agentRun.role, "main");
  assert.equal(result.taskContextPackage.currentWorkStage, "main-agent");
  assert.equal(result.taskContextPackage.artifacts.executionIntent.body.confidence, "high");
  assert.equal(
    result.taskContextPackage.artifacts.executionAuthorization.body.termination.maxIterations,
    3,
  );
  assert.equal(
    result.taskContextPackage.artifacts.isolatedWorkspace.body.worktreePath,
    ".workflow/worktrees/tasks/tasks-task-001",
  );
  assert.equal(
    result.taskContextPackage.agentRuns[0].sessionId,
    "session:main:task-context-package:tasks/task-001.yaml",
  );
});

test("recommendation execution preparation can persist each downstream append", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const appendCalls = [];
  let currentTaskPool = buildTaskPool(taskSource());

  const result = await prepareRecommendationExecution({
    commandResult: commandResult(),
    tasks: taskSource(),
    startupCheck: startupCheck(),
    projectProfile: {
      defaults: {
        maxIterations: 3,
      },
    },
    runMainAgentSession: ({ role, packageId }) => ({
      sessionId: `session:${role}:${packageId}`,
      status: "succeeded",
    }),
    repositoryDir,
    now: () => "2026-05-22T10:00:00.000Z",
    applyAppendRequest: async (appendRequest, { currentWorkStage }) => {
      appendCalls.push({
        artifactType: appendRequest.artifactType ?? null,
        agentRunId: appendRequest.agentRun?.runId ?? null,
        currentWorkStage,
      });
      currentTaskPool = applyAppendRequest(currentTaskPool, appendRequest, {
        currentWorkStage,
      });
      return currentTaskPool;
    },
  });

  assert.deepEqual(
    appendCalls.map(({ artifactType, agentRunId, currentWorkStage }) => ({
      artifactType,
      agentRunId,
      currentWorkStage,
    })),
    [
      { artifactType: "executionIntent", agentRunId: null, currentWorkStage: "task-recommender" },
      { artifactType: "executionAuthorization", agentRunId: null, currentWorkStage: "execution-admission" },
      { artifactType: "isolatedWorkspace", agentRunId: null, currentWorkStage: "isolated-workspace" },
      { artifactType: null, agentRunId: "main-agent:initialization", currentWorkStage: "main-agent" },
    ],
  );
  assert.equal(result.taskContextPackage.currentWorkStage, "main-agent");
});

test("recommendation execution preparation skips downstream work for failed commands", async () => {
  const result = await prepareRecommendationExecution({
    commandResult: {
      stdout: "",
      stderr: "boom",
      exitCode: 1,
      error: "command failed",
    },
    tasks: taskSource(),
    startupCheck: startupCheck(),
    projectProfile: {},
  });

  assert.equal(result.commandFailed, true);
  assert.equal(result.taskPool, null);
  assert.equal(result.parsed.appendRequest, null);
  assert.equal(result.executionAdmission, null);
  assert.equal(result.isolatedWorkspaceAllocation, null);
  assert.equal(result.mainAgentInitialization, null);
  assert.equal(result.taskContextPackage, null);
});

test("recommendation execution preparation stops after intent when admission is disabled", async (t) => {
  const repositoryDir = await createGitRepository(t);
  let mainAgentCalled = false;
  const packageBindings = [];

  const result = await prepareRecommendationExecution({
    commandResult: commandResult(),
    tasks: taskSource(),
    startupCheck: startupCheck(),
    projectProfile: {
      defaults: {
        maxIterations: 3,
      },
    },
    stageSwitches: {
      executionAdmission: false,
      isolatedWorkspace: true,
      mainAgent: true,
      executionAgent: true,
      reviewAgent: true,
      convergence: true,
    },
    runMainAgentSession: () => {
      mainAgentCalled = true;
      return { status: "succeeded" };
    },
    onPackageBound: (binding) => packageBindings.push(binding),
    repositoryDir,
  });

  assert.deepEqual(packageBindings, [{ packageId: "task-context-package:tasks/task-001.yaml" }]);
  assert.equal(result.executionAdmission, null);
  assert.equal(result.isolatedWorkspaceAllocation, null);
  assert.equal(result.mainAgentInitialization, null);
  assert.equal(result.taskContextPackage.currentWorkStage, "task-recommender");
  assert.equal(result.taskContextPackage.artifacts.executionIntent.body.confidence, "high");
  assert.equal(mainAgentCalled, false);
});

test("recommendation execution preparation stops before main agent when main switch is disabled", async (t) => {
  const repositoryDir = await createGitRepository(t);
  let mainAgentCalled = false;

  const result = await prepareRecommendationExecution({
    commandResult: commandResult(),
    tasks: taskSource(),
    startupCheck: startupCheck(),
    projectProfile: {
      defaults: {
        maxIterations: 3,
      },
    },
    stageSwitches: {
      executionAdmission: true,
      isolatedWorkspace: true,
      mainAgent: false,
      executionAgent: true,
      reviewAgent: true,
      convergence: true,
    },
    runMainAgentSession: () => {
      mainAgentCalled = true;
      return { status: "succeeded" };
    },
    repositoryDir,
  });

  assert.equal(result.executionAdmission.appendRequest.artifactType, "executionAuthorization");
  assert.equal(result.isolatedWorkspaceAllocation.appendRequest.artifactType, "isolatedWorkspace");
  assert.equal(result.mainAgentInitialization, null);
  assert.equal(result.taskContextPackage.currentWorkStage, "isolated-workspace");
  assert.equal(mainAgentCalled, false);
});

test("recommendation execution preparation keeps task pool when intent parsing fails", async () => {
  const result = await prepareRecommendationExecution({
    commandResult: {
      stdout: "not json",
      stderr: "",
      exitCode: 0,
      error: null,
    },
    tasks: taskSource(),
    startupCheck: startupCheck(),
    projectProfile: {},
  });

  assert.equal(result.commandFailed, false);
  assert.equal(result.parsed.appendRequest, null);
  assert.match(result.parsed.error, /Unexpected token/);
  assert.equal(result.taskPool.views.candidateTasks.length, 1);
  assert.equal(result.executionAdmission, null);
  assert.equal(result.isolatedWorkspaceAllocation, null);
  assert.equal(result.mainAgentInitialization, null);
  assert.equal(result.taskContextPackage, null);
});
