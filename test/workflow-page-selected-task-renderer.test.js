import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderMissingWorkflowTaskSelection,
  renderSelectedWorkflowTask,
} from "../public/workflow-page-selected-task-renderer.js";

function element(name) {
  return { name, textContent: "" };
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

function createRenderers(calls) {
  return {
    renderSelectedTask(payload) {
      calls.push([
        "renderSelectedTask",
        payload.task.fileName,
        payload.selectedTitle.name,
        payload.validationStatus.name,
      ]);
    },
    renderMissingTaskSelection(payload) {
      calls.push([
        "renderMissingTaskSelection",
        payload.selectedTitle.name,
        payload.validationStatus.name,
      ]);
    },
  };
}

test("selected task renderer renders the selected task through overview renderers", () => {
  const calls = [];
  const elements = createElements();
  const didRender = renderSelectedWorkflowTask({
    elements,
    workflowOverviewRenderers: createRenderers(calls),
    tasks: [
      { fileName: "task-001.yaml" },
      { fileName: "task-002.yaml" },
    ],
    selectedFileName: "task-002.yaml",
  });

  assert.equal(didRender, true);
  assert.deepEqual(calls, [
    [
      "renderSelectedTask",
      "task-002.yaml",
      "selectedTitle",
      "validationStatus",
    ],
  ]);
});

test("selected task renderer leaves the page untouched when the selected task is missing", () => {
  const calls = [];
  const didRender = renderSelectedWorkflowTask({
    elements: createElements(),
    workflowOverviewRenderers: createRenderers(calls),
    tasks: [{ fileName: "task-001.yaml" }],
    selectedFileName: "missing.yaml",
  });

  assert.equal(didRender, false);
  assert.deepEqual(calls, []);
});

test("selected task renderer writes the missing selection state through overview renderers", () => {
  const calls = [];
  renderMissingWorkflowTaskSelection({
    elements: createElements(),
    workflowOverviewRenderers: createRenderers(calls),
  });

  assert.deepEqual(calls, [
    [
      "renderMissingTaskSelection",
      "selectedTitle",
      "validationStatus",
    ],
  ]);
});
