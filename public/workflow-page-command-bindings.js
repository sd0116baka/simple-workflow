import { isActionFeedbackPending } from "./workflow-action-feedback.js";
import { resetRestartControls } from "./workflow-page-restart-action.js";

export function createWorkflowPageCommandBindings({
  elements,
  documentRef = document,
  showError,
  commandActions,
  isActionPending = isActionFeedbackPending,
  resetRestartControlsFn = resetRestartControls,
} = {}) {
  const stageSwitches = [
    elements.stageSwitchExecutionAdmission,
    elements.stageSwitchIsolatedWorkspace,
    elements.stageSwitchMainAgent,
    elements.stageSwitchExecutionAgent,
    elements.stageSwitchReviewAgent,
    elements.stageSwitchConvergence,
  ];

  function handleDocumentAction(event) {
    const actionButton = event.target.closest?.("[data-action]");
    if (!actionButton) return;
    if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    if (isActionPending(actionButton)) return;
    if (actionButton.dataset.action === "replan-auto-merge") {
      return commandActions.replanAutoMerge(actionButton).catch(showError);
    }
  }

  function bindPageControls() {
    elements.restartButton.addEventListener("click", () => {
      commandActions.restartServer().catch((error) => {
        resetRestartControlsFn({
          restartButton: elements.restartButton,
          refreshButton: elements.refreshButton,
        });
        showError(error);
      });
    });
    elements.refreshButton.addEventListener("click", () => {
      commandActions.refreshPage().catch(showError);
    });
    elements.seedStateFixturesButton?.addEventListener("click", () => {
      commandActions.seedStateFixtures().catch(showError);
    });
    elements.cleanupStateFixturesButton?.addEventListener("click", () => {
      commandActions.cleanupStateFixtures().catch(showError);
    });
    elements.runRecommendationButton.addEventListener("click", () => {
      commandActions.createRecommendationRun({ mode: "probe" }).catch(showError);
    });
    elements.runWorkflowButton?.addEventListener("click", () => {
      commandActions.createWorkflowRun().catch(showError);
    });
    elements.cancelRecommendationButton?.addEventListener("click", () => {
      commandActions.cancelRecommendationRun().catch(showError);
    });
    stageSwitches.forEach((stageSwitch) => {
      stageSwitch?.addEventListener("change", () => {
        commandActions.updateStageSwitches().catch(showError);
      });
    });
    elements.taskDraftDiscussButton?.addEventListener("click", () => {
      commandActions.sendTaskDraftMessage().catch(showError);
    });
    elements.taskDraftFinalizeButton?.addEventListener("click", () => {
      commandActions.finalizeTaskDraft().catch(showError);
    });
    elements.taskDraftCreateButton?.addEventListener("click", () => {
      commandActions.createTaskSourceFromDraft().catch(showError);
    });
    elements.taskDraftInput?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      commandActions.sendTaskDraftMessage().catch(showError);
    });
    elements.terminalStartButton?.addEventListener("click", () => {
      commandActions.startTerminalSession().catch(showError);
    });
    elements.terminalCancelButton?.addEventListener("click", () => {
      commandActions.cancelTerminalSession().catch(showError);
    });
    elements.terminalSendButton?.addEventListener("click", () => {
      commandActions.sendTerminalInput().catch(showError);
    });
    elements.terminalInput?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      commandActions.sendTerminalInput().catch(showError);
    });
    documentRef.addEventListener("click", handleDocumentAction);
    documentRef.addEventListener("pointerup", handleDocumentAction);
    documentRef.addEventListener("keydown", handleDocumentAction);
  }

  return {
    bindPageControls,
    handleDocumentAction,
  };
}
