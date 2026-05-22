import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePendingHumanDecisionRequest } from "../src/workflow/human-decision-request-guard.js";
import { createTaskContextPackageFixture } from "./support/task-context-package-fixtures.js";

function artifact(artifactId, body = {}) {
  return {
    artifactId,
    body,
    appendedAt: "2026-05-21T10:00:00.000Z",
  };
}

function taskPackage({
  currentWorkStage = "human-decision",
  decisionOptions = ["accept-convergence", "continue-convergence-with-guidance", "cancel-task"],
  convergenceSuccessRef = "convergenceSuccess",
} = {}) {
  return createTaskContextPackageFixture({
    currentWorkStage,
    artifacts: {
      convergenceSuccess: artifact("convergenceSuccess", { summary: "完成" }),
      humanDecisionRequest: artifact("humanDecisionRequest", {
        convergenceSuccessRef,
        decisionOptions,
      }),
    },
  });
}

test("pending human decision guard resolves the current request target", () => {
  const result = resolvePendingHumanDecisionRequest({
    taskContextPackage: taskPackage(),
    actionLabel: "接受收敛成功",
    requiredTargetKind: "convergenceSuccess",
    requiredOption: "accept-convergence",
  });

  assert.equal(result.error, null);
  assert.equal(result.humanDecisionRequest.artifactId, "humanDecisionRequest");
  assert.equal(result.decisionTarget.kind, "convergenceSuccess");
  assert.equal(result.decisionTarget.artifact.artifactId, "convergenceSuccess");
});

test("pending human decision guard rejects a stale request target", () => {
  const result = resolvePendingHumanDecisionRequest({
    taskContextPackage: taskPackage({ convergenceSuccessRef: "stale-convergenceSuccess" }),
    actionLabel: "接受收敛成功",
    requiredTargetKind: "convergenceSuccess",
    requiredOption: "accept-convergence",
    mismatchedTargetError: "人工决策请求没有指向当前 convergenceSuccess，不能接受收敛成功。",
  });

  assert.equal(result.humanDecisionRequest.artifactId, "humanDecisionRequest");
  assert.equal(result.decisionTarget.kind, "convergenceSuccess");
  assert.equal(result.decisionTarget.artifact.artifactId, "convergenceSuccess");
  assert.equal(result.error, "人工决策请求没有指向当前 convergenceSuccess，不能接受收敛成功。");
});

test("pending human decision guard rejects actions not listed by the request", () => {
  const result = resolvePendingHumanDecisionRequest({
    taskContextPackage: taskPackage({ decisionOptions: ["cancel-task"] }),
    actionLabel: "追加人工收敛意见",
    requiredOption: "continue-convergence-with-guidance",
  });

  assert.equal(result.decisionTarget.kind, "convergenceSuccess");
  assert.match(result.error, /不允许 continue-convergence-with-guidance/);
});

test("pending human decision guard rejects non-human-decision stages", () => {
  const result = resolvePendingHumanDecisionRequest({
    taskContextPackage: taskPackage({ currentWorkStage: "convergence" }),
    actionLabel: "取消任务",
    requiredOption: "cancel-task",
  });

  assert.equal(result.humanDecisionRequest, null);
  assert.equal(result.decisionTarget, null);
  assert.match(result.error, /不在 human-decision 环节/);
});
