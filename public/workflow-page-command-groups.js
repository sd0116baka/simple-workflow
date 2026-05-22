import { createWorkflowPageAutoMergeReplanCommand } from "./workflow-page-auto-merge-replan-command.js";
import { createWorkflowPageFixtureCommands } from "./workflow-page-fixture-commands.js";
import { createWorkflowPageManualActionCommands } from "./workflow-page-manual-action-commands.js";
import { createWorkflowPageRecommendationRunCommands } from "./workflow-page-recommendation-run-commands.js";
import { createWorkflowPageRestartCommand } from "./workflow-page-restart-command.js";
import { createWorkflowPageCommandSurface } from "./workflow-page-command-surface.js";
import { sleep } from "./workflow-page-restart-action.js";

function setStatusText(statusElement, text) {
  if (statusElement) statusElement.textContent = text;
}

function createWorkflowPageStatus(elements = {}) {
  return {
    setHumanDecisionStatus(status) {
      setStatusText(elements.humanDecisionStatus, status);
    },
    setAutoMergeStatus(status) {
      setStatusText(elements.autoMergeStatus, status);
    },
    setRecommendationStatus(status) {
      setStatusText(elements.recommendationStatus, status);
    },
    setRecommendationResultText(text) {
      setStatusText(elements.recommendationResult, text);
    },
  };
}

export function createWorkflowPageCommandGroups({
  workflowApi,
  activeTaskContextPackage,
  setRecommendationRun,
  renderRecommendationRun,
  loadTasks,
  loadRecommendationRun,
  getSelectedFileName,
  setSelectedFileName,
  elements,
  sleepFn = sleep,
  setTimeoutFn = setTimeout,
  createAutoMergeReplanCommand = createWorkflowPageAutoMergeReplanCommand,
  createCommandSurface = createWorkflowPageCommandSurface,
  createFixtureCommands = createWorkflowPageFixtureCommands,
  createManualActionCommands = createWorkflowPageManualActionCommands,
  createRecommendationRunCommands = createWorkflowPageRecommendationRunCommands,
  createRestartCommand = createWorkflowPageRestartCommand,
  createPageStatus = createWorkflowPageStatus,
} = {}) {
  const refreshPage = () => Promise.all([loadTasks(), loadRecommendationRun()]);
  const pageStatus = createPageStatus(elements);
  const manualActionCommands = createManualActionCommands({
    workflowApi,
    activeTaskContextPackage,
    setRecommendationRun,
    renderRecommendationRun,
    loadTasks,
    pageStatus,
  });
  const autoMergeReplanCommand = createAutoMergeReplanCommand({
    workflowApi,
    activeTaskContextPackage,
    setRecommendationRun,
    renderRecommendationRun,
    loadTasks,
    pageStatus,
  });
  const recommendationRunCommands = createRecommendationRunCommands({
    workflowApi,
    setRecommendationRun,
    renderRecommendationRun,
    pageStatus,
    elements,
  });
  const fixtureCommands = createFixtureCommands({
    workflowApi,
    getSelectedFileName,
    setSelectedFileName,
    setRecommendationRun,
    refreshPage,
    elements,
    setTimeoutFn,
  });
  const restartCommand = createRestartCommand({
    workflowApi,
    refreshPage,
    elements,
    sleepFn,
  });

  return createCommandSurface({
    autoMergeReplanCommand,
    fixtureCommands,
    manualActionCommands,
    recommendationRunCommands,
    refreshPage,
    restartCommand,
  });
}
