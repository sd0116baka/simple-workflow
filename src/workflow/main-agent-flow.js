import {
  createAgentSessionRequest,
  createStubAgentSession,
} from "./agent-session-contract.js";
import {
  buildMainAgentInitializationRequest,
  MAIN_AGENT_INITIALIZATION_INPUT_REFS,
  MAIN_AGENT_INITIALIZATION_RUN_ID,
} from "./main-agent-contract.js";
import { hasArtifactBody } from "./task-package-artifacts.js";

function hasExecutionAuthorization(taskContextPackage) {
  return hasArtifactBody(taskContextPackage, "executionAuthorization");
}

export async function initializeMainAgent({
  taskContextPackage,
  runAgentSession = createStubAgentSession,
  now = () => new Date().toISOString(),
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }
  if (!hasExecutionAuthorization(taskContextPackage)) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少执行授权，不能初始化 main agent。",
    };
  }

  const startedAt = now();
  const session = await runAgentSession(createAgentSessionRequest({
    role: "main",
    packageId: taskContextPackage.packageId,
    runId: MAIN_AGENT_INITIALIZATION_RUN_ID,
    inputArtifactRefs: MAIN_AGENT_INITIALIZATION_INPUT_REFS,
    taskContextPackage,
  }));
  const finishedAt = now();

  return {
    appendRequest: buildMainAgentInitializationRequest({
      taskContextPackage,
      session,
      startedAt,
      finishedAt,
    }),
    error: null,
  };
}
