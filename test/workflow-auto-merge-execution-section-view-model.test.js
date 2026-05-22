import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAutoMergeExecutionSectionViewModel } from "../public/workflow-auto-merge-execution-section-view-model.js";
import {
  artifact,
  packageWith,
} from "./support/workflow-section-view-model-fixtures.js";

test("auto merge execution section summarizes result, failure, execution pending, and waiting states", () => {
  const result = buildAutoMergeExecutionSectionViewModel(packageWith({
    artifacts: { autoMergeResult: artifact("autoMergeResult:001") },
  }));
  assert.equal(result.statusText, "已合并");
  assert.deepEqual(result.panel, { kind: "autoMergeExecution" });

  const failure = buildAutoMergeExecutionSectionViewModel(packageWith({
    artifacts: { autoMergeFailure: artifact("autoMergeFailure:001") },
  }));
  assert.equal(failure.statusText, "失败");
  assert.deepEqual(failure.panel, { kind: "autoMergeExecution" });

  const pending = buildAutoMergeExecutionSectionViewModel(packageWith({
    stage: "auto-merge-execution",
    artifacts: { autoMergePlan: artifact("autoMergePlan:001") },
  }));
  assert.equal(pending.statusText, "等待执行");
  assert.equal(pending.panel.kind, "list");
  assert.equal(pending.panel.viewModel.title, "合并计划已生成");

  const waiting = buildAutoMergeExecutionSectionViewModel(packageWith({
    artifacts: { autoMergePlan: artifact("autoMergePlan:001") },
  }));
  assert.equal(waiting.statusText, "等待执行");
  assert.equal(waiting.text, "等待任务进入 auto-merge-execution 环节。");

  const cancelled = buildAutoMergeExecutionSectionViewModel(packageWith({ stage: "cancelled" }));
  assert.equal(cancelled.statusText, "已取消");
  assert.equal(cancelled.text, "任务已取消，不需要执行自动合并。");
});

test("auto merge execution section ignores malformed single artifact arrays", () => {
  const autoMergeExecution = buildAutoMergeExecutionSectionViewModel(packageWith({
    artifacts: {
      autoMergePlan: [artifact("autoMergePlan:001")],
      autoMergeResult: [artifact("autoMergeResult:001")],
      autoMergeFailure: [artifact("autoMergeFailure:001")],
    },
  }));

  assert.equal(autoMergeExecution.statusText, "等待输入");
  assert.equal(autoMergeExecution.panel, null);
});
