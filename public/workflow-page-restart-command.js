import {
  restartServerAction,
  sleep,
} from "./workflow-page-restart-action.js";

export function createWorkflowPageRestartCommand({
  workflowApi,
  refreshPage,
  elements,
  sleepFn = sleep,
} = {}) {
  async function restartServer() {
    return restartServerAction({
      workflowApi,
      restartButton: elements.restartButton,
      refreshButton: elements.refreshButton,
      refreshPage,
      sleepFn,
    });
  }

  return {
    restartServer,
  };
}
