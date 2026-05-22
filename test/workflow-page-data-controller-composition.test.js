import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageDataController } from "../public/workflow-page-data-controller.js";
import {
  createWorkflowPageControllerElements,
  createWorkflowPageTaskContextPackage,
} from "./support/workflow-page-data-controller-fixtures.js";

test("workflow page data controller delegates render payloads through injected data renderers", async () => {
  const calls = [];
  const controller = createWorkflowPageDataController({
    workflowApi: {
      async loadWorkflowSnapshot() {
        calls.push(["loadWorkflowSnapshot"]);
        return {
          tasks: [{ fileName: "task-001.yaml" }],
          taskPool: {
            entries: [{ fileName: "task-001.yaml" }],
            taskContextPackages: [createWorkflowPageTaskContextPackage()],
          },
          startupCheck: { ok: true },
        };
      },
      async loadRecommendationRun() {
        calls.push(["loadRecommendationRun"]);
        return { recommendationRun: { id: "run:001", status: "completed" } };
      },
    },
    workflowOverviewRenderers: {},
    workflowSectionRenderer: {},
    workflowRecommendationRunRenderer: {},
    elements: createWorkflowPageControllerElements(),
    createDataRenderers() {
      return {
        renderList(snapshotState) {
          calls.push(["renderList", snapshotState.selectedFileName]);
        },
        renderLoadingState() {
          calls.push(["renderLoadingState"]);
        },
        renderMissingTaskSelection() {
          calls.push(["renderMissingTaskSelection"]);
        },
        renderRecommendationRun(payload) {
          calls.push([
            "renderRecommendationRun",
            payload.recommendationRun?.id ?? null,
            payload.activeTaskContextPackage?.packageId ?? null,
          ]);
        },
        renderSelectedTask(snapshotState) {
          calls.push(["renderSelectedTask", snapshotState.selectedFileName]);
          return true;
        },
        renderStartupCheck(snapshotState) {
          calls.push(["renderStartupCheck", snapshotState.startupCheck]);
        },
        renderTaskPool(snapshotState) {
          calls.push(["renderTaskPool", snapshotState.selectedFileName]);
        },
        renderWorkflowSections(taskContextPackage) {
          calls.push(["renderWorkflowSections", taskContextPackage?.packageId ?? null]);
        },
      };
    },
  });

  await controller.loadTasks();
  await controller.loadRecommendationRun();
  controller.renderWorkflowSections({ packageId: "package:manual" });

  assert.deepEqual(calls, [
    ["renderLoadingState"],
    ["loadWorkflowSnapshot"],
    ["renderList", "task-001.yaml"],
    ["renderTaskPool", "task-001.yaml"],
    ["renderStartupCheck", { ok: true }],
    ["renderSelectedTask", "task-001.yaml"],
    ["renderList", "task-001.yaml"],
    ["renderTaskPool", "task-001.yaml"],
    ["renderRecommendationRun", null, "task-context-package:tasks/task-001.yaml"],
    ["renderRecommendationRun", null, "task-context-package:tasks/task-001.yaml"],
    ["loadRecommendationRun"],
    ["renderRecommendationRun", "run:001", "task-context-package:tasks/task-001.yaml"],
    ["renderWorkflowSections", "package:manual"],
  ]);
});

test("workflow page data controller delegates task selection through injected selection module", async () => {
  const calls = [];
  let selectedFileName = null;
  const controller = createWorkflowPageDataController({
    workflowApi: {
      async loadWorkflowSnapshot() {
        calls.push(["loadWorkflowSnapshot"]);
        return {
          tasks: [{ fileName: "task-001.yaml" }],
          taskPool: {
            entries: [{ fileName: "task-001.yaml" }],
            taskContextPackages: [createWorkflowPageTaskContextPackage()],
          },
          startupCheck: { ok: true },
        };
      },
      async loadRecommendationRun() {
        return { recommendationRun: null };
      },
    },
    workflowOverviewRenderers: {},
    workflowSectionRenderer: {},
    workflowRecommendationRunRenderer: {},
    elements: createWorkflowPageControllerElements(),
    createDataRenderers() {
      return {
        renderList(snapshotState) {
          calls.push(["renderList", snapshotState.selectedFileName]);
        },
        renderLoadingState() {
          calls.push(["renderLoadingState"]);
        },
        renderMissingTaskSelection() {
          calls.push(["renderMissingTaskSelection"]);
        },
        renderRecommendationRun() {
          calls.push(["renderRecommendationRun"]);
        },
        renderSelectedTask() {
          calls.push(["renderSelectedTaskFromDataRenderers"]);
          return true;
        },
        renderStartupCheck(snapshotState) {
          calls.push(["renderStartupCheck", snapshotState.startupCheck]);
        },
        renderTaskPool(snapshotState) {
          calls.push(["renderTaskPool", snapshotState.selectedFileName]);
        },
        renderWorkflowSections() {},
      };
    },
    createTaskSelection(options) {
      calls.push(["createTaskSelection", Object.keys(options).sort()]);
      return {
        getSelectedFileName: () => selectedFileName,
        selectTask(fileName) {
          selectedFileName = fileName;
          calls.push(["selectTask", fileName]);
          return true;
        },
        setSelectedFileName(fileName) {
          selectedFileName = fileName;
          calls.push(["setSelectedFileName", fileName]);
        },
      };
    },
  });

  controller.setSelectedFileName("task-000.yaml");
  await controller.loadTasks();
  controller.selectTask("task-002.yaml");

  assert.equal(controller.getSelectedFileName(), "task-002.yaml");
  assert.deepEqual(calls, [
    [
      "createTaskSelection",
      [
        "dataRenderers",
        "getSnapshotState",
        "renderList",
        "renderRecommendationRun",
        "renderTaskPool",
        "setSnapshotState",
      ],
    ],
    ["setSelectedFileName", "task-000.yaml"],
    ["renderLoadingState"],
    ["loadWorkflowSnapshot"],
    ["renderList", "task-001.yaml"],
    ["renderTaskPool", "task-001.yaml"],
    ["renderStartupCheck", { ok: true }],
    ["selectTask", "task-001.yaml"],
    ["renderRecommendationRun"],
    ["selectTask", "task-002.yaml"],
  ]);
});

test("workflow page data controller delegates task loading through injected snapshot loader", async () => {
  const calls = [];
  const controller = createWorkflowPageDataController({
    workflowApi: {
      async loadWorkflowSnapshot() {
        calls.push(["loadWorkflowSnapshot"]);
        return {
          tasks: [{ fileName: "task-001.yaml" }],
          taskPool: {
            entries: [{ fileName: "task-001.yaml" }],
            taskContextPackages: [createWorkflowPageTaskContextPackage()],
          },
          startupCheck: { ok: true },
        };
      },
      async loadRecommendationRun() {
        return { recommendationRun: null };
      },
    },
    workflowOverviewRenderers: {},
    workflowSectionRenderer: {},
    workflowRecommendationRunRenderer: {},
    elements: createWorkflowPageControllerElements(),
    createDataRenderers() {
      return {
        renderList() {},
        renderLoadingState() {},
        renderMissingTaskSelection() {},
        renderRecommendationRun() {},
        renderSelectedTask() {
          return true;
        },
        renderStartupCheck() {},
        renderTaskPool() {},
        renderWorkflowSections() {},
      };
    },
    createSnapshotLoader(options) {
      calls.push(["createSnapshotLoader", Object.keys(options).sort()]);
      return {
        async loadTasks() {
          calls.push(["loadTasksFromSnapshotLoader"]);
        },
      };
    },
  });

  await controller.loadTasks();

  assert.deepEqual(calls, [
    [
      "createSnapshotLoader",
      [
        "dataRenderers",
        "getSnapshotState",
        "renderRecommendationRun",
        "setSnapshotState",
        "taskSelection",
        "workflowApi",
      ],
    ],
    ["loadTasksFromSnapshotLoader"],
  ]);
});

test("workflow page data controller delegates recommendation sync through injected sync controller", async () => {
  const calls = [];
  let recommendationRun = null;
  const controller = createWorkflowPageDataController({
    workflowApi: {
      async loadWorkflowSnapshot() {
        calls.push(["loadWorkflowSnapshot"]);
        return {
          tasks: [{ fileName: "task-001.yaml" }],
          taskPool: {
            entries: [{ fileName: "task-001.yaml" }],
            taskContextPackages: [createWorkflowPageTaskContextPackage()],
          },
          startupCheck: { ok: true },
        };
      },
      async loadRecommendationRun() {
        calls.push(["loadRecommendationRunFromApi"]);
        return { recommendationRun: { id: "run:api", status: "running" } };
      },
    },
    workflowOverviewRenderers: {},
    workflowSectionRenderer: {},
    workflowRecommendationRunRenderer: {},
    elements: createWorkflowPageControllerElements(),
    createDataRenderers() {
      return {
        renderList(snapshotState) {
          calls.push(["renderList", snapshotState.selectedFileName]);
        },
        renderLoadingState() {
          calls.push(["renderLoadingState"]);
        },
        renderMissingTaskSelection() {
          calls.push(["renderMissingTaskSelection"]);
        },
        renderRecommendationRun(payload) {
          calls.push([
            "renderRecommendationRunFromDataRenderers",
            payload.recommendationRun?.id ?? null,
          ]);
        },
        renderSelectedTask(snapshotState) {
          calls.push(["renderSelectedTask", snapshotState.selectedFileName]);
          return true;
        },
        renderStartupCheck(snapshotState) {
          calls.push(["renderStartupCheck", snapshotState.startupCheck]);
        },
        renderTaskPool(snapshotState) {
          calls.push(["renderTaskPool", snapshotState.selectedFileName]);
        },
        renderWorkflowSections() {},
      };
    },
    createRecommendationSyncController(options) {
      calls.push(["createRecommendationSyncController", Object.keys(options).sort()]);
      return {
        getRecommendationRun: () => recommendationRun,
        isRecommendationRunRunning: () => recommendationRun?.status === "running",
        latestRecommendationSyncAt: () => 12345,
        async loadRecommendationRun() {
          calls.push(["loadRecommendationRun"]);
        },
        markRecommendationConnectionInterrupted() {
          calls.push(["markRecommendationConnectionInterrupted"]);
          return true;
        },
        renderRecommendationRun() {
          calls.push(["renderRecommendationRun"]);
        },
        setRecommendationRun(nextRecommendationRun, options) {
          recommendationRun = nextRecommendationRun;
          calls.push(["setRecommendationRun", nextRecommendationRun, options]);
        },
        async syncRecommendationRunSilently() {
          calls.push(["syncRecommendationRunSilently"]);
        },
      };
    },
  });

  controller.setRecommendationRun({
    id: "run:manual",
    status: "running",
    taskContextPackage: createWorkflowPageTaskContextPackage(),
  }, {
    syncTaskPackage: true,
  });
  await controller.loadRecommendationRun();
  await controller.syncRecommendationRunSilently();
  const interrupted = controller.markRecommendationConnectionInterrupted();
  controller.renderRecommendationRun();

  assert.equal(controller.isRecommendationRunRunning(), true);
  assert.equal(controller.latestRecommendationSyncAt(), 12345);
  assert.equal(interrupted, true);
  assert.deepEqual(controller.activeTaskContextPackage(), createWorkflowPageTaskContextPackage());
  assert.deepEqual(calls, [
    [
      "createRecommendationSyncController",
      [
        "elements",
        "getSnapshotState",
        "renderRecommendationRun",
        "resolveActiveTaskContextPackage",
        "setSnapshotState",
        "workflowApi",
      ],
    ],
    [
      "setRecommendationRun",
      {
        id: "run:manual",
        status: "running",
        taskContextPackage: createWorkflowPageTaskContextPackage(),
      },
      { syncTaskPackage: true },
    ],
    ["loadRecommendationRun"],
    ["syncRecommendationRunSilently"],
    ["markRecommendationConnectionInterrupted"],
    ["renderRecommendationRun"],
  ]);
});
