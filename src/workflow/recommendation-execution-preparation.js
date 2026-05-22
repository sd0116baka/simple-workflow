import { evaluateExecutionAdmission } from "./execution-admission.js";
import { allocateIsolatedWorkspace } from "./isolated-workspace-flow.js";
import { parseRecommendationIntent } from "./execution-intent-contract.js";
import { initializeMainAgent } from "./main-agent-flow.js";
import { applyAppendRequest, buildTaskPool, findTaskContextPackage } from "./task-pool.js";
import { isWorkflowStageEnabled } from "./workflow-stage-switches.js";

function createPreparationResult({
  commandFailed,
  parsed,
  taskPool,
  packageId = null,
  executionAdmission = null,
  isolatedWorkspaceAllocation = null,
  mainAgentInitialization = null,
}) {
  return {
    commandFailed,
    parsed,
    taskPool,
    packageId,
    executionAdmission,
    isolatedWorkspaceAllocation,
    mainAgentInitialization,
    taskContextPackage: taskPool && packageId ? findTaskContextPackage(taskPool, packageId) : null,
  };
}

export async function prepareRecommendationExecution({
  commandResult,
  tasks,
  startupCheck,
  projectProfile,
  existingTaskContextPackages = [],
  runMainAgentSession,
  stageSwitches,
  repositoryDir,
  now = () => new Date().toISOString(),
  prepareDownstream = true,
}) {
  const commandFailed = Boolean(commandResult.error || commandResult.exitCode !== 0);
  const parsed = commandFailed
    ? { appendRequest: null, intent: null, error: null }
    : parseRecommendationIntent(commandResult.stdout ?? "");
  let taskPool = commandFailed ? null : buildTaskPool(tasks, {
    taskContextPackages: existingTaskContextPackages,
  });

  if (!prepareDownstream) {
    return {
      commandFailed,
      parsed,
      taskPool,
      packageId: parsed.appendRequest?.packageId ?? null,
      executionAdmission: null,
      isolatedWorkspaceAllocation: null,
      mainAgentInitialization: null,
      taskContextPackage: null,
    };
  }

  if (commandFailed || !parsed.appendRequest) {
    return createPreparationResult({
      commandFailed,
      parsed,
      taskPool,
    });
  }

  const packageId = parsed.appendRequest.packageId;
  const candidateTasks = taskPool.views.candidateTasks;
  taskPool = applyAppendRequest(taskPool, parsed.appendRequest, {
    currentWorkStage: "task-recommender",
  });

  if (!isWorkflowStageEnabled(stageSwitches, "executionAdmission")) {
    return createPreparationResult({
      commandFailed,
      parsed,
      taskPool,
      packageId,
    });
  }

  const intentPackage = findTaskContextPackage(taskPool, packageId);
  const executionAdmission = evaluateExecutionAdmission({
    taskContextPackage: intentPackage,
    candidateTasks,
    runtimeSnapshot: startupCheck.runtimeSnapshot,
    projectProfile,
  });
  taskPool = !executionAdmission?.appendRequest
    ? taskPool
    : applyAppendRequest(taskPool, executionAdmission.appendRequest, {
        currentWorkStage: "execution-admission",
      });

  if (
    executionAdmission?.appendRequest?.artifactType !== "executionAuthorization"
    || !isWorkflowStageEnabled(stageSwitches, "isolatedWorkspace")
  ) {
    return createPreparationResult({
      commandFailed,
      parsed,
      taskPool,
      packageId,
      executionAdmission,
    });
  }

  const authorizedPackage = findTaskContextPackage(taskPool, packageId);
  const isolatedWorkspaceAllocation = allocateIsolatedWorkspace({
    taskContextPackage: authorizedPackage,
    repositoryDir,
  });
  taskPool = !isolatedWorkspaceAllocation?.appendRequest
    ? taskPool
    : applyAppendRequest(taskPool, isolatedWorkspaceAllocation.appendRequest, {
        currentWorkStage: "isolated-workspace",
      });

  if (!isolatedWorkspaceAllocation?.appendRequest || !isWorkflowStageEnabled(stageSwitches, "mainAgent")) {
    return createPreparationResult({
      commandFailed,
      parsed,
      taskPool,
      packageId,
      executionAdmission,
      isolatedWorkspaceAllocation,
    });
  }

  const workspaceReadyPackage = findTaskContextPackage(taskPool, packageId);
  const mainAgentInitialization = await initializeMainAgent({
    taskContextPackage: workspaceReadyPackage,
    runAgentSession: runMainAgentSession,
    repositoryDir,
    now,
  });
  taskPool = !mainAgentInitialization?.appendRequest
    ? taskPool
    : applyAppendRequest(taskPool, mainAgentInitialization.appendRequest, {
        currentWorkStage: "main-agent",
      });

  return createPreparationResult({
    commandFailed,
    parsed,
    taskPool,
    packageId,
    executionAdmission,
    isolatedWorkspaceAllocation,
    mainAgentInitialization,
  });
}
