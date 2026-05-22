import { renderInputs } from "./dom-renderer-helpers.js";
import {
  renderMissingTaskSelectionOverview,
  renderSelectedTaskOverview,
} from "./workflow-overview-selected-task-renderer.js";
import { renderStartupCheckOverview } from "./workflow-overview-startup-check-renderer.js";
import { renderTaskPoolOverview } from "./workflow-overview-task-pool-renderer.js";
import { renderTaskSourceOverview } from "./workflow-overview-task-source-renderer.js";
import { renderValidationOverview } from "./workflow-overview-validation-renderer.js";

export function createWorkflowOverviewRenderers({
  documentRef = document,
  onSelectTask,
} = {}) {
  function renderTaskSource({
    taskList,
    taskCount,
    taskSourceInputs,
    tasks,
    selectedFileName,
  }) {
    return renderTaskSourceOverview({
      documentRef,
      onSelectTask,
      taskList,
      taskCount,
      taskSourceInputs,
      tasks,
      selectedFileName,
    });
  }

  function renderTaskPool({
    taskPool,
    poolCount,
    taskPoolRaw,
    taskPoolInputs,
    tasks,
    poolEntries,
    selectedFileName,
  }) {
    return renderTaskPoolOverview({
      documentRef,
      onSelectTask,
      taskPool,
      poolCount,
      taskPoolRaw,
      taskPoolInputs,
      tasks,
      poolEntries,
      selectedFileName,
    });
  }

  function renderStartupCheck({
    startupCheckPanel,
    startupCheckRaw,
    startupCheckInputs,
    startupCheckStatus,
    startupCheck,
  }) {
    return renderStartupCheckOverview({
      documentRef,
      startupCheckPanel,
      startupCheckRaw,
      startupCheckInputs,
      startupCheckStatus,
      startupCheck,
    });
  }

  function renderSelectedTask({
    selectedTitle,
    selectedMeta,
    rawText,
    parsedText,
    parseStatus,
    validationResult,
    validationStatus,
    task,
  }) {
    return renderSelectedTaskOverview({
      selectedTitle,
      selectedMeta,
      rawText,
      parsedText,
      parseStatus,
      validationResult,
      validationStatus,
      task,
    });
  }

  function renderMissingTaskSelection({
    selectedTitle,
    selectedMeta,
    rawText,
    parsedText,
    parseStatus,
    validationResult,
    validationStatus,
  }) {
    return renderMissingTaskSelectionOverview({
      selectedTitle,
      selectedMeta,
      rawText,
      parsedText,
      parseStatus,
      validationResult,
      validationStatus,
    });
  }

  function renderValidation({
    validationResult,
    validationStatus,
    validation,
  }) {
    return renderValidationOverview({
      documentRef,
      validationResult,
      validationStatus,
      validation,
    });
  }

  return {
    renderInputs: (container, inputs) => renderInputs(documentRef, container, inputs),
    renderMissingTaskSelection,
    renderSelectedTask,
    renderStartupCheck,
    renderTaskPool,
    renderTaskSource,
    renderValidation,
  };
}
