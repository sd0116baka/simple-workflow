import {
  cancelRecommendationRunAction,
  startRecommendationRunAction,
} from "./workflow-page-recommendation-run-actions.js";

const STAGE_SWITCH_ELEMENT_MAP = Object.freeze({
  executionAdmission: "stageSwitchExecutionAdmission",
  isolatedWorkspace: "stageSwitchIsolatedWorkspace",
  mainAgent: "stageSwitchMainAgent",
  executionAgent: "stageSwitchExecutionAgent",
  reviewAgent: "stageSwitchReviewAgent",
  convergence: "stageSwitchConvergence",
});

function readStageSwitches(elements = {}) {
  return Object.fromEntries(
    Object.entries(STAGE_SWITCH_ELEMENT_MAP).map(([stageKey, elementKey]) => [
      stageKey,
      Boolean(elements[elementKey]?.checked),
    ]),
  );
}

export function createWorkflowPageRecommendationRunCommands({
  workflowApi,
  setRecommendationRun,
  renderRecommendationRun,
  pageStatus,
  elements,
} = {}) {
  async function createRecommendationRun({ mode = "workflow" } = {}) {
    const isProbe = mode === "probe";
    return startRecommendationRunAction({
      workflowApi,
      mode,
      stageSwitches: readStageSwitches(elements),
      pendingText: isProbe ? "正在启动推荐探针..." : "正在启动完整 Agent 流程...",
      setRecommendationRun,
      renderRecommendationRun,
      setRecommendationStatus: pageStatus.setRecommendationStatus,
      setRecommendationResultText: pageStatus.setRecommendationResultText,
      runRecommendationButton: isProbe
        ? elements.runRecommendationButton
        : elements.runWorkflowButton ?? elements.runRecommendationButton,
      runWorkflowButton: isProbe ? elements.runWorkflowButton : elements.runRecommendationButton,
      cancelRecommendationButton: elements.cancelRecommendationButton,
    });
  }

  async function createWorkflowRun() {
    return createRecommendationRun({ mode: "workflow" });
  }

  async function cancelRecommendationRun() {
    return cancelRecommendationRunAction({
      workflowApi,
      setRecommendationRun,
      renderRecommendationRun,
      cancelRecommendationButton: elements.cancelRecommendationButton,
    });
  }

  async function updateStageSwitches() {
    const payload = await workflowApi.updateRecommendationRunStageSwitches({
      stageSwitches: readStageSwitches(elements),
    });
    if (payload.recommendationRun) {
      setRecommendationRun(payload.recommendationRun);
      renderRecommendationRun();
    }
    return { ok: true, payload };
  }

  return {
    createRecommendationRun,
    createWorkflowRun,
    cancelRecommendationRun,
    updateStageSwitches,
  };
}
