import {
  createAutoMergeExecutionPanel as createAutoMergeExecutionPanelElement,
  createAutoMergeListPanel,
  createAutoMergePanel as createAutoMergePanelElement,
  createTaskCloseoutPanel as createTaskCloseoutPanelElement,
} from "./auto-merge-panel-renderer.js";
import {
  createHumanDecisionPanel as createHumanDecisionPanelElement,
} from "./human-decision-panel-renderer.js";
import {
  createAdmissionPanel as createAdmissionPanelElement,
  createIntentPanel as createIntentPanelElement,
} from "./recommendation-panel-renderers.js";
import {
  createStageTimelinePanel as createStageTimelinePanelElement,
} from "./stage-timeline-panel-renderer.js";
import {
  createTaskContextPackagePanel as createTaskContextPackagePanelElement,
} from "./task-context-package-panel-renderer.js";
import {
  appendWorkflowSectionPanel as appendWorkflowSectionPanelElement,
} from "./workflow-section-panel-dispatcher.js";

export function createWorkflowPanelRenderers({
  documentRef = document,
  onAcceptConvergence,
  onContinueConvergenceWithGuidance,
  onCancelTask,
  showError = (error) => {
    throw error;
  },
} = {}) {
  function createIntentPanel(intent) {
    return createIntentPanelElement(documentRef, intent);
  }

  function createAdmissionPanel(admission) {
    return createAdmissionPanelElement(documentRef, admission);
  }

  function createStageTimelinePanel(viewModel) {
    return createStageTimelinePanelElement(documentRef, viewModel);
  }

  function createHumanDecisionPanel(taskContextPackage) {
    return createHumanDecisionPanelElement(documentRef, taskContextPackage, {
      onAcceptConvergence,
      onContinueConvergenceWithGuidance,
      onCancelTask,
      showError,
    });
  }

  function createListPanel(viewModel) {
    return createAutoMergeListPanel(documentRef, viewModel);
  }

  function createAutoMergePanel(taskContextPackage) {
    return createAutoMergePanelElement(documentRef, taskContextPackage);
  }

  function createAutoMergeExecutionPanel(taskContextPackage) {
    return createAutoMergeExecutionPanelElement(documentRef, taskContextPackage);
  }

  function createTaskCloseoutPanel(taskContextPackage) {
    return createTaskCloseoutPanelElement(documentRef, taskContextPackage);
  }

  function appendWorkflowSectionPanel(container, panel, taskContextPackage) {
    return appendWorkflowSectionPanelElement(container, panel, taskContextPackage, {
      createAutoMergeExecutionPanel,
      createAutoMergePanel,
      createHumanDecisionPanel,
      createListPanel,
      createTaskCloseoutPanel,
    });
  }

  function createTaskContextPackagePanel(taskContextPackage) {
    return createTaskContextPackagePanelElement(documentRef, taskContextPackage);
  }

  return {
    appendWorkflowSectionPanel,
    createAdmissionPanel,
    createIntentPanel,
    createStageTimelinePanel,
    createTaskContextPackagePanel,
  };
}
