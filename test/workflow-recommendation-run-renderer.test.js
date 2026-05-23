import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowRecommendationRunRenderer } from "../public/workflow-recommendation-run-renderer.js";
import {
  createFakeDocument,
  fakeElements,
  markerElement,
} from "./support/fake-dom.js";
import { createRunningRecommendationRunFixture } from "./support/recommendation-run-fixtures.js";
import {
  createAgentRunFixture,
  createTaskContextPackageFixture,
} from "./support/task-context-package-fixtures.js";

function createElements() {
  return fakeElements([
    "recommendationResult",
    "recommendationIntentPanel",
    "admissionPanel",
    "taskContextPackagePanel",
    "taskContextPackageRaw",
    "recommendationRaw",
    "recommendationTerminal",
    "admissionRaw",
    "recommendationInputs",
    "admissionInputs",
    "runRecommendationButton",
    "cancelRecommendationButton",
    "recommendationStatus",
    "admissionStatus",
    "taskContextPackageStatus",
    "humanDecisionStatus",
    "humanDecisionRaw",
    "humanDecisionPanel",
    "autoMergeStatus",
    "autoMergeRaw",
    "autoMergePanel",
    "autoMergeExecutionStatus",
    "autoMergeExecutionRaw",
    "autoMergeExecutionPanel",
    "taskCloseoutStatus",
    "taskCloseoutRaw",
    "taskCloseoutPanel",
    "agentDebugStatus",
    "agentDebugPanel",
  ]);
}

function createRendererHarness() {
  const workflowSections = [];
  const renderInputsCalls = [];
  const renderer = createWorkflowRecommendationRunRenderer({
    documentRef: createFakeDocument(),
    workflowPanelRenderers: {
      createIntentPanel(intent) {
        return markerElement(`intent:${intent.recommendedPackageId}`, { className: "intent-panel" });
      },
      createAdmissionPanel(admission) {
        return markerElement(`admission:${admission.appendRequest?.artifactType}`, { className: "admission-panel" });
      },
      createTaskContextPackagePanel(taskContextPackage) {
        return markerElement(`package:${taskContextPackage.packageId}`, { className: "task-context-panel" });
      },
    },
    workflowOverviewRenderers: {
      renderInputs(element, inputs) {
        renderInputsCalls.push(inputs);
        element.textContent = inputs.map((input) => `${input.label}=${input.value}`).join("|");
      },
    },
    renderWorkflowSections(taskContextPackage) {
      workflowSections.push(taskContextPackage?.packageId ?? null);
    },
  });

  return { renderer, workflowSections, renderInputsCalls };
}

test("workflow recommendation run renderer renders no-run defaults", () => {
  const { renderer, workflowSections, renderInputsCalls } = createRendererHarness();
  const elements = createElements();

  const viewModel = renderer.render({
    elements,
    recommendationRun: null,
    poolEntryCount: 2,
    startupCheck: { canStartWork: true },
    taskContextPackage: null,
  });

  assert.equal(viewModel.hasRun, false);
  assert.equal(elements.recommendationStatus.textContent, "未运行");
  assert.equal(elements.recommendationResult.textContent, "尚未触发推荐器。");
  assert.equal(elements.recommendationIntentPanel.textContent, "尚未解析。");
  assert.equal(elements.admissionPanel.textContent, "等待推荐器输出。");
  assert.equal(elements.taskContextPackageRaw.textContent, "等待执行准入器输出。");
  assert.equal(elements.taskContextPackagePanel.textContent, "等待执行准入器输出。");
  assert.equal(elements.humanDecisionPanel.textContent, "等待收敛成功证据。");
  assert.equal(elements.runRecommendationButton.disabled, false);
  assert.equal(elements.cancelRecommendationButton.hidden, true);
  assert.equal(elements.recommendationTerminal.scrollTop, 42);
  assert.deepEqual(workflowSections, [null]);
  assert.equal(renderInputsCalls.length, 2);
  assert.match(elements.recommendationInputs.textContent, /prompt=project_profiles\/recommender-agent.prompt.md/);
  assert.match(elements.admissionInputs.textContent, /任务池=2 个条目/);
});

test("workflow recommendation run renderer renders running run panels and controls", () => {
  const { renderer, workflowSections } = createRendererHarness();
  const elements = createElements();

  renderer.render({
    elements,
    recommendationRun: createRunningRecommendationRunFixture({
      id: "recommendation-run:001",
      startedAt: new Date(Date.now() - 3000).toISOString(),
      args: ["run", "--format", "json"],
      progress: [{ message: "启动推荐器" }],
      executionIntent: {
        recommendedPackageId: "task-context-package:tasks/task-001.yaml",
      },
      executionAdmission: {
        appendRequest: { artifactType: "executionAuthorization" },
      },
    }),
    poolEntryCount: 1,
    startupCheck: { canStartWork: true },
    taskContextPackage: null,
  });

  assert.match(elements.recommendationStatus.textContent, /^running · /);
  assert.match(elements.recommendationResult.textContent, /探针正在运行/);
  assert.match(elements.recommendationResult.textContent, /intent:task-context-package:tasks\/task-001.yaml/);
  assert.match(elements.recommendationIntentPanel.textContent, /intent:task-context-package:tasks\/task-001.yaml/);
  assert.equal(elements.admissionStatus.textContent, "executionAuthorization");
  assert.match(elements.admissionPanel.textContent, /admission:executionAuthorization/);
  assert.match(elements.recommendationTerminal.textContent, /启动推荐器/);
  assert.equal(elements.runRecommendationButton.disabled, true);
  assert.equal(elements.cancelRecommendationButton.hidden, false);
  assert.deepEqual(workflowSections, [null]);
});

test("workflow recommendation run renderer renders task context package panel", () => {
  const { renderer, workflowSections } = createRendererHarness();
  const elements = createElements();
  const packageSnapshot = createTaskContextPackageFixture({
    agentRuns: [
      createAgentRunFixture({
        runId: "execution-agent:001",
        role: "execution",
        sessionId: "session:execution",
      }),
    ],
  });

  renderer.render({
    elements,
    recommendationRun: null,
    poolEntryCount: 1,
    startupCheck: { canStartWork: true },
    taskContextPackage: packageSnapshot,
  });

  assert.equal(elements.taskContextPackageStatus.textContent, "task-001.yaml · execution-agent");
  assert.match(elements.taskContextPackageRaw.textContent, /"packageId": "task-context-package:tasks\/task-001.yaml"/);
  assert.match(elements.taskContextPackagePanel.textContent, /package:task-context-package:tasks\/task-001.yaml/);
  assert.match(elements.agentDebugPanel.textContent, /execution-agent:001/);
  assert.match(elements.agentDebugStatus.textContent, /1 个 agent run/);
  assert.deepEqual(workflowSections, ["task-context-package:tasks/task-001.yaml"]);
});
