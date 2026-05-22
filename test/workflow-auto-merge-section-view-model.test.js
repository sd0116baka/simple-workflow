import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAutoMergeSectionViewModel } from "../public/workflow-auto-merge-section-view-model.js";
import {
  artifact,
  packageWith,
} from "./support/workflow-section-view-model-fixtures.js";

test("auto merge section distinguishes cancellation, planning, plan, rejection, and waiting states", () => {
  const cancelled = buildAutoMergeSectionViewModel(packageWith({ stage: "cancelled" }));
  assert.equal(cancelled.statusText, "已取消");
  assert.equal(cancelled.text, "任务已取消，不需要自动合并。");

  const planning = buildAutoMergeSectionViewModel(packageWith({ stage: "auto-merge-planning" }));
  assert.equal(planning.statusText, "自动检查中");
  assert.equal(planning.text, "人工已接受收敛成功，系统正在生成自动合并计划。");

  const plan = buildAutoMergeSectionViewModel(packageWith({
    stage: "auto-merge-execution",
    artifacts: {
      humanDecision: artifact("humanDecision:001", { decision: "accept-convergence" }),
      autoMergePlan: artifact("autoMergePlan:001", { changeSet: { changedFiles: [] } }),
    },
  }));
  assert.equal(plan.statusText, "可执行合并");
  assert.deepEqual(plan.panel, { kind: "autoMergePlan" });
  assert.equal(plan.inputs[2].value, "autoMergePlan:001");

  const failedPlan = buildAutoMergeSectionViewModel(packageWith({
    artifacts: {
      autoMergePlan: artifact("autoMergePlan:001", { changeSet: { changedFiles: [] } }),
      autoMergeFailure: artifact("autoMergeFailure:001"),
    },
  }));
  assert.equal(failedPlan.statusText, "计划已生成");

  const rejection = buildAutoMergeSectionViewModel(packageWith({
    artifacts: { autoMergeRejection: artifact("autoMergeRejection:001") },
  }));
  assert.equal(rejection.statusText, "未通过");
  assert.deepEqual(rejection.panel, { kind: "autoMergePlan" });

  const waiting = buildAutoMergeSectionViewModel(packageWith({
    artifacts: { humanDecision: artifact("humanDecision:001", { decision: "accept-convergence" }) },
  }));
  assert.equal(waiting.statusText, "等待自动合并");
  assert.equal(waiting.text, "等待任务进入 auto-merge-planning 环节。");
});

test("auto merge section ignores malformed single artifact arrays", () => {
  const autoMerge = buildAutoMergeSectionViewModel(packageWith({
    artifacts: {
      humanDecision: [artifact("humanDecision:001", { decision: "accept-convergence" })],
      autoMergePlan: [artifact("autoMergePlan:001")],
      autoMergeRejection: [artifact("autoMergeRejection:001")],
    },
  }));

  assert.equal(autoMerge.statusText, "等待输入");
  assert.equal(autoMerge.panel, null);
});
