import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { runStubExecutionAgentSession } from "../src/workflow/execution-agent-stub-session.js";
import { createWorkflowService } from "../src/workflow/workflow-service.js";
import { saveTaskContextPackage } from "../src/workflow/task-context-package-store.js";
import {
  createGitRepository,
  gitSucceeds,
  runGit,
  writePrompt,
} from "./support/recommendation-service-fixtures.js";

test("accepting convergence requests human decision when auto-merge planning rejects", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("accept-auto-merge-rejection");
  const tasksDir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "accept-auto-merge-rejection-tasks");
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
  runGit(["worktree", "add", "-b", branchName, worktreePath, "main"], repositoryDir);
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
        humanDecisionRequest: {
          artifactId: "humanDecisionRequest",
          body: {
            requestedAt: "2026-05-19T10:01:30.000Z",
            convergenceSuccessRef: "convergenceSuccess",
            decisionOptions: ["accept-convergence", "continue-convergence-with-guidance", "cancel-task"],
          },
          appendedAt: "2026-05-19T10:01:30.000Z",
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
    runExecutionAgentSession: runStubExecutionAgentSession,
  });

  const result = await service.acceptConvergenceSuccess({
    packageId: "task-context-package:tasks/task-004.yaml",
  });

  assert.equal(result.accepted, true);
  assert.equal(result.planned, false);
  assert.equal(result.executed, false);
  assert.equal(result.closed, false);
  assert.equal(result.error, null);
  assert.equal(result.recommendationRun.taskContextPackage.currentWorkStage, "human-decision");
  assert.equal(result.recommendationRun.autoMergePlanning.appendRequest.artifactType, "autoMergeRejection");
  assert.equal(result.recommendationRun.autoMergeHumanDecisionRequest.appendRequest.artifactType, "humanDecisionRequest");
  assert.equal(
    result.recommendationRun.taskContextPackage.artifacts.humanDecisionRequest.body.targetType,
    "autoMergeRejection",
  );
  assert.equal(
    result.recommendationRun.taskContextPackage.artifacts.humanDecisionRequest.body.targetRef,
    "autoMergeRejection",
  );
  assert.deepEqual(
    result.recommendationRun.taskContextPackage.artifacts.humanDecisionRequest.body.decisionOptions,
    ["continue-convergence-with-guidance", "cancel-task"],
  );

  const cancellation = await service.cancelTask({
    packageId: "task-context-package:tasks/task-004.yaml",
  });

  assert.equal(cancellation.cancelled, true);
  assert.equal(cancellation.error, null);
  assert.equal(cancellation.recommendationRun.taskContextPackage.currentWorkStage, "cancelled");
  assert.equal(
    cancellation.recommendationRun.taskContextPackage.artifacts.humanDecision.body.targetType,
    "autoMergeRejection",
  );
  assert.equal(
    cancellation.recommendationRun.taskContextPackage.artifacts.taskCloseout.body.closeoutReason,
    "cancelled",
  );
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
          decision: "accept-convergence",
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
