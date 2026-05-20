import { once } from "node:events";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp, restartCommand } from "../src/server/server.js";
import { runStubExecutionAgentSession } from "../src/workflow/execution-agent-flow.js";
import { createWorkflowService } from "../src/workflow/workflow-service.js";
import { saveTaskContextPackage } from "../src/workflow/task-context-package-store.js";

function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitSucceeds(args, cwd) {
  try {
    runGit(args, cwd);
    return true;
  } catch {
    return false;
  }
}

async function createGitRepository(t) {
  const repositoryDir = await mkdtemp(join(tmpdir(), "simple-workflow-runs-"));
  t.after(() => rm(repositoryDir, { recursive: true, force: true }));

  runGit(["init", "-b", "main"], repositoryDir);
  await writeFile(join(repositoryDir, "README.md"), "test repository\n");
  await writeFile(join(repositoryDir, ".gitignore"), ".workflow/\n");
  runGit(["add", "README.md", ".gitignore"], repositoryDir);
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

async function writePrompt(name) {
  const dir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), name);
  await mkdir(dir, { recursive: true });
  const promptPath = join(dir, "recommender-agent.prompt.md");
  await writeFile(promptPath, "推荐一个任务，但不要修改文件。");
  return promptPath;
}

async function writeValidTasksDir(name, taskId = "task-001") {
  const tasksDir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), name, "tasks");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, `${taskId}.yaml`),
    [
      `id: ${taskId}`,
      "title: 展示任务真源",
      "type: feature",
      "description: 展示任务",
      "acceptance:",
      "  - 可以看到任务",
      "",
    ].join("\n"),
  );
  return tasksDir;
}

function buildIntentJson(taskId = "task-001") {
  return JSON.stringify({
    appendRequest: {
      packageId: `task-context-package:tasks/${taskId}.yaml`,
      artifactType: "executionIntent",
      artifact: {
        recommendedPackageId: `task-context-package:tasks/${taskId}.yaml`,
        confidence: "medium",
        selectionReasoning: ["任务可执行"],
        candidateComparison: [
          {
            packageId: `task-context-package:tasks/${taskId}.yaml`,
            decision: "selected",
            reason: "当前最适合执行",
          },
        ],
        executionBrief: {
          goalInterpretation: `优先实现 ${taskId}。`,
          expectedOutcome: ["任务完成后满足验收标准"],
          implementationHints: ["先阅读现有实现"],
          riskSignals: [],
          openQuestions: [],
        },
      },
    },
  });
}

test("recommender prompt asks for a structured JSON artifact", async () => {
  const prompt = await readFile(join(process.cwd(), "project_profiles", "recommender-agent.prompt.md"), "utf8");

  assert.match(prompt, /fenced JSON/);
  assert.match(prompt, /candidateTasks/);
  assert.doesNotMatch(prompt, /schemaVersion/);
  assert.match(prompt, /recommendedPackageId/);
  assert.match(prompt, /candidateComparison/);
  assert.match(prompt, /不要读取 `tasks\/` 原始目录/);
  assert.match(prompt, /不要修改任何文件/);
});

test("workflow service captures a successful recommendation run", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("recommendation-success");
  const tasksDir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "tasks");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, "task-001.yaml"),
    [
      "id: task-001",
      "title: 展示任务真源",
      "type: feature",
      "description: 展示任务",
      "acceptance:",
      "  - 可以看到任务",
      "",
    ].join("\n"),
  );
  const service = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: async ({ prompt }) => {
      assert.match(prompt, /candidateTasks/);
      assert.match(prompt, /task-001/);
      assert.match(prompt, /不要修改文件/);
      return {
        stdout: `\`\`\`json\n${buildIntentJson()}\n\`\`\``,
        stderr: "",
        exitCode: 0,
        error: null,
      };
    },
    runExecutionAgentSession: runStubExecutionAgentSession,
  });

  const completed = new Promise((resolve) => {
    service.onEvent((event) => {
      if (event.type === "recommendation-run-changed" && event.run.status === "succeeded") {
        resolve(event.run);
      }
    });
  });

  const running = await service.createRecommendationRun();
  const finished = await completed;

  assert.equal(running.status, "running");
  assert.equal(finished.status, "succeeded");
  assert.match(finished.stdout, /task-001/);
  assert.equal(finished.executionIntent.recommendedPackageId, "task-context-package:tasks/task-001.yaml");
  assert.equal(finished.executionIntentAppendRequest.artifactType, "executionIntent");
  assert.equal(finished.executionIntentError, null);
  assert.equal(finished.executionAdmission.appendRequest.artifactType, "executionAuthorization");
  assert.equal(finished.taskContextPackage.currentWorkStage, "human-decision");
  assert.equal(finished.taskContextPackage.artifacts.executionAuthorization.body.termination.maxIterations, 3);
  assert.equal(finished.isolatedWorkspaceAllocation.appendRequest.artifactType, "isolatedWorkspace");
  assert.equal(
    finished.taskContextPackage.artifacts.isolatedWorkspace.body.branchName,
    "workflow/tasks/tasks-task-001",
  );
  const baseCommitSegment = finished.taskContextPackage.artifacts.isolatedWorkspace.body.baseCommit.slice(0, 12);
  const firstExecutionProbe = `.workflow-agent/task-001/${baseCommitSegment}/execution-agent-001.txt`;
  const secondExecutionProbe = `.workflow-agent/task-001/${baseCommitSegment}/execution-agent-002.txt`;
  assert.equal(finished.successHumanDecisionRequest.appendRequest.artifactType, "humanDecisionRequest");
  assert.equal(finished.executionAgentRuns.length, 2);
  assert.equal(finished.reviewAgentRuns.length, 2);
  assert.equal(finished.convergenceRuns.length, 2);
  assert.equal(finished.taskContextPackage.agentRuns[0].role, "main");
  assert.match(finished.taskContextPackage.agentRuns[0].sessionId, /^stub-main-session:/);
  assert.equal(finished.taskContextPackage.agentRuns[1].role, "execution");
  assert.match(finished.taskContextPackage.agentRuns[1].sessionId, /^stub-execution-session:/);
  assert.equal(finished.taskContextPackage.agentRuns[2].role, "review");
  assert.match(finished.taskContextPackage.agentRuns[2].sessionId, /^stub-review-session:/);
  assert.equal(finished.taskContextPackage.agentRuns[3].role, "main");
  assert.match(finished.taskContextPackage.agentRuns[3].sessionId, /^stub-main-session:/);
  assert.equal(finished.taskContextPackage.agentRuns[4].runId, "execution-agent:002");
  assert.equal(finished.taskContextPackage.agentRuns[4].role, "execution");
  assert.equal(finished.taskContextPackage.agentRuns[5].runId, "review-agent:002");
  assert.equal(finished.taskContextPackage.agentRuns[5].role, "review");
  assert.equal(finished.taskContextPackage.agentRuns[6].runId, "main-agent:convergence:002");
  assert.equal(finished.taskContextPackage.agentRuns[6].role, "main");
  assert.deepEqual(finished.taskContextPackage.agentRuns[1].inputArtifactRefs, [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "isolatedWorkspace",
  ]);
  assert.deepEqual(finished.taskContextPackage.agentRuns[2].inputArtifactRefs, [
    "taskDraft",
    "executionAuthorization",
    "isolatedWorkspace",
    "executionReport:001",
  ]);
  assert.deepEqual(finished.taskContextPackage.agentRuns[4].inputArtifactRefs, [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "convergenceAdvice:001",
    "isolatedWorkspace",
  ]);
  assert.deepEqual(finished.taskContextPackage.agentRuns[5].inputArtifactRefs, [
    "taskDraft",
    "executionAuthorization",
    "convergenceAdvice:001",
    "isolatedWorkspace",
    "executionReport:002",
  ]);
  assert.deepEqual(finished.taskContextPackage.agentRuns[6].inputArtifactRefs, [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "convergenceAdvice:001",
    "executionReport:002",
    "reviewReport:002",
  ]);
  assert.equal(finished.taskContextPackage.artifacts.executionReport[0].artifactId, "executionReport:001");
  assert.equal(finished.taskContextPackage.artifacts.executionReport[1].artifactId, "executionReport:002");
  assert.equal(
    finished.taskContextPackage.artifacts.executionReport[0].body.cwd,
    ".workflow/worktrees/tasks/tasks-task-001",
  );
  assert.deepEqual(finished.taskContextPackage.artifacts.executionReport[0].body.changedFiles, [
    firstExecutionProbe,
  ]);
  assert.deepEqual(finished.taskContextPackage.artifacts.executionReport[1].body.changedFiles, [
    firstExecutionProbe,
    secondExecutionProbe,
  ]);
  assert.equal(finished.taskContextPackage.artifacts.reviewReport[0].artifactId, "reviewReport:001");
  assert.equal(finished.taskContextPackage.artifacts.reviewReport[1].artifactId, "reviewReport:002");
  assert.equal(finished.taskContextPackage.artifacts.convergenceAdvice[0].artifactId, "convergenceAdvice:001");
  assert.equal(finished.taskContextPackage.artifacts.convergenceSuccess.artifactId, "convergenceSuccess");
  assert.equal(finished.taskContextPackage.timeline[2].artifactId, "isolatedWorkspace");
  assert.equal(
    finished.taskContextPackage.artifacts.humanDecisionRequest.body.convergenceSuccessRef,
    "convergenceSuccess",
  );
  assert.equal(finished.exitCode, 0);
  assert.equal(service.getLatestRecommendationRun().status, "succeeded");

  const resumedHumanDecisionService = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: async () => {
      throw new Error("should not run");
    },
    runExecutionAgentSession: runStubExecutionAgentSession,
  });
  const accepted = await resumedHumanDecisionService.acceptConvergenceSuccess({
    packageId: "task-context-package:tasks/task-001.yaml",
  });

  assert.equal(accepted.accepted, true);
  assert.equal(accepted.planned, true);
  assert.equal(accepted.executed, true);
  assert.equal(accepted.closed, true);
  assert.equal(accepted.error, null);
  assert.equal(accepted.recommendationRun.autoMergePlanning.appendRequest.artifactType, "autoMergePlan");
  assert.equal(accepted.recommendationRun.autoMergeExecution.appendRequest.artifactType, "autoMergeResult");
  assert.equal(accepted.recommendationRun.taskCloseout.appendRequest.artifactType, "taskCloseout");
  assert.equal(accepted.recommendationRun.taskContextPackage.currentWorkStage, "closed");
  assert.equal(
    accepted.recommendationRun.taskContextPackage.artifacts.humanDecision.body.decision,
    "accept-completion",
  );
  assert.equal(
    accepted.recommendationRun.taskContextPackage.artifacts.humanDecision.body.nextRequiredStage,
    "auto-merge-planning",
  );
  assert.deepEqual(
    accepted.recommendationRun.taskContextPackage.artifacts.humanDecision.body.worktreeSnapshot.changedFiles,
    [
      firstExecutionProbe,
      secondExecutionProbe,
    ],
  );
  assert.deepEqual(
    accepted.recommendationRun.taskContextPackage.artifacts.autoMergePlan.body.changeSet.changedFiles,
    [
      firstExecutionProbe,
      secondExecutionProbe,
    ],
  );
  assert.equal(
    "hasChanges" in accepted.recommendationRun.taskContextPackage.artifacts.autoMergePlan.body.changeSet,
    false,
  );
  assert.equal(
    "strategy" in accepted.recommendationRun.taskContextPackage.artifacts.autoMergePlan.body,
    false,
  );
  assert.equal(
    "nextRequiredStage" in accepted.recommendationRun.taskContextPackage.artifacts.autoMergePlan.body,
    false,
  );
  assert.equal(
    "convergenceSuccessRef" in accepted.recommendationRun.taskContextPackage.artifacts.autoMergePlan.body,
    false,
  );
  assert.deepEqual(
    accepted.recommendationRun.taskContextPackage.artifacts.autoMergeResult.body.changeSet.changedFiles,
    [
      firstExecutionProbe,
      secondExecutionProbe,
    ],
  );
  assert.equal(
    accepted.recommendationRun.taskContextPackage.artifacts.autoMergeResult.body.target.afterCommit,
    accepted.recommendationRun.taskContextPackage.artifacts.autoMergeResult.body.source.commit,
  );
  assert.equal(
    accepted.recommendationRun.taskContextPackage.artifacts.taskCloseout.body.cleanup.worktree.removed,
    true,
  );
  assert.equal(
    accepted.recommendationRun.taskContextPackage.artifacts.taskCloseout.body.cleanup.branch.deleted,
    true,
  );

  const taskPoolAfterCloseout = await resumedHumanDecisionService.listTaskPool();
  assert.equal(taskPoolAfterCloseout.entries[0].status, "closed");
  assert.equal(taskPoolAfterCloseout.taskContextPackages[0].currentWorkStage, "closed");
  assert.deepEqual(taskPoolAfterCloseout.views.candidateTasks, []);

  const restartedService = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: async () => {
      throw new Error("should not run");
    },
    runExecutionAgentSession: runStubExecutionAgentSession,
  });
  const taskPoolAfterRestart = await restartedService.listTaskPool();

  assert.equal(taskPoolAfterRestart.entries[0].status, "closed");
  assert.equal(taskPoolAfterRestart.taskContextPackages[0].currentWorkStage, "closed");
  assert.equal(
    taskPoolAfterRestart.taskContextPackages[0].artifacts.taskCloseout.body.finalStage,
    "closed",
  );
  assert.deepEqual(taskPoolAfterRestart.views.candidateTasks, []);
});

test("workflow service does not expose invalid tasks to the recommender prompt", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("recommendation-candidates");
  const tasksDir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "candidate-tasks");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, "task-ready.yaml"),
    [
      "id: task-ready",
      "title: 可推荐任务",
      "type: feature",
      "description: 已通过校验",
      "acceptance:",
      "  - 推荐器能看到它",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(tasksDir, "task-invalid.yaml"),
    [
      "id: task-invalid",
      "type: feature",
      "description: 缺少 title",
      "acceptance:",
      "  - 推荐器不能看到它",
      "",
    ].join("\n"),
  );

  const service = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: async ({ prompt }) => {
      assert.match(prompt, /task-ready/);
      assert.doesNotMatch(prompt, /task-invalid/);
      return {
        stdout: `\`\`\`json\n${buildIntentJson("task-ready")}\n\`\`\``,
        stderr: "",
        exitCode: 0,
        error: null,
      };
    },
    runExecutionAgentSession: runStubExecutionAgentSession,
  });

  const completed = new Promise((resolve) => {
    service.onEvent((event) => {
      if (event.type === "recommendation-run-changed" && event.run.status === "succeeded") {
        resolve(event.run);
      }
    });
  });

  await service.createRecommendationRun();
  const finished = await completed;

  assert.equal(finished.executionAdmission.appendRequest.artifactType, "executionAuthorization");
});

test("workflow service does not run recommender when startup check fails", async () => {
  const promptPath = await writePrompt("recommendation-startup-blocked");
  const service = createWorkflowService({
    tasksDir: join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "tasks"),
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({
      clean: false,
      entries: [{ code: "M", path: "public/app.js" }],
    }),
    runRecommendationCommand: async () => {
      throw new Error("should not run");
    },
  });

  const run = await service.createRecommendationRun();

  assert.equal(run.status, "blocked");
  assert.equal(run.command, null);
  assert.equal(run.startupCheck.canStartWork, false);
  assert.match(run.error, /启动检查未通过/);
});

test("workflow service does not run recommender when a task workflow is active", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("recommendation-active-work");
  const tasksDir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "active-work-tasks");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, "task-004.yaml"),
    [
      "id: task-004",
      "title: 任务池状态模型",
      "type: design",
      "description: 设计任务池状态",
      "acceptance:",
      "  - 明确状态",
      "",
    ].join("\n"),
  );
  await saveTaskContextPackage({
    storeDir: join(repositoryDir, ".workflow", "task-context-packages"),
    taskContextPackage: {
      packageId: "task-context-package:tasks/task-004.yaml",
      currentWorkStage: "human-decision",
      source: {
        path: "tasks/task-004.yaml",
        format: "yaml",
        contentHash: "unavailable",
      },
      recognition: { outcome: "recognized", findings: [] },
      taskDraft: {
        id: "task-004",
        name: "任务池状态模型",
        kind: "design",
        priority: "normal",
        goal: "设计任务池状态",
        acceptanceCriteria: ["明确状态"],
        maxIterations: "default",
      },
      qualityGate: { outcome: "pass" },
      artifacts: {
        humanDecisionRequest: {
          artifactId: "humanDecisionRequest",
          body: {},
          appendedAt: "2026-05-19T00:00:00.000Z",
        },
      },
      agentRuns: [],
      timeline: [],
    },
  });
  const service = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: async () => {
      throw new Error("should not run");
    },
  });

  const run = await service.createRecommendationRun();

  assert.equal(run.status, "blocked");
  assert.equal(run.startupCheck.canStartWork, false);
  assert.equal(run.startupCheck.findings[0].code, "ACTIVE_WORK_EXISTS");
  assert.equal(run.startupCheck.runtimeSnapshot.activeWork.packageId, "task-context-package:tasks/task-004.yaml");
});

test("workflow service keeps successful runs when recommendation intent parsing fails", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("recommendation-parse-failure");
  const tasksDir = await writeValidTasksDir("recommendation-parse-failure");
  const service = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: async () => ({
      stdout: "不是 JSON",
      stderr: "",
      exitCode: 0,
      error: null,
    }),
  });

  const completed = new Promise((resolve) => {
    service.onEvent((event) => {
      if (event.type === "recommendation-run-changed" && event.run.status === "succeeded") {
        resolve(event.run);
      }
    });
  });

  await service.createRecommendationRun();
  const finished = await completed;

  assert.equal(finished.status, "succeeded");
  assert.equal(finished.executionIntent, null);
  assert.match(finished.executionIntentError, /Unexpected token|JSON/);
});

test("workflow service emits running progress for recommendation runs", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("recommendation-progress");
  const tasksDir = await writeValidTasksDir("recommendation-progress");
  const service = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: async ({ onProgress }) => {
      onProgress({ type: "step_start", message: "开始运行 opencode" });
      return {
        stdout: "建议先做 task-001",
        stderr: "",
        exitCode: 0,
        error: null,
      };
    },
  });

  const progressEvent = new Promise((resolve) => {
    service.onEvent((event) => {
      if (event.type === "recommendation-run-changed" && event.run.progress.length > 0) {
        resolve(event.run);
      }
    });
  });

  await service.createRecommendationRun();
  const running = await progressEvent;

  assert.equal(running.status, "running");
  assert.equal(running.progress[0].message, "开始运行 opencode");
});

test("workflow service cancels a running recommendation run", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("recommendation-cancel");
  const tasksDir = await writeValidTasksDir("recommendation-cancel");
  const service = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: ({ signal, onProgress }) => new Promise((resolve) => {
      signal.addEventListener("abort", () => {
        onProgress({
          type: "process_cancelled",
          stream: "system",
          message: "用户取消运行",
          terminalLine: "process: cancelled by user",
        });
        resolve({
          stdout: "",
          stderr: "",
          exitCode: null,
          error: "cancelled",
        });
      }, { once: true });
    }),
  });

  await service.createRecommendationRun();
  const result = service.cancelRecommendationRun();
  await new Promise((resolve) => setImmediate(resolve));
  const latest = service.getLatestRecommendationRun();

  assert.equal(result.cancelled, true);
  assert.equal(latest.status, "cancelled");
  assert.equal(latest.error, "cancelled");
  assert.equal(latest.progress.some((entry) => entry.type === "cancel_requested"), true);
  assert.equal(latest.progress.some((entry) => entry.type === "process_cancelled"), true);
});

test("workflow service does not start a second recommendation run while one is running", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("recommendation-mutual-exclusion");
  const tasksDir = await writeValidTasksDir("recommendation-mutual-exclusion");
  let commandRuns = 0;
  const service = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: ({ signal }) => new Promise((resolve) => {
      commandRuns += 1;
      const resolveCancelled = () => {
        resolve({
          stdout: "",
          stderr: "",
          exitCode: null,
          error: "cancelled",
        });
      };
      if (signal.aborted) {
        resolveCancelled();
        return;
      }
      signal.addEventListener("abort", () => {
        resolveCancelled();
      }, { once: true });
    }),
  });

  const first = await service.createRecommendationRun();
  const second = await service.createRecommendationRun();
  service.cancelRecommendationRun();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(first.status, "running");
  assert.equal(second.status, "running");
  assert.equal(second.id, first.id);
  assert.equal(commandRuns, 1);
});

test("workflow service marks non-zero recommendation exits as failed", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("recommendation-failure");
  const tasksDir = await writeValidTasksDir("recommendation-failure");
  const service = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: async () => ({
      stdout: "",
      stderr: "模型调用失败",
      exitCode: 2,
      error: null,
    }),
  });

  const completed = new Promise((resolve) => {
    service.onEvent((event) => {
      if (event.type === "recommendation-run-changed" && event.run.status === "failed") {
        resolve(event.run);
      }
    });
  });

  await service.createRecommendationRun();
  const finished = await completed;

  assert.equal(finished.status, "failed");
  assert.equal(finished.stderr, "模型调用失败");
  assert.equal(finished.exitCode, 2);
});

test("workflow service marks thrown recommendation commands as failed", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("recommendation-throw");
  const tasksDir = await writeValidTasksDir("recommendation-throw");
  const service = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: () => {
      throw new Error("命令启动失败");
    },
  });

  const completed = new Promise((resolve) => {
    service.onEvent((event) => {
      if (event.type === "recommendation-run-changed" && event.run.status === "failed") {
        resolve(event.run);
      }
    });
  });

  const running = await service.createRecommendationRun();
  const finished = await completed;

  assert.equal(running.status, "running");
  assert.equal(finished.status, "failed");
  assert.equal(finished.error, "命令启动失败");
});

test("POST /api/recommendation-runs starts a run and latest returns the snapshot", async (t) => {
  const latestRun = {
    id: "recommendation-run-test",
    status: "running",
    startedAt: "2026-05-16T00:00:00.000Z",
    finishedAt: null,
    command: "opencode",
    args: ["run", "--format", "json"],
    progress: [],
    stdout: "",
    stderr: "",
    exitCode: null,
    error: null,
  };
  let currentRun = null;
  const workflowService = {
    async createRecommendationRun() {
      currentRun = latestRun;
      return latestRun;
    },
    getLatestRecommendationRun() {
      return currentRun;
    },
    onEvent() {
      return () => {};
    },
  };
  const server = createApp({ workflowService });
  server.listen(0);
  t.after(() => server.close());
  await once(server, "listening");

  const baseUrl = `http://localhost:${server.address().port}`;
  const createResponse = await fetch(`${baseUrl}/api/recommendation-runs`, { method: "POST" });
  const createPayload = await createResponse.json();
  const latestResponse = await fetch(`${baseUrl}/api/recommendation-runs/latest`);
  const latestPayload = await latestResponse.json();

  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.recommendationRun.status, "running");
  assert.equal(latestResponse.status, 200);
  assert.equal(latestPayload.recommendationRun.id, "recommendation-run-test");
});

test("POST /api/recommendation-runs returns conflict when a run is already running", async (t) => {
  const latestRun = {
    id: "recommendation-run-busy",
    status: "running",
    startedAt: "2026-05-16T00:00:00.000Z",
    finishedAt: null,
    command: "opencode",
    args: ["run", "--format", "json"],
    progress: [],
    stdout: "",
    stderr: "",
    exitCode: null,
    error: null,
  };
  let createCalled = false;
  const workflowService = {
    async createRecommendationRun() {
      createCalled = true;
      return latestRun;
    },
    getLatestRecommendationRun() {
      return latestRun;
    },
    onEvent() {
      return () => {};
    },
  };
  const server = createApp({ workflowService });
  server.listen(0);
  t.after(() => server.close());
  await once(server, "listening");

  const baseUrl = `http://localhost:${server.address().port}`;
  const response = await fetch(`${baseUrl}/api/recommendation-runs`, { method: "POST" });
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(createCalled, false);
  assert.match(payload.error, /正在运行/);
  assert.equal(payload.recommendationRun.id, "recommendation-run-busy");
});

test("POST /api/recommendation-runs/cancel cancels the latest run", async (t) => {
  const latestRun = {
    id: "recommendation-run-test",
    status: "cancelled",
    startedAt: "2026-05-16T00:00:00.000Z",
    finishedAt: "2026-05-16T00:00:01.000Z",
    command: "opencode",
    args: ["run", "--format", "json"],
    progress: [],
    stdout: "",
    stderr: "",
    exitCode: null,
    error: "cancelled",
  };
  const workflowService = {
    cancelRecommendationRun() {
      return {
        cancelled: true,
        error: null,
        recommendationRun: latestRun,
      };
    },
    getLatestRecommendationRun() {
      return latestRun;
    },
    onEvent() {
      return () => {};
    },
  };
  const server = createApp({ workflowService });
  server.listen(0);
  t.after(() => server.close());
  await once(server, "listening");

  const baseUrl = `http://localhost:${server.address().port}`;
  const response = await fetch(`${baseUrl}/api/recommendation-runs/cancel`, { method: "POST" });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.cancelled, true);
  assert.equal(payload.recommendationRun.status, "cancelled");
});

test("POST /api/human-decisions/accept-completion accepts convergence success", async (t) => {
  const latestRun = {
    id: "recommendation-run-test",
    status: "succeeded",
  };
  let observedPackageId = null;
  const workflowService = {
    async acceptConvergenceSuccess({ packageId }) {
      observedPackageId = packageId;
      return {
        accepted: true,
        planned: true,
        executed: true,
        closed: true,
        error: null,
        recommendationRun: latestRun,
      };
    },
    getLatestRecommendationRun() {
      return latestRun;
    },
    onEvent() {
      return () => {};
    },
  };
  const server = createApp({ workflowService });
  server.listen(0);
  t.after(() => server.close());
  await once(server, "listening");

  const response = await fetch(
    `http://localhost:${server.address().port}/api/human-decisions/accept-completion`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        packageId: "task-context-package:tasks/task-001.yaml",
      }),
    },
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.accepted, true);
  assert.equal(payload.planned, true);
  assert.equal(payload.executed, true);
  assert.equal(payload.closed, true);
  assert.equal(payload.recommendationRun.status, "succeeded");
  assert.equal(observedPackageId, "task-context-package:tasks/task-001.yaml");
});

test("POST /api/human-decisions/retry-with-guidance retries convergence failure", async (t) => {
  const latestRun = {
    id: "recommendation-run-test",
    status: "succeeded",
  };
  let observedBody = null;
  const workflowService = {
    async retryWithConvergenceGuidance(body) {
      observedBody = body;
      return {
        retried: true,
        error: null,
        recommendationRun: latestRun,
      };
    },
    getLatestRecommendationRun() {
      return latestRun;
    },
    onEvent() {
      return () => {};
    },
  };
  const server = createApp({ workflowService });
  server.listen(0);
  t.after(() => server.close());
  await once(server, "listening");

  const response = await fetch(
    `http://localhost:${server.address().port}/api/human-decisions/retry-with-guidance`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        packageId: "task-context-package:tasks/task-001.yaml",
        guidance: "先收窄候选任务状态。",
        expectedNextOutcome: "下一轮证明候选集正确。",
      }),
    },
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.retried, true);
  assert.equal(observedBody.packageId, "task-context-package:tasks/task-001.yaml");
  assert.equal(observedBody.guidance, "先收窄候选任务状态。");
  assert.equal(observedBody.expectedNextOutcome, "下一轮证明候选集正确。");
});

test("POST /api/human-decisions/cancel-task cancels convergence-failed task", async (t) => {
  const latestRun = {
    id: "recommendation-run-test",
    status: "succeeded",
  };
  let observedPackageId = null;
  const workflowService = {
    async cancelTask({ packageId }) {
      observedPackageId = packageId;
      return {
        cancelled: true,
        error: null,
        recommendationRun: latestRun,
      };
    },
    getLatestRecommendationRun() {
      return latestRun;
    },
    onEvent() {
      return () => {};
    },
  };
  const server = createApp({ workflowService });
  server.listen(0);
  t.after(() => server.close());
  await once(server, "listening");

  const response = await fetch(
    `http://localhost:${server.address().port}/api/human-decisions/cancel-task`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        packageId: "task-context-package:tasks/task-001.yaml",
      }),
    },
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.cancelled, true);
  assert.equal(observedPackageId, "task-context-package:tasks/task-001.yaml");
});

test("POST /api/auto-merge/replan regenerates auto-merge plan only", async (t) => {
  const latestRun = {
    id: "recommendation-run-test",
    status: "succeeded",
  };
  let observedPackageId = null;
  const workflowService = {
    async replanAutoMerge({ packageId }) {
      observedPackageId = packageId;
      return {
        planned: true,
        error: null,
        recommendationRun: latestRun,
      };
    },
    getLatestRecommendationRun() {
      return latestRun;
    },
    onEvent() {
      return () => {};
    },
  };
  const server = createApp({ workflowService });
  server.listen(0);
  t.after(() => server.close());
  await once(server, "listening");

  const response = await fetch(
    `http://localhost:${server.address().port}/api/auto-merge/replan`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        packageId: "task-context-package:tasks/task-004.yaml",
      }),
    },
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.planned, true);
  assert.equal(payload.recommendationRun.status, "succeeded");
  assert.equal(observedPackageId, "task-context-package:tasks/task-004.yaml");
});

test("workflow service replans accepted work when a no-change package later changes", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("replan-no-change");
  const tasksDir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "replan-no-change-tasks");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, "task-004.yaml"),
    [
      "id: task-004",
      "title: 任务池状态模型",
      "type: design",
      "description: 设计任务池状态",
      "acceptance:",
      "  - 明确状态",
      "",
    ].join("\n"),
  );
  const headCommit = runGit(["rev-parse", "main"], repositoryDir);
  const branchName = "workflow/tasks/tasks-task-004";
  const worktreePath = ".workflow/worktrees/tasks/tasks-task-004";
  const worktreeDir = join(repositoryDir, ".workflow", "worktrees", "tasks", "tasks-task-004");
  runGit(["worktree", "add", "-b", branchName, worktreePath, "main"], repositoryDir);
  const taskContextPackage = {
    packageId: "task-context-package:tasks/task-004.yaml",
    currentWorkStage: "human-decision",
    source: {
      path: "tasks/task-004.yaml",
      format: "yaml",
      contentHash: "unavailable",
    },
    recognition: {
      outcome: "recognized",
      findings: [],
    },
    taskDraft: {
      id: "task-004",
      name: "任务池状态模型",
      kind: "design",
      priority: "normal",
      goal: "设计任务池状态",
      acceptanceCriteria: ["明确状态"],
      maxIterations: "default",
    },
    qualityGate: {
      outcome: "pass",
    },
    artifacts: {
      isolatedWorkspace: {
        artifactId: "isolatedWorkspace",
        body: {
          worktreePath,
          branchName,
          baseBranch: "main",
          baseCommit: headCommit,
          status: "ready",
        },
        appendedAt: "2026-05-19T10:00:00.000Z",
      },
      convergenceSuccess: {
        artifactId: "convergenceSuccess",
        body: {
          summary: "agent reported completion",
          basis: ["executionReport:001", "reviewReport:001"],
        },
        appendedAt: "2026-05-19T10:01:00.000Z",
      },
      humanDecision: {
        artifactId: "humanDecision",
        body: {
          decision: "accept-completion",
          decidedAt: "2026-05-19T10:02:00.000Z",
          convergenceSuccessRef: "convergenceSuccess",
          acceptedWork: {
            isolatedWorkspaceRef: "isolatedWorkspace",
            worktreePath,
            branchName,
            baseCommit: headCommit,
          },
          worktreeSnapshot: {
            cwd: worktreePath,
            changedFiles: [],
          },
          nextRequiredStage: "auto-merge-planning",
        },
        appendedAt: "2026-05-19T10:02:00.000Z",
      },
      autoMergeRejection: {
        artifactId: "autoMergeRejection",
        body: {
          rejectedAt: "2026-05-19T10:03:00.000Z",
          decisionRef: "humanDecision",
          reasons: [
            {
              code: "NO_CHANGES",
              message: "隔离工作树没有可合并变更。",
            },
          ],
        },
        appendedAt: "2026-05-19T10:03:00.000Z",
      },
    },
    agentRuns: [],
    timeline: [],
  };
  await saveTaskContextPackage({
    storeDir: join(repositoryDir, ".workflow", "task-context-packages"),
    taskContextPackage,
  });
  await mkdir(join(worktreeDir, "docs", "definitions"), { recursive: true });
  await writeFile(join(worktreeDir, "docs", "definitions", "task-pool.md"), "task pool state\n");
  const service = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: async () => {
      throw new Error("should not run");
    },
    runExecutionAgentSession: runStubExecutionAgentSession,
  });

  const result = await service.replanAutoMerge({
    packageId: "task-context-package:tasks/task-004.yaml",
  });

  assert.equal(result.planned, true);
  assert.equal(result.error, null);
  assert.equal(result.recommendationRun.taskContextPackage.currentWorkStage, "auto-merge-execution");
  assert.equal(result.recommendationRun.autoMergePlanning.appendRequest.artifactType, "autoMergePlan");
  assert.deepEqual(
    result.recommendationRun.taskContextPackage.artifacts.autoMergePlan.body.changeSet.changedFiles,
    ["docs/definitions/task-pool.md"],
  );
  assert.equal(result.recommendationRun.taskContextPackage.artifacts.autoMergeResult, undefined);
  assert.equal(result.recommendationRun.taskContextPackage.artifacts.taskCloseout, undefined);
  assert.equal(existsSync(worktreeDir), true);
  assert.equal(
    gitSucceeds(["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], repositoryDir),
    true,
  );
});

test("POST /api/server/restart triggers configured restart handler", async (t) => {
  let restartCalled = false;
  const workflowService = {
    onEvent() {
      return () => {};
    },
  };
  const server = createApp({
    workflowService,
    restartServer() {
      restartCalled = true;
    },
  });
  server.listen(0);
  t.after(() => server.close());
  await once(server, "listening");

  const response = await fetch(
    `http://localhost:${server.address().port}/api/server/restart`,
    { method: "POST" },
  );
  const payload = await response.json();

  assert.equal(response.status, 202);
  assert.equal(payload.restarting, true);
  assert.equal(restartCalled, true);
});

test("POST /api/server/restart returns unavailable without restart handler", async (t) => {
  const workflowService = {
    onEvent() {
      return () => {};
    },
  };
  const server = createApp({ workflowService });
  server.listen(0);
  t.after(() => server.close());
  await once(server, "listening");

  const response = await fetch(
    `http://localhost:${server.address().port}/api/server/restart`,
    { method: "POST" },
  );
  const payload = await response.json();

  assert.equal(response.status, 501);
  assert.match(payload.error, /not available/);
});

test("POST /api/test-fixtures/state-stubs seeds test state fixtures", async (t) => {
  let observedFixtureKey = null;
  const workflowService = {
    async seedTestStateFixtures({ fixtureKey }) {
      observedFixtureKey = fixtureKey;
      return {
        count: 1,
        tasks: [
          {
            packageId: "task-context-package:tasks/stub-convergence-failure.yaml",
            sourcePath: "tasks/stub-convergence-failure.yaml",
            currentWorkStage: "human-decision",
          },
        ],
      };
    },
    onEvent() {
      return () => {};
    },
  };
  const server = createApp({ workflowService });
  server.listen(0);
  t.after(() => server.close());
  await once(server, "listening");

  const response = await fetch(
    `http://localhost:${server.address().port}/api/test-fixtures/state-stubs`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ fixtureKey: "convergence-failure" }),
    },
  );
  const payload = await response.json();

  assert.equal(response.status, 201);
  assert.equal(payload.count, 1);
  assert.equal(payload.tasks[0].currentWorkStage, "human-decision");
  assert.equal(observedFixtureKey, "convergence-failure");
});

test("DELETE /api/test-fixtures/state-stubs cleans test state fixtures", async (t) => {
  const workflowService = {
    async cleanupTestStateFixtures() {
      return {
        removedTaskFiles: 1,
        removedPackages: 1,
      };
    },
    onEvent() {
      return () => {};
    },
  };
  const server = createApp({ workflowService });
  server.listen(0);
  t.after(() => server.close());
  await once(server, "listening");

  const response = await fetch(
    `http://localhost:${server.address().port}/api/test-fixtures/state-stubs`,
    { method: "DELETE" },
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.removedTaskFiles, 1);
  assert.equal(payload.removedPackages, 1);
});

test("static assets are not cached during workflow UI development", async (t) => {
  const workflowService = {
    onEvent() {
      return () => {};
    },
  };
  const server = createApp({ workflowService });
  server.listen(0);
  t.after(() => server.close());
  await once(server, "listening");

  const response = await fetch(`http://localhost:${server.address().port}/app.js`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("restart command waits for the current Windows process before starting node", () => {
  const command = restartCommand({
    currentPid: 1234,
    cwd: "D:\\Project\\simple-workflow",
    nodePath: "C:\\Program Files\\nodejs\\node.exe",
    serverPath: "D:\\Project\\simple-workflow\\src\\server\\server.js",
    platform: "win32",
  });

  assert.equal(command.command, "powershell.exe");
  assert.deepEqual(command.args.slice(0, 3), [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
  ]);
  assert.match(command.args.at(-1), /Wait-Process -Id 1234/);
  assert.match(command.args.at(-1), /node\.exe/);
  assert.match(command.args.at(-1), /src\\server\\server\.js/);
  assert.match(command.args.at(-1), /Start-Process/);
  assert.match(command.args.at(-1), /Set-Location/);
  assert.doesNotMatch(command.args.at(-1), /npm/);
});
