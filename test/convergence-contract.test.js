import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildConvergenceAdviceRequest,
  buildConvergenceFailureRequest,
  buildConvergenceSuccessRequest,
} from "../src/workflow/convergence-contract.js";
import { createTaskContextPackageFixture } from "./support/task-context-package-fixtures.js";

const taskContextPackage = createTaskContextPackageFixture({
  packageId: "task-context-package:tasks/task-003.yaml",
});

const executionReport = {
  artifactId: "executionReport:002",
  body: {},
};

const reviewReport = {
  artifactId: "reviewReport:002",
  body: {
    findings: [{ code: "still-broken" }],
  },
};

const commonInput = {
  taskContextPackage,
  runId: "main-agent:convergence:002",
  session: {
    sessionId: "session:main",
  },
  inputArtifactRefs: [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
    "convergenceAdvice:001",
    "executionReport:002",
    "reviewReport:002",
  ],
  executionReport,
  reviewReport,
  startedAt: "2026-05-21T13:00:00.000Z",
  finishedAt: "2026-05-21T13:01:00.000Z",
};

test("builds convergence advice append request", () => {
  const appendRequest = buildConvergenceAdviceRequest(commonInput);

  assert.deepEqual(appendRequest, {
    packageId: "task-context-package:tasks/task-003.yaml",
    artifactType: "convergenceAdvice",
    artifact: {
      summary: "stub convergence advice",
      nextAction: "等待真实 main agent 根据执行和审查结果给出下一轮执行意见。",
      basis: ["executionReport:002", "reviewReport:002"],
    },
    agentRun: {
      runId: "main-agent:convergence:002",
      role: "main",
      sessionId: "session:main",
      inputArtifactRefs: commonInput.inputArtifactRefs,
      outputArtifactRefs: [],
      status: "succeeded",
      startedAt: "2026-05-21T13:00:00.000Z",
      finishedAt: "2026-05-21T13:01:00.000Z",
    },
  });
});

test("builds convergence success append request", () => {
  const appendRequest = buildConvergenceSuccessRequest({
    ...commonInput,
    summary: "task converged",
  });

  assert.equal(appendRequest.artifactType, "convergenceSuccess");
  assert.deepEqual(appendRequest.artifact, {
    summary: "task converged",
    basis: ["executionReport:002", "reviewReport:002"],
  });
  assert.equal(appendRequest.agentRun.status, "succeeded");
});

test("builds convergence failure append request", () => {
  const appendRequest = buildConvergenceFailureRequest({
    ...commonInput,
    attemptedFixRefs: ["convergenceAdvice:001"],
    maxIterations: 1,
    completedIterations: 1,
  });

  assert.deepEqual(appendRequest.artifact, {
    summary: "当前轮次无法自动收敛。",
    reasonCode: "max-iterations-reached",
    basisRefs: ["executionReport:002", "reviewReport:002"],
    attemptedFixes: ["convergenceAdvice:001"],
    unresolvedIssues: [{ code: "still-broken" }],
    humanDecisionQuestion: "请提供人工收敛意见继续下一轮，或取消任务并恢复执行前状态。",
    maxIterations: 1,
    completedIterations: 1,
  });
});
