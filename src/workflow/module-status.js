import { cloneJsonValue } from "./json-value.js";

export function createInitialTaskModuleStates(existingModules = {}) {
  return {
    executionAdmission: { status: "pending" },
    isolatedWorkspace: { status: "pending" },
    mainAgentInitialization: { status: "pending" },
    executionAgent: { status: "pending", attempts: 0 },
    reviewAgent: { status: "pending", attempts: 0 },
    convergence: { status: "pending", attempts: 0 },
    humanDecision: { status: "pending" },
    autoMergePlanning: { status: "pending" },
    autoMergeExecution: { status: "pending" },
    taskCloseout: { status: "pending" },
    ...cloneJsonValue(existingModules),
  };
}

export function createRunningTaskRecommenderState({ startedAt } = {}) {
  return {
    status: "running",
    startedAt,
    finishedAt: null,
    selectedPackageId: null,
    outputRef: null,
    error: null,
  };
}

export function createBlockedTaskRecommenderState({ startedAt, finishedAt, error } = {}) {
  return {
    status: "blocked",
    startedAt,
    finishedAt,
    selectedPackageId: null,
    outputRef: null,
    error: error ?? "启动检查未通过，任务推荐器未运行。",
  };
}

export function completeTaskRecommenderState({ run, completedRun } = {}) {
  if (run?.taskRecommender?.status === "succeeded") {
    return run.taskRecommender;
  }

  const selectedPackageId = completedRun?.executionIntentAppendRequest?.packageId ?? null;
  const error = completedRun?.executionIntentError
    ?? completedRun?.error
    ?? null;
  return {
    ...(run?.taskRecommender ?? {}),
    status: completedRun?.exitCode === 0 && selectedPackageId && !error ? "succeeded" : "failed",
    startedAt: run?.taskRecommender?.startedAt ?? run?.startedAt ?? null,
    finishedAt: completedRun?.finishedAt ?? null,
    selectedPackageId,
    outputRef: selectedPackageId ? "executionIntent" : null,
    error,
  };
}

export function failTaskRecommenderState({ run, error, finishedAt } = {}) {
  return {
    ...(run?.taskRecommender ?? {}),
    status: "failed",
    startedAt: run?.taskRecommender?.startedAt ?? run?.startedAt ?? null,
    finishedAt,
    selectedPackageId: run?.taskRecommender?.selectedPackageId ?? null,
    outputRef: run?.taskRecommender?.outputRef ?? null,
    error: error?.message ?? String(error ?? "任务推荐器运行失败"),
  };
}

function moduleKeyForArtifactType(artifactType) {
  return {
    admissionRejection: "executionAdmission",
    autoMergeFailure: "autoMergeExecution",
    autoMergePlan: "autoMergePlanning",
    autoMergeRejection: "autoMergePlanning",
    autoMergeResult: "autoMergeExecution",
    convergenceAdvice: "convergence",
    convergenceFailure: "convergence",
    convergenceSuccess: "convergence",
    executionAuthorization: "executionAdmission",
    executionReport: "executionAgent",
    humanConvergenceGuidance: "humanDecision",
    humanDecision: "humanDecision",
    humanDecisionRequest: "humanDecision",
    isolatedWorkspace: "isolatedWorkspace",
    reviewReport: "reviewAgent",
    taskCloseout: "taskCloseout",
  }[artifactType] ?? null;
}

function moduleKeyForAgentRun(agentRun) {
  if (agentRun?.runId === "main-agent:initialization") return "mainAgentInitialization";
  if (agentRun?.runId?.startsWith("execution-agent:")) return "executionAgent";
  if (agentRun?.runId?.startsWith("review-agent:")) return "reviewAgent";
  if (agentRun?.runId?.startsWith("main-agent:convergence:")) return "convergence";
  return null;
}

function statusFromAppend({ artifactType, agentRun }) {
  if (agentRun?.status && agentRun.status !== "succeeded") return agentRun.status;
  if (["admissionRejection", "autoMergeFailure", "convergenceFailure"].includes(artifactType)) {
    return "failed";
  }
  if (artifactType === "humanDecisionRequest") return "waiting";
  return "succeeded";
}

export function updateTaskModuleStatesForAppend({
  modules,
  appendRequest,
  artifactId,
  appendedAt,
} = {}) {
  const currentModules = createInitialTaskModuleStates(modules);
  const moduleKey = moduleKeyForAgentRun(appendRequest?.agentRun)
    ?? moduleKeyForArtifactType(appendRequest?.artifactType);
  if (!moduleKey) return currentModules;

  const current = currentModules[moduleKey] ?? { status: "pending" };
  const attemptIncrement = ["executionAgent", "reviewAgent", "convergence"].includes(moduleKey)
    && appendRequest?.agentRun
    ? 1
    : 0;

  return {
    ...currentModules,
    [moduleKey]: {
      ...current,
      status: statusFromAppend({
        artifactType: appendRequest?.artifactType,
        agentRun: appendRequest?.agentRun,
      }),
      startedAt: current.startedAt ?? appendRequest?.agentRun?.startedAt ?? appendedAt,
      finishedAt: appendRequest?.agentRun?.finishedAt ?? appendedAt,
      runRef: appendRequest?.agentRun?.runId ?? current.runRef ?? null,
      outputRef: artifactId ?? current.outputRef ?? null,
      attempts: (current.attempts ?? 0) + attemptIncrement,
      error: appendRequest?.error ?? null,
    },
  };
}
