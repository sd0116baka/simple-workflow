import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHumanDecisionSectionViewModel } from "../public/workflow-human-decision-section-view-model.js";
import {
  artifact,
  packageWith,
} from "./support/workflow-section-view-model-fixtures.js";

test("human decision section summarizes pending, accepted, and missing requests", () => {
  const pendingRequest = artifact("humanDecisionRequest:001", {
    targetType: "autoMergeRejection",
    targetRef: "autoMergeRejection:001",
    decisionOptions: ["continue-convergence-with-guidance", "cancel-task"],
  });
  const pending = buildHumanDecisionSectionViewModel(packageWith({
    stage: "human-decision",
    artifacts: { humanDecisionRequest: pendingRequest },
  }));
  assert.equal(pending.statusText, "等待人工决策");
  assert.deepEqual(pending.panel, { kind: "humanDecision" });
  assert.equal(pending.inputs[0].value, "autoMergeRejection:autoMergeRejection:001");
  assert.equal(pending.inputs[1].value, "humanDecisionRequest:001");

  const decision = artifact("humanDecision:001", {
    targetType: "autoMergeRejection",
    targetRef: "autoMergeRejection:001",
    decision: "cancel-task",
  });
  const accepted = buildHumanDecisionSectionViewModel(packageWith({
    stage: "cancelled",
    artifacts: { humanDecisionRequest: pendingRequest, humanDecision: decision },
  }));
  assert.equal(accepted.statusText, "已取消");
  assert.deepEqual(accepted.panel, { kind: "humanDecision" });
  assert.equal(accepted.inputs[2].value, "cancel-task");

  const missing = buildHumanDecisionSectionViewModel(packageWith({
    artifacts: { convergenceSuccess: artifact("convergenceSuccess:001") },
  }));
  assert.equal(missing.statusText, "未请求");
  assert.equal(missing.text, "已生成收敛成功证据，但尚未请求人工决策。");
  assert.equal(missing.panel, null);
});

test("human decision section ignores malformed single artifact arrays", () => {
  const humanDecision = buildHumanDecisionSectionViewModel(packageWith({
    artifacts: {
      humanDecisionRequest: [
        artifact("humanDecisionRequest:001", { targetRef: "convergenceFailure:001" }),
      ],
      humanDecision: [
        artifact("humanDecision:001", {
          decision: "cancel-task",
          targetRef: "convergenceFailure:001",
        }),
      ],
    },
  }));

  assert.equal(humanDecision.statusText, "等待收敛结果");
  assert.equal(humanDecision.panel, null);
});
