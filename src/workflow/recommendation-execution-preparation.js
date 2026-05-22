import { evaluateExecutionAdmission } from "./execution-admission.js";
import { allocateIsolatedWorkspace } from "./isolated-workspace-flow.js";
import { parseRecommendationIntent } from "./execution-intent-contract.js";
import { initializeMainAgent } from "./main-agent-flow.js";
import { applyAppendRequest, buildTaskPool, findTaskContextPackage } from "./task-pool.js";

export async function prepareRecommendationExecution({
  commandResult,
  tasks,
  startupCheck,
  projectProfile,
  existingTaskContextPackages = [],
  runMainAgentSession,
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
    return {
      commandFailed,
      parsed,
      taskPool,
      packageId: null,
      executionAdmission: null,
      isolatedWorkspaceAllocation: null,
      mainAgentInitialization: null,
      taskContextPackage: null,
    };
  }

  const packageId = parsed.appendRequest.packageId;
  const candidateTasks = taskPool.views.candidateTasks;
  taskPool = applyAppendRequest(taskPool, parsed.appendRequest, {
    currentWorkStage: "task-recommender",
  });

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

  const authorizedPackage = findTaskContextPackage(taskPool, packageId);
  const isolatedWorkspaceAllocation =
    executionAdmission?.appendRequest?.artifactType !== "executionAuthorization"
      ? null
      : allocateIsolatedWorkspace({
          taskContextPackage: authorizedPackage,
          repositoryDir,
        });
  taskPool = !isolatedWorkspaceAllocation?.appendRequest
    ? taskPool
    : applyAppendRequest(taskPool, isolatedWorkspaceAllocation.appendRequest, {
        currentWorkStage: "isolated-workspace",
      });

  const workspaceReadyPackage = findTaskContextPackage(taskPool, packageId);
  const mainAgentInitialization =
    !isolatedWorkspaceAllocation?.appendRequest
      ? null
      : await initializeMainAgent({
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

  return {
    commandFailed,
    parsed,
    taskPool,
    packageId,
    executionAdmission,
    isolatedWorkspaceAllocation,
    mainAgentInitialization,
    taskContextPackage: findTaskContextPackage(taskPool, packageId),
  };
}
