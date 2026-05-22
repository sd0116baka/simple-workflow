import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAutoMergeExecutionPanel,
  createAutoMergeListPanel,
  createAutoMergePanel,
  createTaskCloseoutPanel,
} from "../public/auto-merge-panel-renderer.js";
import {
  createFakeDocument,
  findAll,
} from "./support/fake-dom.js";

test("auto merge panel renderer creates planning DOM", () => {
  const panel = createAutoMergePanel(createFakeDocument(), {
    artifacts: {
      autoMergePlan: {
        artifactId: "autoMergePlan",
        body: {
          target: { branchName: "main" },
          plannedAt: "2026-05-21T10:00:00.000Z",
          changeSet: {
            changedFiles: ["src/workflow.js", "test/workflow.test.js"],
          },
        },
      },
    },
  });

  assert.equal(panel.className, "auto-merge-panel autoMergePlan");
  assert.match(panel.textContent, /已生成自动合并计划/);
  assert.match(panel.textContent, /target: main/);
  assert.match(panel.textContent, /src\/workflow\.js/);
  assert.equal(findAll(panel, (element) => element.className === "auto-merge-list").length, 1);
});

test("auto merge panel renderer creates execution failure DOM", () => {
  const panel = createAutoMergeExecutionPanel(createFakeDocument(), {
    artifacts: {
      autoMergeFailure: {
        artifactId: "autoMergeFailure",
        body: {
          planRef: "autoMergePlan",
          failedAt: "2026-05-21T10:05:00.000Z",
          reasons: [
            { code: "TARGET_MOVED", message: "目标分支已移动。" },
          ],
        },
      },
    },
  });

  assert.equal(panel.className, "auto-merge-panel autoMergeFailure");
  assert.match(panel.textContent, /自动合并执行失败/);
  assert.match(panel.textContent, /planRef: autoMergePlan/);
  assert.match(panel.textContent, /TARGET_MOVED: 目标分支已移动。/);
});

test("auto merge panel renderer creates closeout DOM and keeps list fallback", () => {
  const documentRef = createFakeDocument();
  const closeout = createTaskCloseoutPanel(documentRef, {
    artifacts: {
      taskCloseout: {
        body: {
          finalStage: "closed",
          closeoutAt: "2026-05-21T10:10:00.000Z",
          cleanup: {
            worktree: { path: ".workflow/worktrees/task-001", removed: true },
            branch: { name: "workflow/task-001", deleted: true },
          },
        },
      },
    },
  });
  const fallback = createAutoMergeListPanel(documentRef, {
    className: "auto-merge-panel autoMergePlan",
    title: "合并计划已生成",
    meta: "自动合并计划已生成。",
    listItems: [],
  });

  assert.equal(closeout.className, "auto-merge-panel taskCloseout");
  assert.match(closeout.textContent, /任务已关闭并收尾/);
  assert.match(closeout.textContent, /worktree: \.workflow\/worktrees\/task-001 · removed: true/);
  assert.match(closeout.textContent, /branch: workflow\/task-001 · deleted: true/);
  assert.equal(fallback.className, "auto-merge-panel autoMergePlan");
  assert.match(fallback.textContent, /合并计划已生成/);
});
