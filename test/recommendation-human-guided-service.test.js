import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowService } from "../src/workflow/workflow-service.js";
import { saveTaskContextPackage } from "../src/workflow/task-context-package-store.js";
import {
  createGitRepository,
  runGit,
  writePrompt,
} from "./support/recommendation-service-fixtures.js";

test("workflow service enters execution-agent after human convergence guidance", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("guidance-enters-execution");
  const tasksDir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "guidance-enters-execution-tasks");
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
        executionIntent: {
          artifactId: "executionIntent",
          body: {
            recommendedPackageId: "task-context-package:tasks/task-004.yaml",
          },
          appendedAt: "2026-05-19T10:00:00.000Z",
        },
        executionAuthorization: {
          artifactId: "executionAuthorization",
          body: {
            authorizedAt: "2026-05-19T10:00:30.000Z",
            termination: {
              maxIterations: 2,
            },
          },
          appendedAt: "2026-05-19T10:00:30.000Z",
        },
        isolatedWorkspace: {
          artifactId: "isolatedWorkspace",
          body: {
            worktreePath,
            branchName,
            baseBranch: "main",
            baseCommit: headCommit,
            status: "ready",
          },
          appendedAt: "2026-05-19T10:01:00.000Z",
        },
        convergenceFailure: [
          {
            artifactId: "convergenceFailure:001",
            body: {
              summary: "agent reported non-convergence",
              reasonCode: "needs-human-guidance",
              basisRefs: ["executionReport:001", "reviewReport:001"],
              attemptedFixes: [],
              unresolvedIssues: [],
              humanDecisionQuestion: "提供意见后继续。",
            },
            appendedAt: "2026-05-19T10:02:00.000Z",
          },
        ],
        humanDecisionRequest: {
          artifactId: "humanDecisionRequest",
          body: {
            requestedAt: "2026-05-19T10:02:30.000Z",
            targetRef: "convergenceFailure:001",
            decisionOptions: ["continue-convergence-with-guidance", "cancel-task"],
          },
          appendedAt: "2026-05-19T10:02:30.000Z",
        },
      },
      agentRuns: [
        {
          runId: "main-agent:initialization",
          role: "main",
          sessionId: "stub-main-session:task-004",
          inputArtifactRefs: ["taskDraft", "executionIntent", "executionAuthorization"],
          outputArtifactRefs: [],
          status: "succeeded",
          startedAt: "2026-05-19T10:01:30.000Z",
          finishedAt: "2026-05-19T10:01:40.000Z",
        },
      ],
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
    runExecutionAgentSession: async ({ role, packageId, runId }) => ({
      role,
      packageId,
      sessionId: `stub-failed-session:${runId}`,
      status: "failed",
      summary: "execution failed before making changes",
      tests: [],
      notes: [],
      rawOutput: {
        stdout: "",
        stderr: "fixture execution failure",
        exitCode: 1,
        error: "fixture execution failure",
      },
    }),
  });

  const result = await service.continueConvergenceWithGuidance({
    packageId: "task-context-package:tasks/task-004.yaml",
    guidance: "下一轮先修复状态推进。",
    expectedNextOutcome: "execution agent 能消费人工意见。",
  });

  assert.equal(result.continued, false);
  assert.equal(result.error, "fixture execution failure");
  assert.equal(result.recommendationRun.taskContextPackage.currentWorkStage, "execution-agent");
  assert.equal(result.recommendationRun.taskContextPackage.artifacts.humanConvergenceGuidance[0].artifactId, "humanConvergenceGuidance:001");
  assert.equal(
    result.recommendationRun.taskContextPackage.artifacts.humanConvergenceGuidance[0].body.targetRef,
    "convergenceFailure:001",
  );
  assert.deepEqual(
    result.recommendationRun.taskContextPackage.agentRuns.at(-1).inputArtifactRefs,
    [
      "taskDraft",
      "executionIntent",
      "executionAuthorization",
      "convergenceFailure:001",
      "humanConvergenceGuidance:001",
      "isolatedWorkspace",
    ],
  );
});
