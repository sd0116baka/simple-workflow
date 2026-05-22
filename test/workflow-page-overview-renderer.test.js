import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderWorkflowStartupCheck,
  renderWorkflowTaskPool,
  renderWorkflowTaskSource,
} from "../public/workflow-page-overview-renderer.js";

function element(name) {
  return { name, textContent: "" };
}

function createElements() {
  return {
    taskList: element("taskList"),
    taskCount: element("taskCount"),
    taskPool: element("taskPool"),
    poolCount: element("poolCount"),
    startupCheckPanel: element("startupCheckPanel"),
    startupCheckStatus: element("startupCheckStatus"),
    taskPoolRaw: element("taskPoolRaw"),
    startupCheckRaw: element("startupCheckRaw"),
    taskSourceInputs: element("taskSourceInputs"),
    taskPoolInputs: element("taskPoolInputs"),
    startupCheckInputs: element("startupCheckInputs"),
  };
}

function createRenderers(calls) {
  return {
    renderTaskSource(payload) {
      calls.push([
        "renderTaskSource",
        payload.taskList.name,
        payload.taskCount.name,
        payload.taskSourceInputs.name,
        payload.tasks.length,
        payload.selectedFileName,
      ]);
    },
    renderTaskPool(payload) {
      calls.push([
        "renderTaskPool",
        payload.taskPool.name,
        payload.poolCount.name,
        payload.taskPoolRaw.name,
        payload.taskPoolInputs.name,
        payload.tasks.length,
        payload.poolEntries.length,
        payload.selectedFileName,
      ]);
    },
    renderStartupCheck(payload) {
      calls.push([
        "renderStartupCheck",
        payload.startupCheckPanel.name,
        payload.startupCheckRaw.name,
        payload.startupCheckInputs.name,
        payload.startupCheckStatus.name,
        payload.startupCheck.ok,
      ]);
    },
  };
}

test("overview page renderer maps task source targets", () => {
  const calls = [];
  renderWorkflowTaskSource({
    elements: createElements(),
    workflowOverviewRenderers: createRenderers(calls),
    tasks: [{ fileName: "task-001.yaml" }],
    selectedFileName: "task-001.yaml",
  });

  assert.deepEqual(calls, [
    [
      "renderTaskSource",
      "taskList",
      "taskCount",
      "taskSourceInputs",
      1,
      "task-001.yaml",
    ],
  ]);
});

test("overview page renderer maps task pool targets", () => {
  const calls = [];
  renderWorkflowTaskPool({
    elements: createElements(),
    workflowOverviewRenderers: createRenderers(calls),
    tasks: [{ fileName: "task-001.yaml" }],
    poolEntries: [{ fileName: "task-001.yaml" }],
    selectedFileName: "task-001.yaml",
  });

  assert.deepEqual(calls, [
    [
      "renderTaskPool",
      "taskPool",
      "poolCount",
      "taskPoolRaw",
      "taskPoolInputs",
      1,
      1,
      "task-001.yaml",
    ],
  ]);
});

test("overview page renderer maps startup check targets", () => {
  const calls = [];
  renderWorkflowStartupCheck({
    elements: createElements(),
    workflowOverviewRenderers: createRenderers(calls),
    startupCheck: { ok: true },
  });

  assert.deepEqual(calls, [
    [
      "renderStartupCheck",
      "startupCheckPanel",
      "startupCheckRaw",
      "startupCheckInputs",
      "startupCheckStatus",
      true,
    ],
  ]);
});
