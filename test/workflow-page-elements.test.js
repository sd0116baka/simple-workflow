import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createWorkflowPageElements,
  workflowPageSelectors,
} from "../public/workflow-page-elements.js";

test("workflow page elements expose the selector registry", () => {
  const selectors = workflowPageSelectors();

  assert.equal(selectors.taskList, "#taskList");
  assert.equal(selectors.recommendationTerminal, "#recommendationTerminal");
  assert.equal(selectors.autoMergeExecutionPanel, "#autoMergeExecutionPanel");
  assert.equal(selectors.taskCloseoutPanel, "#taskCloseoutPanel");

  selectors.taskList = "#changed";
  assert.equal(workflowPageSelectors().taskList, "#taskList");
});

test("workflow page elements query all registered page elements", () => {
  const queriedSelectors = [];
  const elements = createWorkflowPageElements({
    documentRef: {
      querySelector(selector) {
        queriedSelectors.push(selector);
        return { selector };
      },
    },
  });
  const selectors = workflowPageSelectors();

  assert.deepEqual(Object.keys(elements), Object.keys(selectors));
  assert.deepEqual(queriedSelectors, Object.values(selectors));
  assert.deepEqual(elements.restartButton, { selector: "#restartButton" });
  assert.deepEqual(elements.humanDecisionRaw, { selector: "#humanDecisionRaw" });
});
