import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTaskCloseoutSectionViewModel } from "../public/workflow-task-closeout-section-view-model.js";
import {
  artifact,
  packageWith,
} from "./support/workflow-section-view-model-fixtures.js";

test("task closeout section summarizes closeout, terminal, merged, and waiting states", () => {
  const closeout = buildTaskCloseoutSectionViewModel(packageWith({
    artifacts: { taskCloseout: artifact("taskCloseout:001", { finalStage: "closed" }) },
  }));
  assert.equal(closeout.statusText, "已关闭");
  assert.deepEqual(closeout.panel, { kind: "taskCloseout" });

  const cancelled = buildTaskCloseoutSectionViewModel(packageWith({ stage: "cancelled" }));
  assert.equal(cancelled.statusText, "已取消");
  assert.equal(cancelled.text, "任务已取消。");

  const merged = buildTaskCloseoutSectionViewModel(packageWith({ stage: "merged" }));
  assert.equal(merged.statusText, "收尾中");
  assert.equal(merged.text, "自动合并已完成，系统正在清理隔离工作树和任务分支。");

  const waiting = buildTaskCloseoutSectionViewModel(packageWith({
    artifacts: { autoMergeResult: artifact("autoMergeResult:001") },
  }));
  assert.equal(waiting.statusText, "等待收尾");
  assert.equal(waiting.text, "等待任务进入 merged 环节。");
  assert.equal(waiting.inputs[0].value, "autoMergeResult:001");
});

test("task closeout section ignores malformed single artifact arrays", () => {
  const closeout = buildTaskCloseoutSectionViewModel(packageWith({
    artifacts: {
      autoMergeResult: [artifact("autoMergeResult:001")],
      taskCloseout: [artifact("taskCloseout:001", { finalStage: "closed" })],
    },
  }));

  assert.equal(closeout.statusText, "等待输入");
  assert.equal(closeout.panel, null);
});
