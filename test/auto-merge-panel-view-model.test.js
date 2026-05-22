import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAutoMergeExecutionViewModel,
  buildAutoMergePlanningViewModel,
  buildTaskCloseoutViewModel,
} from "../public/auto-merge-panel-view-model.js";

test("auto merge planning view model summarizes a merge plan", () => {
  const viewModel = buildAutoMergePlanningViewModel({
    artifacts: {
      autoMergePlan: {
        artifactId: "autoMergePlan",
        appendedAt: "2026-05-21T10:00:00.000Z",
        body: {
          plannedAt: "2026-05-21T10:00:01.000Z",
          target: {
            branchName: "main",
          },
          changeSet: {
            changedFiles: ["src/workflow.js", "test/workflow.test.js"],
          },
        },
      },
    },
  });

  assert.equal(viewModel.className, "auto-merge-panel autoMergePlan");
  assert.equal(viewModel.title, "已生成自动合并计划");
  assert.equal(viewModel.meta, "target: main · changes: 2 · plannedAt: 2026-05-21T10:00:01.000Z");
  assert.deepEqual(viewModel.listItems, ["src/workflow.js", "test/workflow.test.js"]);
});

test("auto merge planning view model summarizes a rejection", () => {
  const viewModel = buildAutoMergePlanningViewModel({
    artifacts: {
      autoMergeRejection: {
        artifactId: "autoMergeRejection",
        appendedAt: "2026-05-21T10:00:00.000Z",
        body: {
          decisionRef: "humanDecision",
          reasons: [
            {
              code: "NO_CHANGES",
              message: "隔离工作树没有可合并变更。",
            },
          ],
        },
      },
    },
  });

  assert.equal(viewModel.className, "auto-merge-panel autoMergeRejection");
  assert.equal(viewModel.title, "自动合并前置校验未通过");
  assert.equal(viewModel.meta, "decisionRef: humanDecision · rejectedAt: 2026-05-21T10:00:00.000Z");
  assert.deepEqual(viewModel.listItems, ["NO_CHANGES: 隔离工作树没有可合并变更。"]);
});

test("auto merge execution view model summarizes result and failure records", () => {
  const resultViewModel = buildAutoMergeExecutionViewModel({
    artifacts: {
      autoMergeResult: {
        body: {
          mergedAt: "2026-05-21T10:05:00.000Z",
          target: {
            branchName: "main",
            afterCommit: "1234567890abcdef",
          },
          changeSet: {
            changedFiles: ["README.md"],
          },
        },
      },
    },
  });
  const failureViewModel = buildAutoMergeExecutionViewModel({
    artifacts: {
      autoMergeFailure: {
        body: {
          planRef: "autoMergePlan",
          failedAt: "2026-05-21T10:06:00.000Z",
          reasons: [
            {
              code: "TARGET_MOVED",
              message: "目标分支已移动。",
            },
          ],
        },
      },
    },
  });

  assert.equal(resultViewModel.className, "auto-merge-panel autoMergeResult");
  assert.equal(resultViewModel.title, "已合入目标分支");
  assert.equal(resultViewModel.meta, "target: main · after: 1234567 · mergedAt: 2026-05-21T10:05:00.000Z");
  assert.deepEqual(resultViewModel.listItems, ["README.md"]);
  assert.equal(failureViewModel.className, "auto-merge-panel autoMergeFailure");
  assert.equal(failureViewModel.title, "自动合并执行失败");
  assert.deepEqual(failureViewModel.listItems, ["TARGET_MOVED: 目标分支已移动。"]);
});

test("task closeout view model summarizes cleanup state", () => {
  const viewModel = buildTaskCloseoutViewModel({
    artifacts: {
      taskCloseout: {
        body: {
          finalStage: "cancelled",
          closeoutReason: "cancelled-by-human",
          closeoutAt: "2026-05-21T10:07:00.000Z",
          cleanup: {
            worktree: {
              path: ".workflow/worktrees/task-001",
              removed: true,
            },
            branch: {
              name: "workflow/task-001",
              deleted: false,
            },
          },
        },
      },
    },
  });

  assert.equal(viewModel.className, "auto-merge-panel taskCloseout");
  assert.equal(viewModel.title, "任务已取消并收尾");
  assert.equal(viewModel.meta, "finalStage: cancelled · reason: cancelled-by-human · closeoutAt: 2026-05-21T10:07:00.000Z");
  assert.deepEqual(viewModel.listItems, [
    "worktree: .workflow/worktrees/task-001 · removed: true",
    "branch: workflow/task-001 · deleted: false",
  ]);
});

test("auto merge view models return null when the expected artifact is missing", () => {
  assert.equal(buildAutoMergePlanningViewModel({ artifacts: {} }), null);
  assert.equal(buildAutoMergeExecutionViewModel({ artifacts: {} }), null);
  assert.equal(buildTaskCloseoutViewModel({ artifacts: {} }), null);
});

test("auto merge view models ignore malformed single artifact arrays", () => {
  assert.equal(buildAutoMergePlanningViewModel({
    artifacts: {
      autoMergePlan: [
        { body: { target: { branchName: "main" } } },
      ],
    },
  }), null);
  assert.equal(buildAutoMergeExecutionViewModel({
    artifacts: {
      autoMergeResult: [
        { body: { target: { branchName: "main" } } },
      ],
    },
  }), null);
  assert.equal(buildTaskCloseoutViewModel({
    artifacts: {
      taskCloseout: [
        { body: { finalStage: "closed" } },
      ],
    },
  }), null);
});
