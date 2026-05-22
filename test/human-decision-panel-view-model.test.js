import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildHumanDecisionPanelViewModel,
  decisionMatchesRequest,
  humanDecisionTargetLabel,
} from "../public/human-decision-panel-view-model.js";

test("human decision view model renders a pending convergence success request", () => {
  const request = {
    artifactId: "humanDecisionRequest",
    body: {
      reason: "Agent 已产出 convergenceSuccess，需要人工决定是否接受收敛成功。",
      convergenceSuccessRef: "convergenceSuccess",
      requestedAt: "2026-05-21T10:00:00.000Z",
      decisionOptions: ["accept-convergence", "continue-convergence-with-guidance", "cancel-task"],
    },
  };
  const viewModel = buildHumanDecisionPanelViewModel({
    artifacts: {
      humanDecisionRequest: request,
    },
  });

  assert.equal(humanDecisionTargetLabel(request), "convergenceSuccess:convergenceSuccess");
  assert.equal(viewModel.title, "等待人工决策");
  assert.equal(viewModel.reason, "Agent 已产出 convergenceSuccess，需要人工决定是否接受收敛成功。");
  assert.equal(viewModel.meta, "target: convergenceSuccess:convergenceSuccess · requestedAt: 2026-05-21T10:00:00.000Z");
  assert.deepEqual(viewModel.badges, ["accept-convergence", "continue-convergence-with-guidance", "cancel-task"]);
  assert.equal(viewModel.guidanceForm, true);
  assert.deepEqual(viewModel.actions, ["accept-convergence", "continue-convergence-with-guidance", "cancel-task"]);
});

test("human decision view model renders a pending failure guidance request", () => {
  const viewModel = buildHumanDecisionPanelViewModel({
    artifacts: {
      humanDecisionRequest: {
        artifactId: "humanDecisionRequest",
        body: {
          targetType: "autoMergeFailure",
          targetRef: "autoMergeFailure",
          requestedAt: "2026-05-21T10:01:00.000Z",
          decisionOptions: ["continue-convergence-with-guidance", "cancel-task"],
        },
      },
    },
  });

  assert.equal(viewModel.title, "等待人工决策");
  assert.equal(viewModel.reason, "需要人工确认下一步。");
  assert.equal(viewModel.meta, "target: autoMergeFailure:autoMergeFailure · requestedAt: 2026-05-21T10:01:00.000Z");
  assert.equal(viewModel.guidanceForm, true);
  assert.deepEqual(viewModel.actions, ["continue-convergence-with-guidance", "cancel-task"]);
});

test("human decision view model renders accepted and cancelled decisions", () => {
  const acceptedRequest = {
    artifactId: "humanDecisionRequest",
    body: {
      convergenceSuccessRef: "convergenceSuccess",
      requestedAt: "2026-05-21T10:00:00.000Z",
    },
  };
  const acceptedDecision = {
    artifactId: "humanDecision",
    body: {
      decision: "accept-convergence",
      convergenceSuccessRef: "convergenceSuccess",
      nextRequiredStage: "auto-merge-planning",
      decidedAt: "2026-05-21T10:02:00.000Z",
      worktreeSnapshot: {
        changedFiles: ["src/app.js"],
      },
    },
  };
  const cancelledViewModel = buildHumanDecisionPanelViewModel({
    artifacts: {
      humanDecisionRequest: {
        body: {
          targetType: "autoMergeRejection",
          targetRef: "autoMergeRejection",
        },
      },
      humanDecision: {
        body: {
          decision: "cancel-task",
          targetType: "autoMergeRejection",
          targetRef: "autoMergeRejection",
          nextRequiredStage: "task-closeout",
          decidedAt: "2026-05-21T10:03:00.000Z",
        },
      },
    },
  });
  const acceptedViewModel = buildHumanDecisionPanelViewModel({
    artifacts: {
      humanDecisionRequest: acceptedRequest,
      humanDecision: acceptedDecision,
    },
  });

  assert.equal(decisionMatchesRequest(acceptedDecision, acceptedRequest), true);
  assert.equal(acceptedViewModel.title, "已接受收敛成功");
  assert.equal(acceptedViewModel.reason, "收敛成功证据已由人工接受，等待自动合并环节处理。");
  assert.equal(acceptedViewModel.meta, "decision: accept-convergence · next: auto-merge-planning · decidedAt: 2026-05-21T10:02:00.000Z");
  assert.deepEqual(acceptedViewModel.badges, ["src/app.js"]);
  assert.deepEqual(acceptedViewModel.actions, []);
  assert.equal(cancelledViewModel.title, "已取消任务");
  assert.equal(cancelledViewModel.reason, "人工已决定取消任务，执行侧资源由任务收尾环节清理。");
});

test("human decision view model ignores stale historical decisions", () => {
  const viewModel = buildHumanDecisionPanelViewModel({
    artifacts: {
      humanDecisionRequest: {
        body: {
          targetRef: "convergenceFailure:002",
          decisionOptions: ["continue-convergence-with-guidance", "cancel-task"],
        },
      },
      humanDecision: {
        body: {
          decision: "cancel-task",
          targetRef: "convergenceFailure:001",
        },
      },
    },
  });

  assert.equal(viewModel.title, "等待人工决策");
  assert.equal(viewModel.guidanceForm, true);
  assert.deepEqual(viewModel.actions, ["continue-convergence-with-guidance", "cancel-task"]);
});

test("human decision view model returns null without a request or historical decision", () => {
  assert.equal(buildHumanDecisionPanelViewModel({ artifacts: {} }), null);
  assert.equal(humanDecisionTargetLabel(null), "未生成");
});

test("human decision view model ignores malformed single artifact arrays", () => {
  assert.equal(buildHumanDecisionPanelViewModel({
    artifacts: {
      humanDecisionRequest: [
        {
          body: {
            targetRef: "convergenceFailure:001",
            decisionOptions: ["continue-convergence-with-guidance", "cancel-task"],
          },
        },
      ],
      humanDecision: [
        {
          body: {
            decision: "cancel-task",
            targetRef: "convergenceFailure:001",
          },
        },
      ],
    },
  }), null);
});
