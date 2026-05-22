import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageSelectedTaskDataRenderer } from "../public/workflow-page-selected-task-data-renderer.js";

function element(name) {
  return { name };
}

function createElements() {
  return {
    selectedTitle: element("selectedTitle"),
    selectedMeta: element("selectedMeta"),
    rawText: element("rawText"),
    parsedText: element("parsedText"),
    parseStatus: element("parseStatus"),
    validationResult: element("validationResult"),
    validationStatus: element("validationStatus"),
  };
}

function createHarness() {
  const calls = [];
  const elements = createElements();
  const renderer = createWorkflowPageSelectedTaskDataRenderer({
    elements,
    workflowOverviewRenderers: {
      renderSelectedTask(payload) {
        calls.push(["renderSelectedTask", payload]);
      },
      renderMissingTaskSelection(payload) {
        calls.push(["renderMissingTaskSelection", payload]);
      },
    },
  });

  return { calls, elements, renderer };
}

test("workflow page selected task data renderer maps selected task snapshot payload", () => {
  const { calls, elements, renderer } = createHarness();
  const task = { fileName: "task-001.yaml" };
  const result = renderer.renderSelectedTask({
    tasks: [task],
    selectedFileName: "task-001.yaml",
  });

  assert.equal(result, true);
  assert.equal(calls.length, 1);
  const [callName, payload] = calls[0];
  assert.equal(callName, "renderSelectedTask");
  assert.equal(payload.selectedTitle, elements.selectedTitle);
  assert.equal(payload.selectedMeta, elements.selectedMeta);
  assert.equal(payload.rawText, elements.rawText);
  assert.equal(payload.parsedText, elements.parsedText);
  assert.equal(payload.parseStatus, elements.parseStatus);
  assert.equal(payload.validationResult, elements.validationResult);
  assert.equal(payload.validationStatus, elements.validationStatus);
  assert.equal(payload.task, task);
});

test("workflow page selected task data renderer reports missing selected file", () => {
  const { calls, renderer } = createHarness();

  const result = renderer.renderSelectedTask({
    tasks: [{ fileName: "task-001.yaml" }],
    selectedFileName: "missing.yaml",
  });

  assert.equal(result, false);
  assert.deepEqual(calls, []);
});

test("workflow page selected task data renderer maps missing selection targets", () => {
  const { calls, elements, renderer } = createHarness();

  renderer.renderMissingTaskSelection();

  assert.equal(calls.length, 1);
  const [callName, payload] = calls[0];
  assert.equal(callName, "renderMissingTaskSelection");
  assert.equal(payload.selectedTitle, elements.selectedTitle);
  assert.equal(payload.selectedMeta, elements.selectedMeta);
  assert.equal(payload.rawText, elements.rawText);
  assert.equal(payload.parseStatus, elements.parseStatus);
  assert.equal(payload.validationStatus, elements.validationStatus);
});
