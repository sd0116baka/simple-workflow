import { evaluateExecutionAdmission } from "./execution-admission.js";
import { allocateIsolatedWorkspace } from "./isolated-workspace-flow.js";
import { parseRecommendationIntent } from "./execution-intent-contract.js";
import { initializeMainAgent } from "./main-agent-flow.js";
import { applyAppendRequest, buildTaskPool, findTaskContextPackage } from "./task-pool.js";
import { hasArtifactBody } from "./task-package-artifacts.js";
import { isWorkflowStageEnabled } from "./workflow-stage-switches.js";

const MAIN_AGENT_INITIALIZATION_RUN_ID = "main-agent:initialization";

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
  let currentPackage = findTaskContextPackage(taskPool, packageId);
  if (!hasArtifactBody(currentPackage, "executionIntent")) {
    taskPool = applyAppendRequest(taskPool, parsed.appendRequest, {
      currentWorkStage: "task-recommender",
    });
    currentPackage = findTaskContextPackage(taskPool, packageId);
  }

  if (!isWorkflowStageEnabled(stageSwitches, "executionAdmission")) {
    return createPreparationResult({
      commandFailed,
      parsed,
      taskPool,
      packageId,
    });
  }

  let executionAdmission = null;
  if (!hasArtifactBody(currentPackage, "executionAuthorization")) {
    executionAdmission = evaluateExecutionAdmission({
      taskContextPackage: currentPackage,
      candidateTasks,
      runtimeSnapshot: startupCheck.runtimeSnapshot,
      projectProfile,
    });
    taskPool = !executionAdmission?.appendRequest
      ? taskPool
      : applyAppendRequest(taskPool, executionAdmission.appendRequest, {
          currentWorkStage: "execution-admission",
        });
    currentPackage = findTaskContextPackage(taskPool, packageId);
  }

  if (
    !hasArtifactBody(currentPackage, "executionAuthorization")
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

  let isolatedWorkspaceAllocation = null;
  if (!hasArtifactBody(currentPackage, "isolatedWorkspace")) {
    isolatedWorkspaceAllocation = allocateIsolatedWorkspace({
      taskContextPackage: currentPackage,
      repositoryDir,
    });
    taskPool = !isolatedWorkspaceAllocation?.appendRequest
      ? taskPool
      : applyAppendRequest(taskPool, isolatedWorkspaceAllocation.appendRequest, {
          currentWorkStage: "isolated-workspace",
        });
    currentPackage = findTaskContextPackage(taskPool, packageId);
  }

  if (!hasArtifactBody(currentPackage, "isolatedWorkspace") || !isWorkflowStageEnabled(stageSwitches, "mainAgent")) {
    return createPreparationResult({
      commandFailed,
      parsed,
      taskPool,
      packageId,
      executionAdmission,
      isolatedWorkspaceAllocation,
    });
  }

  let mainAgentInitialization = null;
  const mainAgentAlreadyInitialized = currentPackage.agentRuns
    ?.some((agentRun) => agentRun.runId === MAIN_AGENT_INITIALIZATION_RUN_ID);
  if (!mainAgentAlreadyInitialized) {
    mainAgentInitialization = await initializeMainAgent({
      taskContextPackage: currentPackage,
      runAgentSession: runMainAgentSession,
      repositoryDir,
      now,
    });
    taskPool = !mainAgentInitialization?.appendRequest
      ? taskPool
      : applyAppendRequest(taskPool, mainAgentInitialization.appendRequest, {
          currentWorkStage: "main-agent",
        });
  }

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
