import { createWorkflowApiClient } from "./workflow-api-client.js";
import { createWorkflowPageElements } from "./workflow-page-elements.js";
import { createWorkflowPageErrorRenderer } from "./workflow-page-error-renderer.js";
import {
  connectWorkflowEventStream,
  startRecommendationRunRefreshLoop,
} from "./workflow-page-lifecycle.js";
import { createWorkflowPageErrorTargets } from "./workflow-page-shell-targets.js";
import {
  connectWorkflowPageShellEvents,
  startWorkflowPageInitialLoad,
  startWorkflowPageShellRefreshLoop,
} from "./workflow-page-shell-lifecycle.js";
import { createWorkflowPageShellModuleGraph } from "./workflow-page-shell-module-graph.js";

export function createWorkflowPageShell({
  workflowApi = createWorkflowApiClient(),
  elements = createWorkflowPageElements(),
  EventSourceCtor = globalThis.window?.EventSource,
  createErrorRenderer = createWorkflowPageErrorRenderer,
  createModuleGraph = createWorkflowPageShellModuleGraph,
  connectEventStream = connectWorkflowEventStream,
  startRefreshLoop = startRecommendationRunRefreshLoop,
} = {}) {
  const workflowPageErrorRenderer = createErrorRenderer({
    elements: createWorkflowPageErrorTargets(elements),
  });

  let workflowPageCommands;
  let workflowPageDataController;

  function showError(error) {
    workflowPageErrorRenderer.render(error);
  }

  const workflowPageModules = createModuleGraph({
    workflowApi,
    elements,
    showError,
  });
  workflowPageCommands = workflowPageModules.workflowPageCommands;
  workflowPageDataController = workflowPageModules.workflowPageDataController;

  function connectWorkflowEvents() {
    return connectWorkflowPageShellEvents({
      EventSourceCtor,
      connectEventStream,
      workflowPageDataController,
      showError,
    });
  }

  function start() {
    workflowPageCommands.bindPageControls();
    const initialLoad = startWorkflowPageInitialLoad({
      workflowPageDataController,
      showError,
    });
    const eventStream = connectWorkflowEvents();
    const refreshLoop = startWorkflowPageShellRefreshLoop({
      startRefreshLoop,
      workflowPageDataController,
    });
    return {
      eventStream,
      initialLoad,
      refreshLoop,
    };
  }

  return {
    connectWorkflowEvents,
    get commands() {
      return workflowPageCommands;
    },
    get dataController() {
      return workflowPageDataController;
    },
    showError,
    start,
  };
}
