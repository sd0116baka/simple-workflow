import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";
import { saveTaskContextPackage } from "./task-context-package-store.js";
import { removeWorkspaceAndBranch } from "./task-closeout-flow.js";

const STAGE_FIXTURES = [
  { id: "stub-task-pool", title: "Stub task-pool", fixtureKey: "task-pool", currentWorkStage: "task-pool" },
  { id: "stub-task-recommender", title: "Stub task-recommender", fixtureKey: "task-recommender", currentWorkStage: "task-recommender" },
  { id: "stub-execution-admission", title: "Stub execution-admission", fixtureKey: "execution-admission", currentWorkStage: "execution-admission" },
  { id: "stub-isolated-workspace", title: "Stub isolated-workspace", fixtureKey: "isolated-workspace", currentWorkStage: "isolated-workspace" },
  { id: "stub-main-agent", title: "Stub main-agent", fixtureKey: "main-agent", currentWorkStage: "main-agent" },
  { id: "stub-execution-agent", title: "Stub execution-agent", fixtureKey: "execution-agent", currentWorkStage: "execution-agent" },
  { id: "stub-review-agent", title: "Stub review-agent", fixtureKey: "review-agent", currentWorkStage: "review-agent" },
  { id: "stub-convergence", title: "Stub convergence", fixtureKey: "convergence", currentWorkStage: "convergence" },
  {
    id: "stub-convergence-success",
    title: "Stub convergence-success",
    fixtureKey: "convergence-success",
    currentWorkStage: "human-decision",
    humanDecisionScenario: "convergence-success",
  },
  {
    id: "stub-convergence-failure",
    title: "Stub convergence-failure",
    fixtureKey: "convergence-failure",
    currentWorkStage: "human-decision",
    humanDecisionScenario: "convergence-failure",
  },
  { id: "stub-auto-merge-planning", title: "Stub auto-merge-planning", fixtureKey: "auto-merge-planning", currentWorkStage: "auto-merge-planning" },
  { id: "stub-auto-merge-execution", title: "Stub auto-merge-execution", fixtureKey: "auto-merge-execution", currentWorkStage: "auto-merge-execution" },
  { id: "stub-merged", title: "Stub merged", fixtureKey: "merged", currentWorkStage: "merged" },
  { id: "stub-closed", title: "Stub closed", fixtureKey: "closed", currentWorkStage: "closed" },
  { id: "stub-cancelled", title: "Stub cancelled", fixtureKey: "cancelled", currentWorkStage: "cancelled" },
];

function assertTestEnvironment(repositoryDir) {
  const normalized = normalize(resolve(repositoryDir)).replace(/\\/g, "/");
  if (!normalized.includes("/.workflow/test-environment/repository")) {
    throw new Error("测试状态种子只能写入 .workflow/test-environment/repository。");
  }
}

function yamlForFixture({ id, title, currentWorkStage }) {
  return [
    `id: ${id}`,
    `title: ${title}`,
    "type: fixture",
    "priority: low",
    `description: 用于测试 ${currentWorkStage} 环节展示的 stub 任务。`,
    "acceptance:",
    `  - 页面可以展示 ${currentWorkStage} 状态`,
    "",
  ].join("\n");
}

function packageIdFor(fileName) {
  return `task-context-package:tasks/${fileName}`;
}

function artifact(artifactId, body, appendedAt) {
  return {
    artifactId,
    body,
    appendedAt,
  };
}

function sourcePathFor(id) {
  return `tasks/${id}.yaml`;
}

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

function fixtureWorktreePath(id) {
  return `.workflow/worktrees/tasks/${id}`;
}

function fixtureBranchName(id) {
  return `workflow/tasks/${id}`;
}

function needsFixtureWorktree({ currentWorkStage }) {
  return ![
    "task-pool",
    "task-recommender",
    "execution-admission",
    "closed",
    "cancelled",
  ].includes(currentWorkStage);
}

async function createFixtureWorktree({ repositoryDir, id }) {
  const branchName = fixtureBranchName(id);
  const worktreePath = fixtureWorktreePath(id);
  const baseCommit = runGit(["rev-parse", "main"], repositoryDir);
  removeWorkspaceAndBranch({ repositoryDir, worktreePath, branchName });
  runGit([
    "worktree",
    "add",
    "-b",
    branchName,
    worktreePath,
    baseCommit,
  ], repositoryDir);
  const absoluteWorktreePath = resolve(repositoryDir, worktreePath);
  await mkdir(join(absoluteWorktreePath, "fixtures"), { recursive: true });
  await writeFile(
    join(absoluteWorktreePath, "fixtures", `${id}.txt`),
    `fixture worktree for ${id}\n`,
    "utf8",
  );
  return {
    baseCommit,
    branchName,
    worktreePath,
  };
}

function basePackage({ id, title, currentWorkStage, timestamp, baseCommit }) {
  const sourcePath = sourcePathFor(id);
  return {
    packageId: packageIdFor(`${id}.yaml`),
    currentWorkStage,
    source: {
      path: sourcePath,
      format: "yaml",
      contentHash: "fixture",
    },
    recognition: {
      outcome: "recognized",
      findings: [],
    },
    taskDraft: {
      id,
      name: title,
      kind: "fixture",
      priority: "low",
      goal: `用于测试 ${currentWorkStage} 环节展示。`,
      acceptanceCriteria: [`页面可以展示 ${currentWorkStage} 状态`],
      maxIterations: 2,
    },
    qualityGate: {
      outcome: "pass",
    },
    artifacts: {},
    agentRuns: [],
    timeline: [],
    fixture: {
      generatedBy: "test-state-seed",
      generatedAt: timestamp,
      baseCommit,
    },
  };
}

function addArtifact(taskPackage, artifactType, record) {
  taskPackage.artifacts[artifactType] = record;
  taskPackage.timeline.push({
    artifactType,
    artifactId: record.artifactId,
    agentRunId: null,
    appendedAt: record.appendedAt,
  });
}

function addMultiArtifact(taskPackage, artifactType, record) {
  taskPackage.artifacts[artifactType] = [
    ...(taskPackage.artifacts[artifactType] ?? []),
    record,
  ];
  taskPackage.timeline.push({
    artifactType,
    artifactId: record.artifactId,
    agentRunId: null,
    appendedAt: record.appendedAt,
  });
}

function addAgentRun(taskPackage, agentRun) {
  taskPackage.agentRuns.push(agentRun);
  taskPackage.timeline.push({
    artifactType: null,
    artifactId: null,
    agentRunId: agentRun.runId,
    appendedAt: agentRun.finishedAt,
  });
}

function populateArtifacts(taskPackage, {
  id,
  currentWorkStage,
  humanDecisionScenario,
  timestamp,
}) {
  if (currentWorkStage === "task-pool") return;

  addArtifact(taskPackage, "executionIntent", artifact("executionIntent", {
    recommendedPackageId: taskPackage.packageId,
    confidence: "fixture",
    selectionReasoning: ["测试状态种子生成。"],
    candidateComparison: [],
    executionBrief: {
      goalInterpretation: taskPackage.taskDraft.goal,
      expectedOutcome: taskPackage.taskDraft.acceptanceCriteria,
      implementationHints: [],
      riskSignals: [],
      openQuestions: [],
    },
  }, timestamp));

  if (currentWorkStage === "task-recommender") return;

  addArtifact(taskPackage, "executionAuthorization", artifact("executionAuthorization", {
    authorizedAt: timestamp,
    runtimeSnapshot: {
      activeWork: null,
      worktree: {
        clean: true,
        changedFiles: [],
      },
    },
    termination: {
      maxIterations: 2,
    },
  }, timestamp));

  if (currentWorkStage === "execution-admission") return;

  addArtifact(taskPackage, "isolatedWorkspace", artifact("isolatedWorkspace", {
    worktreePath: fixtureWorktreePath(id),
    branchName: fixtureBranchName(id),
    baseBranch: "main",
    baseCommit: taskPackage.fixture.baseCommit ?? "fixture-base",
    status: "ready",
  }, timestamp));

  if (currentWorkStage === "isolated-workspace") return;

  addAgentRun(taskPackage, {
    runId: "main-agent:initialization",
    role: "main",
    sessionId: `fixture-main:${id}`,
    inputArtifactRefs: ["taskDraft", "executionIntent", "executionAuthorization"],
    outputArtifactRefs: [],
    status: "succeeded",
    startedAt: timestamp,
    finishedAt: timestamp,
  });

  if (currentWorkStage === "main-agent") return;

  addMultiArtifact(taskPackage, "executionReport", artifact("executionReport:001", {
    summary: "fixture execution report",
    status: "succeeded",
    cwd: `.workflow/worktrees/tasks/${id}`,
    changedFiles: [`fixtures/${id}.txt`],
    tests: [],
    notes: [],
    rawOutput: null,
  }, timestamp));

  addAgentRun(taskPackage, {
    runId: "execution-agent:001",
    role: "execution",
    sessionId: `fixture-execution:${id}`,
    inputArtifactRefs: ["taskDraft", "executionIntent", "executionAuthorization", "isolatedWorkspace"],
    outputArtifactRefs: ["executionReport:001"],
    status: "succeeded",
    startedAt: timestamp,
    finishedAt: timestamp,
  });

  if (currentWorkStage === "execution-agent") return;

  addMultiArtifact(taskPackage, "reviewReport", artifact("reviewReport:001", {
    outcome: humanDecisionScenario === "convergence-failure" ? "failed" : "passed",
    summary: "fixture review report",
    findings: humanDecisionScenario === "convergence-failure"
      ? [{ code: "fixture-not-converged", message: "用于测试收敛失败人工处理。" }]
      : [],
  }, timestamp));

  addAgentRun(taskPackage, {
    runId: "review-agent:001",
    role: "review",
    sessionId: `fixture-review:${id}`,
    inputArtifactRefs: ["taskDraft", "executionAuthorization", "isolatedWorkspace", "executionReport:001"],
    outputArtifactRefs: ["reviewReport:001"],
    status: "succeeded",
    startedAt: timestamp,
    finishedAt: timestamp,
  });

  if (currentWorkStage === "review-agent") return;

  if (humanDecisionScenario === "convergence-failure") {
    addMultiArtifact(taskPackage, "convergenceFailure", artifact("convergenceFailure:001", {
      summary: "fixture convergence failure",
      reasonCode: "fixture-not-converged",
      basisRefs: ["executionReport:001", "reviewReport:001"],
      attemptedFixes: [],
      unresolvedIssues: [{ code: "fixture-not-converged", message: "用于测试人工重试和取消按钮。" }],
      humanDecisionQuestion: "提供人工收敛意见继续，或取消任务。",
      maxIterations: 1,
      completedIterations: 1,
    }, timestamp));
    addAgentRun(taskPackage, {
      runId: "main-agent:convergence:001",
      role: "main",
      sessionId: `fixture-main:${id}`,
      inputArtifactRefs: ["taskDraft", "executionIntent", "executionAuthorization", "executionReport:001", "reviewReport:001"],
      outputArtifactRefs: ["convergenceFailure:001"],
      status: "succeeded",
      startedAt: timestamp,
      finishedAt: timestamp,
    });
    addArtifact(taskPackage, "humanDecisionRequest", artifact("humanDecisionRequest", {
      requestedAt: timestamp,
      reason: "fixture 收敛失败，需要人工处理。",
      targetRef: "convergenceFailure:001",
      decisionOptions: ["retry-with-guidance", "cancel-task"],
    }, timestamp));
    return;
  }

  addMultiArtifact(taskPackage, "convergenceAdvice", artifact("convergenceAdvice:001", {
    summary: "fixture convergence advice",
    nextAction: "继续下一轮测试。",
    basis: ["executionReport:001", "reviewReport:001"],
  }, timestamp));

  addAgentRun(taskPackage, {
    runId: "main-agent:convergence:001",
    role: "main",
    sessionId: `fixture-main:${id}`,
    inputArtifactRefs: ["taskDraft", "executionIntent", "executionAuthorization", "executionReport:001", "reviewReport:001"],
    outputArtifactRefs: ["convergenceAdvice:001"],
    status: "succeeded",
    startedAt: timestamp,
    finishedAt: timestamp,
  });

  if (currentWorkStage === "convergence") return;

  addArtifact(taskPackage, "convergenceSuccess", artifact("convergenceSuccess", {
    summary: "fixture task completed",
    basis: ["executionReport:001", "reviewReport:001"],
  }, timestamp));

  addArtifact(taskPackage, "humanDecisionRequest", artifact("humanDecisionRequest", {
    requestedAt: timestamp,
    reason: "fixture 收敛成功，需要人工接受。",
    convergenceSuccessRef: "convergenceSuccess",
    decisionOptions: ["accept-completion", "request-changes"],
  }, timestamp));

  if (currentWorkStage === "human-decision") return;

  addArtifact(taskPackage, "humanDecision", artifact("humanDecision", {
    decision: "accept-completion",
    decidedAt: timestamp,
    convergenceSuccessRef: "convergenceSuccess",
    acceptedWork: {
      isolatedWorkspaceRef: "isolatedWorkspace",
      worktreePath: `.workflow/worktrees/tasks/${id}`,
      branchName: fixtureBranchName(id),
      baseCommit: taskPackage.fixture.baseCommit ?? "fixture-base",
    },
    worktreeSnapshot: {
      cwd: `.workflow/worktrees/tasks/${id}`,
      changedFiles: [`fixtures/${id}.txt`],
    },
    nextRequiredStage: "auto-merge-planning",
  }, timestamp));

  if (currentWorkStage === "auto-merge-planning") return;

  addArtifact(taskPackage, "autoMergePlan", artifact("autoMergePlan", {
    plannedAt: timestamp,
    decisionRef: "humanDecision",
    source: {
      worktreePath: `.workflow/worktrees/tasks/${id}`,
      branchName: fixtureBranchName(id),
    },
    target: {
      branchName: "main",
    },
    changeSet: {
      changedFiles: [`fixtures/${id}.txt`],
    },
    checks: [],
  }, timestamp));

  if (currentWorkStage === "auto-merge-execution") return;

  addArtifact(taskPackage, "autoMergeResult", artifact("autoMergeResult", {
    mergedAt: timestamp,
    decisionRef: "humanDecision",
    source: {
      branchName: fixtureBranchName(id),
      commit: "fixture-commit",
    },
    target: {
      branchName: "main",
      beforeCommit: "fixture-base",
      afterCommit: "fixture-commit",
    },
  }, timestamp));

  if (currentWorkStage === "merged") return;

  if (currentWorkStage === "closed") {
    addArtifact(taskPackage, "taskCloseout", artifact("taskCloseout", {
      closedAt: timestamp,
      resultRef: "autoMergeResult",
      cleanup: {
        worktree: {
          path: `.workflow/worktrees/tasks/${id}`,
          removed: true,
        },
        branch: {
          name: fixtureBranchName(id),
          deleted: true,
        },
      },
      finalStage: "closed",
    }, timestamp));
    return;
  }

  if (currentWorkStage === "cancelled") {
    taskPackage.artifacts = {};
    taskPackage.agentRuns = [];
    taskPackage.timeline = [];
    addMultiArtifact(taskPackage, "convergenceFailure", artifact("convergenceFailure:001", {
      summary: "fixture cancelled convergence failure",
      reasonCode: "fixture-cancelled",
      basisRefs: [],
      attemptedFixes: [],
      unresolvedIssues: [],
      humanDecisionQuestion: "fixture 已取消。",
    }, timestamp));
    addArtifact(taskPackage, "humanDecisionRequest", artifact("humanDecisionRequest", {
      requestedAt: timestamp,
      reason: "fixture 取消请求。",
      targetRef: "convergenceFailure:001",
      decisionOptions: ["retry-with-guidance", "cancel-task"],
    }, timestamp));
    addArtifact(taskPackage, "humanDecision", artifact("humanDecision", {
      decision: "cancel-task",
      decidedAt: timestamp,
      targetRef: "convergenceFailure:001",
      restoredExecutionState: {
        restored: true,
      },
      finalStage: "cancelled",
    }, timestamp));
  }
}

export async function seedTestStateFixtures({
  repositoryDir,
  tasksDir,
  storeDir,
  fixtureKey,
  now = () => new Date().toISOString(),
} = {}) {
  if (!repositoryDir || !tasksDir || !storeDir) {
    throw new Error("repositoryDir, tasksDir and storeDir are required");
  }
  assertTestEnvironment(repositoryDir);
  await mkdir(tasksDir, { recursive: true });
  await cleanupTestStateFixtures({ repositoryDir, tasksDir, storeDir });

  const timestamp = now();
  const fixture = STAGE_FIXTURES.find((item) => item.fixtureKey === fixtureKey)
    ?? STAGE_FIXTURES[0];
  const fixtureResources = needsFixtureWorktree(fixture)
    ? await createFixtureWorktree({ repositoryDir, id: fixture.id })
    : {};
  const runtimeFixture = {
    ...fixture,
    baseCommit: fixtureResources.baseCommit,
  };
  const fileName = `${fixture.id}.yaml`;
  await writeFile(join(tasksDir, fileName), yamlForFixture(runtimeFixture), "utf8");
  const taskPackage = basePackage({ ...runtimeFixture, timestamp });
  populateArtifacts(taskPackage, { ...runtimeFixture, timestamp });
  await saveTaskContextPackage({
    storeDir,
    taskContextPackage: taskPackage,
  });

  return {
    generatedAt: timestamp,
    count: 1,
    tasks: [
      {
        packageId: taskPackage.packageId,
        sourcePath: taskPackage.source.path,
        currentWorkStage: taskPackage.currentWorkStage,
      },
    ],
  };
}

async function removeExistingStubTaskFiles(tasksDir) {
  let entries = [];
  try {
    entries = await readdir(tasksDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }

  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !/^stub-.*\.ya?ml$/i.test(entry.name)) continue;
    await rm(join(tasksDir, entry.name), { force: true });
    removed += 1;
  }
  return removed;
}

async function removeExistingStubPackages(storeDir) {
  let entries = [];
  try {
    entries = await readdir(storeDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }

  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !/^tasks-stub-.*\.ya?ml\.json$/i.test(entry.name)) continue;
    await rm(join(storeDir, entry.name), { force: true });
    removed += 1;
  }
  return removed;
}

function removeExistingStubWorktrees(repositoryDir) {
  if (!gitSucceeds(["rev-parse", "--git-dir"], repositoryDir)) return 0;
  let removed = 0;
  for (const fixture of STAGE_FIXTURES) {
    const absoluteWorktreePath = resolve(repositoryDir, fixtureWorktreePath(fixture.id));
    const branchName = fixtureBranchName(fixture.id);
    const existed = existsSync(absoluteWorktreePath)
      || gitSucceeds(["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], repositoryDir);
    const result = removeWorkspaceAndBranch({
      repositoryDir,
      worktreePath: fixtureWorktreePath(fixture.id),
      branchName,
    });
    if (existed && !result.error) removed += 1;
  }
  return removed;
}

export async function cleanupTestStateFixtures({
  repositoryDir,
  tasksDir,
  storeDir,
} = {}) {
  if (!repositoryDir || !tasksDir || !storeDir) {
    throw new Error("repositoryDir, tasksDir and storeDir are required");
  }
  assertTestEnvironment(repositoryDir);
  const removedWorktrees = removeExistingStubWorktrees(repositoryDir);
  const removedTaskFiles = await removeExistingStubTaskFiles(tasksDir);
  const removedPackages = await removeExistingStubPackages(storeDir);

  return {
    removedTaskFiles,
    removedPackages,
    removedWorktrees,
  };
}
