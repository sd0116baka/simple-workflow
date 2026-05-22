import { test } from "node:test";
import assert from "node:assert/strict";
import { createHumanDecisionPanel } from "../public/human-decision-panel-renderer.js";
import {
  createFakeDocument,
  findAll,
} from "./support/fake-dom.js";

function pendingGuidancePackage() {
  return {
    artifacts: {
      humanDecisionRequest: {
        artifactId: "humanDecisionRequest",
        body: {
          reason: "需要人工继续指导收敛。",
          targetRef: "convergenceFailure:001",
          requestedAt: "2026-05-21T10:00:00.000Z",
          decisionOptions: ["continue-convergence-with-guidance", "cancel-task"],
        },
      },
    },
  };
}

test("human decision panel renderer creates guidance form and wires continue action", async () => {
  const calls = [];
  const panel = createHumanDecisionPanel(createFakeDocument(), pendingGuidancePackage(), {
    onContinueConvergenceWithGuidance: async (payload) => {
      calls.push(payload);
    },
    onAcceptConvergence: async () => {},
    onCancelTask: async () => {},
  });

  assert.equal(panel.className, "human-decision-notice");
  assert.match(panel.textContent, /等待人工决策/);
  assert.match(panel.textContent, /需要人工继续指导收敛。/);
  assert.match(panel.textContent, /target: convergenceFailure:001/);
  assert.match(panel.textContent, /continue-convergence-with-guidance/);

  const guidanceInput = findAll(panel, (element) => element.dataset.field === "guidance")[0];
  const expectedInput = findAll(panel, (element) => element.dataset.field === "expectedNextOutcome")[0];
  guidanceInput.value = "请聚焦失败测试";
  expectedInput.value = "看到回归测试通过";

  const continueButton = findAll(
    panel,
    (element) => element.tagName === "button" && element.textContent === "带意见继续收敛",
  )[0];
  continueButton.click();
  await Promise.resolve();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].guidance, "请聚焦失败测试");
  assert.equal(calls[0].expectedNextOutcome, "看到回归测试通过");
  assert.equal(calls[0].actionButton, continueButton);
});

test("human decision panel renderer creates accept-only action", async () => {
  let acceptedButton = null;
  const panel = createHumanDecisionPanel(createFakeDocument(), {
    artifacts: {
      humanDecisionRequest: {
        body: {
          convergenceSuccessRef: "convergenceSuccess",
          decisionOptions: ["accept-convergence"],
        },
      },
    },
  }, {
    onAcceptConvergence: async (button) => {
      acceptedButton = button;
    },
    onContinueConvergenceWithGuidance: async () => {},
    onCancelTask: async () => {},
  });

  const buttons = findAll(panel, (element) => element.tagName === "button");
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].textContent, "接受收敛成功");

  buttons[0].click();
  await Promise.resolve();

  assert.equal(acceptedButton, buttons[0]);
});

test("human decision panel renderer renders settled decision without actions", () => {
  const panel = createHumanDecisionPanel(createFakeDocument(), {
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

  assert.match(panel.textContent, /已取消任务/);
  assert.match(panel.textContent, /decision: cancel-task/);
  assert.equal(findAll(panel, (element) => element.tagName === "button").length, 0);
});

test("human decision panel renderer reports async action errors", async () => {
  const errors = [];
  const panel = createHumanDecisionPanel(createFakeDocument(), pendingGuidancePackage(), {
    onContinueConvergenceWithGuidance: async () => {
      throw new Error("guidance failed");
    },
    onAcceptConvergence: async () => {},
    onCancelTask: async () => {},
    showError: (error) => {
      errors.push(error.message);
    },
  });

  findAll(
    panel,
    (element) => element.tagName === "button" && element.textContent === "带意见继续收敛",
  )[0].click();
  await Promise.resolve();

  assert.deepEqual(errors, ["guidance failed"]);
});
