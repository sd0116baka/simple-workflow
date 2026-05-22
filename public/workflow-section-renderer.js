import { buildAutoMergeExecutionSectionViewModel } from "./workflow-auto-merge-execution-section-view-model.js";
import { buildAutoMergeSectionViewModel } from "./workflow-auto-merge-section-view-model.js";
import { renderWorkflowArtifactSection } from "./workflow-artifact-section-renderer.js";
import { buildHumanDecisionSectionViewModel } from "./workflow-human-decision-section-view-model.js";
import { renderWorkflowStageTimelineSection } from "./workflow-stage-timeline-section-renderer.js";
import { buildTaskCloseoutSectionViewModel } from "./workflow-task-closeout-section-view-model.js";

export function createWorkflowSectionRenderer({
  workflowPanelRenderers,
  workflowOverviewRenderers,
} = {}) {
  function renderHumanDecision(elements, taskContextPackage) {
    renderWorkflowArtifactSection({
      elements,
      viewModel: buildHumanDecisionSectionViewModel(taskContextPackage),
      taskContextPackage,
      workflowOverviewRenderers,
      workflowPanelRenderers,
    });
  }

  function renderAutoMerge(elements, taskContextPackage) {
    renderWorkflowArtifactSection({
      elements,
      viewModel: buildAutoMergeSectionViewModel(taskContextPackage),
      taskContextPackage,
      workflowOverviewRenderers,
      workflowPanelRenderers,
    });
  }

  function renderAutoMergeExecution(elements, taskContextPackage) {
    renderWorkflowArtifactSection({
      elements,
      viewModel: buildAutoMergeExecutionSectionViewModel(taskContextPackage),
      taskContextPackage,
      workflowOverviewRenderers,
      workflowPanelRenderers,
    });
  }

  function renderTaskCloseout(elements, taskContextPackage) {
    renderWorkflowArtifactSection({
      elements,
      viewModel: buildTaskCloseoutSectionViewModel(taskContextPackage),
      taskContextPackage,
      workflowOverviewRenderers,
      workflowPanelRenderers,
    });
  }

  function renderStageTimeline(elements, taskContextPackage) {
    renderWorkflowStageTimelineSection({
      elements,
      taskContextPackage,
      workflowPanelRenderers,
    });
  }

  function renderAll({
    elements,
    taskContextPackage,
  }) {
    renderHumanDecision(elements.humanDecision, taskContextPackage);
    renderAutoMerge(elements.autoMerge, taskContextPackage);
    renderAutoMergeExecution(elements.autoMergeExecution, taskContextPackage);
    renderTaskCloseout(elements.taskCloseout, taskContextPackage);
    renderStageTimeline(elements.stageTimeline, taskContextPackage);
  }

  return {
    renderAll,
    renderHumanDecision,
    renderAutoMerge,
    renderAutoMergeExecution,
    renderTaskCloseout,
    renderStageTimeline,
  };
}
