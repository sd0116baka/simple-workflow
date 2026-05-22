import {
  beginActionFeedback,
  resetActionFeedback,
  scheduleActionFeedbackReset,
  setFeedbackText,
} from "./workflow-action-feedback.js";
import {
  fixtureSelectedFileName,
  selectionAfterFixtureCleanup,
} from "./workflow-page-state.js";

export async function seedStateFixturesAction({
  workflowApi,
  seedStateFixtureSelect,
  seedStateFixturesButton,
  getSelectedFileName,
  setSelectedFileName,
  setRecommendationRun,
  refreshPage,
  setTimeoutFn = setTimeout,
} = {}) {
  if (!seedStateFixturesButton) return { ok: false, skipped: true };
  beginActionFeedback(seedStateFixturesButton, { text: "生成中" });
  const fixtureKey = seedStateFixtureSelect?.value ?? "task-pool";
  let payload;
  try {
    payload = await workflowApi.seedStateFixtures({ fixtureKey });
  } catch (error) {
    resetActionFeedback(seedStateFixturesButton, { text: "生成状态桩" });
    throw error;
  }

  setSelectedFileName(fixtureSelectedFileName(payload, getSelectedFileName()));
  setRecommendationRun(null);
  await refreshPage();
  const generatedStage = payload.tasks?.[0]?.currentWorkStage ?? fixtureKey;
  setFeedbackText(
    seedStateFixturesButton,
    generatedStage === fixtureKey
      ? `已生成 ${generatedStage}`
      : `已生成 ${fixtureKey} -> ${generatedStage}`,
  );
  scheduleActionFeedbackReset(seedStateFixturesButton, {
    text: "生成状态桩",
    delayMs: 1500,
    setTimeoutFn,
  });
  return { ok: true, payload };
}

export async function cleanupStateFixturesAction({
  workflowApi,
  cleanupStateFixturesButton,
  getSelectedFileName,
  setSelectedFileName,
  setRecommendationRun,
  refreshPage,
  setTimeoutFn = setTimeout,
} = {}) {
  if (!cleanupStateFixturesButton) return { ok: false, skipped: true };
  beginActionFeedback(cleanupStateFixturesButton, { text: "清理中" });
  let payload;
  try {
    payload = await workflowApi.cleanupStateFixtures();
  } catch (error) {
    resetActionFeedback(cleanupStateFixturesButton, { text: "清理状态桩" });
    throw error;
  }

  setRecommendationRun(null);
  setSelectedFileName(selectionAfterFixtureCleanup(getSelectedFileName()));
  await refreshPage();
  setFeedbackText(
    cleanupStateFixturesButton,
    `已清理 ${payload.removedTaskFiles ?? 0} 个`,
  );
  scheduleActionFeedbackReset(cleanupStateFixturesButton, {
    text: "清理状态桩",
    delayMs: 1500,
    setTimeoutFn,
  });
  return { ok: true, payload };
}
