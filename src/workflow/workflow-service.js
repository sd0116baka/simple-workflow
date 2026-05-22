import { join } from "node:path";
import { getRepositoryStatus as readRepositoryStatus } from "./repository-status.js";
import { runOpencodeExecutionAgentSession } from "./execution-agent-session-runner.js";
import { runOpencodeRecommendation } from "./recommendation-runner.js";
import { createTaskContextPackageWorkspace } from "./task-context-package-workspace.js";
import { createRecommendationRunLifecycle } from "./recommendation-run-lifecycle.js";
import { createTaskSourceWatcher } from "./task-source-watcher.js";
import { createManualWorkflowActionService } from "./manual-workflow-action-service.js";
import { createWorkflowTestFixtureService } from "./workflow-test-fixture-service.js";
import { createWorkflowReadModelService } from "./workflow-read-model-service.js";
import { createWorkflowEventBus } from "./workflow-event-bus.js";
import { createManualWorkflowActionTargets } from "./manual-workflow-action-targets.js";
import { createWorkflowTaskContextMutationService } from "./workflow-task-context-mutation-service.js";
import { createWorkflowServiceRuntime } from "./workflow-service-runtime.js";
import { createTerminalSessionService } from "./terminal-session-service.js";

export function createWorkflowService({
  tasksDir,
  repositoryDir = process.cwd(),
  getRepositoryStatus = () => readRepositoryStatus({ cwd: repositoryDir }),
  recommendationPromptPath = join(repositoryDir, "project_profiles", "recommender-agent.prompt.md"),
  taskContextPackageStoreDir = join(repositoryDir, ".workflow", "task-context-packages"),
  runRecommendationCommand = null,
  runMainAgentSession,
  runExecutionAgentSession = runOpencodeExecutionAgentSession,
  runReviewAgentSession,
  runConvergenceSession,
  watchDebounceMs = 100,
}) {
  const workflowEventBus = createWorkflowEventBus();
  const taskContextWorkspace = createTaskContextPackageWorkspace({
    tasksDir,
    taskContextPackageStoreDir,
  });
  const taskSourceWatcher = createTaskSourceWatcher({
    tasksDir,
    watchDebounceMs,
    onTaskChange: workflowEventBus.emitTaskChange,
  });
  const terminalSessionService = createTerminalSessionService({
    repositoryDir,
    emitTerminalSessionChanged: workflowEventBus.emitTerminalSessionChanged,
  });
  const effectiveRunRecommendationCommand = runRecommendationCommand
    ?? (({ prompt, onProgress, onTerminalSession, signal }) =>
      runOpencodeRecommendation({
        prompt,
        cwd: repositoryDir,
        onProgress,
        onTerminalSession,
        signal,
        terminalSessionService,
      }));

  const taskContextMutationService = createWorkflowTaskContextMutationService({
    taskContextWorkspace,
    getLatestRecommendationRun: () => recommendationRunLifecycle.getLatestRecommendationRun(),
  });
  const recommendationRunLifecycle = createRecommendationRunLifecycle({
    tasksDir,
    repositoryDir,
    recommendationPromptPath,
    taskContextWorkspace,
    getStartupCheck: () => workflowReadModelService.getStartupCheck(),
    persistTaskContextPackage: taskContextMutationService.persistTaskContextPackage,
    runRecommendationCommand: effectiveRunRecommendationCommand,
    runMainAgentSession,
    runExecutionAgentSession,
    runReviewAgentSession,
    runConvergenceSession,
    emitRecommendationChanged: workflowEventBus.emitRecommendationChanged,
  });
  const manualWorkflowActionTargets = createManualWorkflowActionTargets({
    taskContextWorkspace,
    getLatestRecommendationRun: () => recommendationRunLifecycle.getLatestRecommendationRun(),
  });
  const manualWorkflowActionService = createManualWorkflowActionService({
    repositoryDir,
    runExecutionAgentSession,
    runReviewAgentSession,
    runConvergenceSession,
    recommendationRunLifecycle,
    ...manualWorkflowActionTargets,
    applyAppendRequest: taskContextMutationService.applyAppendRequest,
    emitRecommendationChanged: workflowEventBus.emitRecommendationChanged,
  });
  const workflowTestFixtureService = createWorkflowTestFixtureService({
    repositoryDir,
    tasksDir,
    storeDir: taskContextPackageStoreDir,
    recommendationRunLifecycle,
    emitTaskChange: workflowEventBus.emitTaskChange,
  });
  const workflowReadModelService = createWorkflowReadModelService({
    tasksDir,
    taskContextWorkspace,
    getRepositoryStatus,
    getLatestRecommendationRun: () => recommendationRunLifecycle.getLatestRecommendationRun(),
  });

  return createWorkflowServiceRuntime({
    workflowReadModelService,
    workflowTestFixtureService,
    recommendationRunLifecycle,
    manualWorkflowActionService,
    terminalSessionService,
    workflowEventBus,
    taskSourceWatcher,
  });
}
