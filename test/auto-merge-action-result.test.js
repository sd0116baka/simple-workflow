import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptedAutoMergeResult,
  acceptanceFailureResult,
  closeoutFailureResult,
  executionFailureResult,
  executionIncompleteResult,
  planningFailureResult,
  planningIncompleteResult,
  replanAutoMergeResult,
  replanFailureResult,
} from "../src/workflow/auto-merge-action-result.js";

test("auto merge action results project acceptance and planning responses", () => {
  assert.deepEqual(acceptanceFailureResult("missing human-decision"), {
    shouldEmit: true,
    response: {
      accepted: false,
      error: "missing human-decision",
    },
  });
  assert.deepEqual(planningFailureResult("planning failed"), {
    shouldEmit: true,
    response: {
      accepted: true,
      planned: false,
      closed: false,
      error: "planning failed",
    },
  });
  assert.deepEqual(planningIncompleteResult(), {
    shouldEmit: true,
    response: {
      accepted: true,
      planned: false,
      executed: false,
      closed: false,
      error: null,
    },
  });
});

test("auto merge action results project execution and closeout responses", () => {
  assert.deepEqual(executionFailureResult("execution failed"), {
    shouldEmit: true,
    response: {
      accepted: true,
      planned: true,
      executed: false,
      error: "execution failed",
    },
  });
  assert.deepEqual(executionIncompleteResult(), {
    shouldEmit: true,
    response: {
      accepted: true,
      planned: true,
      executed: false,
      closed: false,
      error: null,
    },
  });
  assert.deepEqual(closeoutFailureResult("closeout failed"), {
    shouldEmit: true,
    response: {
      accepted: true,
      planned: true,
      executed: true,
      closed: false,
      error: "closeout failed",
    },
  });
});

test("auto merge action results project terminal and replan responses", () => {
  assert.deepEqual(acceptedAutoMergeResult({
    planningOutcome: { planned: true },
    executionOutcome: { executed: true },
    closeoutOutcome: { closed: true },
  }), {
    shouldEmit: true,
    response: {
      accepted: true,
      planned: true,
      executed: true,
      closed: true,
      error: null,
    },
  });
  assert.deepEqual(replanFailureResult("planning failed"), {
    shouldEmit: true,
    response: {
      planned: false,
      error: "planning failed",
    },
  });
  assert.deepEqual(replanAutoMergeResult({ planningOutcome: { planned: false } }), {
    shouldEmit: true,
    response: {
      planned: false,
      error: null,
    },
  });
});
