import {
  beginActionFeedback,
  resetActionFeedback,
  setFeedbackText,
} from "./workflow-action-feedback.js";

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForServerReady({
  workflowApi,
  sleepFn = sleep,
  attemptCount = 30,
  retryDelayMs = 500,
} = {}) {
  for (let attempt = 0; attempt < attemptCount; attempt += 1) {
    await sleepFn(retryDelayMs);
    try {
      const response = await workflowApi.probeStartupCheck();
      if (response.ok) return;
    } catch {
      // The server is expected to be unavailable briefly while restarting.
    }
  }
  throw new Error("服务重启超时，请手动刷新页面确认。");
}

export function resetRestartControls({ restartButton, refreshButton } = {}) {
  resetActionFeedback(restartButton, { text: "重启" });
  resetActionFeedback(refreshButton);
}

export async function restartServerAction({
  workflowApi,
  restartButton,
  refreshButton,
  refreshPage,
  sleepFn = sleep,
} = {}) {
  beginActionFeedback(restartButton, { text: "重启中" });
  beginActionFeedback(refreshButton);
  await workflowApi.restartServer();
  await sleepFn(1000);
  await waitForServerReady({ workflowApi, sleepFn });
  setFeedbackText(restartButton, "已重启");
  await refreshPage();
  resetRestartControls({ restartButton, refreshButton });
}
