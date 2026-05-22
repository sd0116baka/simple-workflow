import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageOverviewDataRenderer } from "../public/workflow-page-overview-data-renderer.js";

function element(name) {
  return { name };
}

function createElements() {
  return {
    taskList: element("taskList"),
    taskCount: element("taskCount"),
    taskSourceInputs: element("taskSourceInputs"),
    taskPool: element("taskPool"),
    poolCount: element("poolCount"),
    taskPoolRaw: element("taskPoolRaw"),
    taskPoolInputs: element("taskPoolInputs"),
    startupCheckPanel: element("startupCheckPanel"),
    startupCheckRaw: element("startupCheckRaw"),
    startupCheckInputs: element("startupCheckInputs"),
    startupCheckStatus: element("startupCheckStatus"),
  };
}

function createHarness() {
  const calls = [];
  const elements = createElements();
  const workflowOverviewRenderers = {
    renderTaskSource(payload) {
      calls.push(["renderTaskSource", payload]);
    },
    renderTaskPool(payload) {
      calls.push(["renderTaskPool", payload]);
    },
    renderStartupCheck(payload) {
      calls.push(["renderStartupCheck", payload]);
    },
  };

  return {
    calls,
    elements,
    renderer: createWorkflowPageOverviewDataRenderer({
      elements,
      workflowOverviewRenderers,
    }),
  };
}

test("workflow page overview data renderer maps task source snapshot payload", () => {
  const { calls, elements, renderer } = createHarness();
  const snapshotState = {
    tasks: [{ fileName: "task-001.yaml" }],
    selectedFileName: "task-001.yaml",
  };

  renderer.renderList(snapshotState);

  assert.equal(calls.length, 1);
  const [callName, payload] = calls[0];
  assert.equal(callName, "renderTaskSource");
  assert.equal(payload.taskList, elements.taskList);
  assert.equal(payload.taskCount, elements.taskCount);
  assert.equal(payload.taskSourceInputs, elements.taskSourceInputs);
  assert.equal(payload.tasks, snapshotState.tasks);
  assert.equal(payload.selectedFileName, "task-001.yaml");
});

test("workflow page overview data renderer maps task pool snapshot payload", () => {
  const { calls, elements, renderer } = createHarness();
  const snapshotState = {
    tasks: [{ fileName: "task-001.yaml" }],
    poolEntries: [{ sourceFile: "task-001.yaml" }],
    selectedFileName: "task-001.yaml",
  };

  renderer.renderTaskPool(snapshotState);

  assert.equal(calls.length, 1);
  const [callName, payload] = calls[0];
  assert.equal(callName, "renderTaskPool");
  assert.equal(payload.taskPool, elements.taskPool);
  assert.equal(payload.poolCount, elements.poolCount);
  assert.equal(payload.taskPoolRaw, elements.taskPoolRaw);
  assert.equal(payload.taskPoolInputs, elements.taskPoolInputs);
  assert.equal(payload.tasks, snapshotState.tasks);
  assert.equal(payload.poolEntries, snapshotState.poolEntries);
  assert.equal(payload.selectedFileName, "task-001.yaml");
});

test("workflow page overview data renderer maps startup check snapshot payload", () => {
  const { calls, elements, renderer } = createHarness();
  const snapshotState = {
    startupCheck: { canStartWork: true },
  };

  renderer.renderStartupCheck(snapshotState);

  assert.equal(calls.length, 1);
  const [callName, payload] = calls[0];
  assert.equal(callName, "renderStartupCheck");
  assert.equal(payload.startupCheckPanel, elements.startupCheckPanel);
  assert.equal(payload.startupCheckRaw, elements.startupCheckRaw);
  assert.equal(payload.startupCheckInputs, elements.startupCheckInputs);
  assert.equal(payload.startupCheckStatus, elements.startupCheckStatus);
  assert.equal(payload.startupCheck, snapshotState.startupCheck);
});
