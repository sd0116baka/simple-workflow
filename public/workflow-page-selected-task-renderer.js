import { findSelectedTask } from "./workflow-page-state.js";

function createSelectedTaskRenderTargets(elements) {
  return {
    selectedTitle: elements.selectedTitle,
    selectedMeta: elements.selectedMeta,
    rawText: elements.rawText,
    parsedText: elements.parsedText,
    parseStatus: elements.parseStatus,
    validationResult: elements.validationResult,
    validationStatus: elements.validationStatus,
  };
}

export function renderSelectedWorkflowTask({
  elements,
  workflowOverviewRenderers,
  tasks,
  selectedFileName,
}) {
  const task = findSelectedTask(tasks, selectedFileName);
  if (!task) return false;

  workflowOverviewRenderers.renderSelectedTask({
    ...createSelectedTaskRenderTargets(elements),
    task,
  });

  return true;
}

export function renderMissingWorkflowTaskSelection({
  elements,
  workflowOverviewRenderers,
}) {
  workflowOverviewRenderers.renderMissingTaskSelection(
    createSelectedTaskRenderTargets(elements),
  );
}
