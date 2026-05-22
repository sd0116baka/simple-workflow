import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStartupCheckViewModel } from "../public/workflow-overview-startup-check-view-model.js";

test("overview startup check view model renders empty state", () => {
  const empty = buildStartupCheckViewModel();

  assert.equal(empty.statusText, "未载入");
  assert.equal(empty.emptyText, "未返回启动检查。");
});

test("overview startup check view model renders pass state", () => {
  const pass = buildStartupCheckViewModel({
    canStartWork: true,
    findings: [],
    runtimeSnapshot: {
      activeWork: null,
      worktree: { clean: true, changedFiles: [] },
    },
  });

  assert.equal(pass.statusText, "可启动");
  assert.deepEqual(pass.summary, {
    className: "startup-check-summary pass",
    text: "当前可以启动新任务。",
  });
  assert.deepEqual(pass.metrics, [
    { label: "canStartWork", value: "true" },
    { label: "git", value: "clean" },
    { label: "git changes", value: "0" },
  ]);
});

test("overview startup check view model renders fail state", () => {
  const fail = buildStartupCheckViewModel({
    canStartWork: false,
    findings: [{ code: "WORKTREE_DIRTY", message: "工作区有未提交变更" }],
    runtimeSnapshot: {
      activeWork: { packageId: "task-context-package:tasks/task-001.yaml" },
      worktree: {
        clean: false,
        changedFiles: ["a.txt", "b.txt", "c.txt", "d.txt", "e.txt", "f.txt", "g.txt"],
      },
    },
  });

  assert.equal(fail.statusText, "不可启动");
  assert.equal(fail.inputs[1].value, "存在");
  assert.equal(fail.inputs[2].value, "dirty/unknown");
  assert.deepEqual(fail.findings, ["WORKTREE_DIRTY: 工作区有未提交变更"]);
  assert.deepEqual(fail.changedFiles, ["a.txt", "b.txt", "c.txt", "d.txt", "e.txt", "f.txt"]);
});
