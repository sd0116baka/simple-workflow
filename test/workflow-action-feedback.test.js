import { test } from "node:test";
import assert from "node:assert/strict";
import {
  beginActionFeedback,
  findActionFeedbackTarget,
  isActionFeedbackPending,
  resetActionFeedback,
  scheduleActionFeedbackReset,
  setFeedbackText,
  updateActionFeedback,
} from "../public/workflow-action-feedback.js";

function button() {
  return {
    dataset: {},
    disabled: false,
    hidden: false,
    textContent: "",
  };
}

test("action feedback begins, guards, and resets pending button state", () => {
  const actionButton = button();

  beginActionFeedback(actionButton, { text: "规划中", pending: true });

  assert.equal(actionButton.disabled, true);
  assert.equal(actionButton.textContent, "规划中");
  assert.equal(isActionFeedbackPending(actionButton), true);

  resetActionFeedback(actionButton, { text: "重新生成合并计划" });

  assert.equal(actionButton.disabled, false);
  assert.equal(actionButton.textContent, "重新生成合并计划");
  assert.equal(isActionFeedbackPending(actionButton), false);
});

test("action feedback locates scoped feedback text targets", () => {
  const feedbackTarget = { textContent: "" };
  const actionButton = {
    closest(panelSelector) {
      assert.equal(panelSelector, ".auto-merge-panel");
      return {
        querySelector(feedbackSelector) {
          assert.equal(feedbackSelector, "[data-feedback='replan-auto-merge']");
          return feedbackTarget;
        },
      };
    },
  };

  const target = findActionFeedbackTarget(actionButton, {
    panelSelector: ".auto-merge-panel",
    feedbackSelector: "[data-feedback='replan-auto-merge']",
  });
  setFeedbackText(target, "正在重新扫描隔离工作树...");

  assert.equal(target, feedbackTarget);
  assert.equal(feedbackTarget.textContent, "正在重新扫描隔离工作树...");
});

test("action feedback updates optional hidden state and schedules reset", () => {
  const actionButton = button();
  const scheduled = [];

  updateActionFeedback(actionButton, { hidden: true });
  beginActionFeedback(actionButton, { text: "生成中" });
  scheduleActionFeedbackReset(actionButton, {
    text: "生成状态桩",
    delayMs: 1500,
    setTimeoutFn(callback, delayMs) {
      scheduled.push({ callback, delayMs });
    },
  });

  assert.equal(actionButton.hidden, true);
  assert.equal(actionButton.disabled, true);
  assert.equal(actionButton.textContent, "生成中");
  assert.equal(scheduled[0].delayMs, 1500);

  scheduled[0].callback();

  assert.equal(actionButton.disabled, false);
  assert.equal(actionButton.textContent, "生成状态桩");
  assert.equal(actionButton.hidden, true);
});

test("action feedback resets lightweight button-like targets without datasets", () => {
  const actionTarget = {
    disabled: true,
    textContent: "取消中",
  };

  resetActionFeedback(actionTarget, { text: "取消运行" });

  assert.deepEqual(actionTarget, {
    disabled: false,
    textContent: "取消运行",
  });
});
