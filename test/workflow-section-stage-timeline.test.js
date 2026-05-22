import { test } from "node:test";
import assert from "node:assert/strict";
import { renderWorkflowStageTimelineSection } from "../public/workflow-section-renderer.js";
import { FakeElement, markerElement } from "./support/fake-dom.js";

function createElements() {
  return {
    status: new FakeElement("span"),
    panel: new FakeElement("div"),
  };
}

function packageWithTimeline() {
  return {
    packageId: "task-context-package:tasks/task-001.yaml",
    currentWorkStage: "closed",
    artifacts: {
      executionAuthorization: {
        artifactId: "executionAuthorization:001",
        appendedAt: "2026-05-21T10:00:00.000Z",
        body: {},
      },
      taskCloseout: {
        artifactId: "taskCloseout:001",
        appendedAt: "2026-05-21T10:01:00.000Z",
        body: { finalStage: "closed" },
      },
    },
    timeline: [
      {
        artifactType: "executionAuthorization",
        artifactId: "executionAuthorization:001",
        stage: "execution-admission",
        appendedAt: "2026-05-21T10:00:00.000Z",
      },
      {
        artifactType: "taskCloseout",
        artifactId: "taskCloseout:001",
        stage: "task-closeout",
        appendedAt: "2026-05-21T10:01:00.000Z",
      },
    ],
  };
}

test("workflow stage timeline section renderer renders empty state", () => {
  const elements = createElements();
  elements.panel.append(markerElement("stale"));

  const viewModel = renderWorkflowStageTimelineSection({
    elements,
    taskContextPackage: null,
    workflowPanelRenderers: {
      createStageTimelinePanel() {
        throw new Error("should not render timeline panel");
      },
    },
  });

  assert.equal(viewModel.emptyText, "等待任务上下文包。");
  assert.equal(elements.status.textContent, "等待任务包");
  assert.equal(elements.panel.textContent, "等待任务上下文包。");
});

test("workflow stage timeline section renderer appends timeline panel", () => {
  const elements = createElements();
  const panelStatuses = [];

  const viewModel = renderWorkflowStageTimelineSection({
    elements,
    taskContextPackage: packageWithTimeline(),
    workflowPanelRenderers: {
      createStageTimelinePanel(timelineViewModel) {
        panelStatuses.push(timelineViewModel.statusText);
        return markerElement(`timeline:${timelineViewModel.nodes.length}`);
      },
    },
  });

  assert.equal(viewModel.emptyText, null);
  assert.match(elements.status.textContent, /^已关闭 · /);
  assert.equal(elements.panel.textContent, `timeline:${viewModel.nodes.length}`);
  assert.deepEqual(panelStatuses, [viewModel.statusText]);
});
