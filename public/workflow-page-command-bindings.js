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
      commandActions.createRecommendationRun().catch(showError);
    });
    elements.cancelRecommendationButton?.addEventListener("click", () => {
      commandActions.cancelRecommendationRun().catch(showError);
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
