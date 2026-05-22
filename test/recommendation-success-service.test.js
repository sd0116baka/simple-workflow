import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createStubAgentSession } from "../src/workflow/agent-session-contract.js";
import { runStubExecutionAgentSession } from "../src/workflow/execution-agent-stub-session.js";
import { createWorkflowService } from "../src/workflow/workflow-service.js";
import {
  buildIntentJson,
  createGitRepository,
  writePrompt,
} from "./support/recommendation-service-fixtures.js";

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
    runMainAgentSession: createStubAgentSession,
    runExecutionAgentSession: runStubExecutionAgentSession,
    runReviewAgentSession: createStubAgentSession,
    runConvergenceSession: createStubAgentSession,
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
    runMainAgentSession: createStubAgentSession,
    runExecutionAgentSession: runStubExecutionAgentSession,
    runReviewAgentSession: createStubAgentSession,
    runConvergenceSession: createStubAgentSession,
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
    "accept-convergence",
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
    runMainAgentSession: createStubAgentSession,
    runExecutionAgentSession: runStubExecutionAgentSession,
    runReviewAgentSession: createStubAgentSession,
    runConvergenceSession: createStubAgentSession,
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
