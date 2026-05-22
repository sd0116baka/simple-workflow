export function renderWorkflowTaskSource({
  elements,
  workflowOverviewRenderers,
  tasks,
  selectedFileName,
}) {
  workflowOverviewRenderers.renderTaskSource({
    taskList: elements.taskList,
    taskCount: elements.taskCount,
    taskSourceInputs: elements.taskSourceInputs,
    tasks,
    selectedFileName,
  });
}

export function renderWorkflowTaskPool({
  elements,
  workflowOverviewRenderers,
  tasks,
  poolEntries,
  selectedFileName,
}) {
  workflowOverviewRenderers.renderTaskPool({
    taskPool: elements.taskPool,
    poolCount: elements.poolCount,
    taskPoolRaw: elements.taskPoolRaw,
    taskPoolInputs: elements.taskPoolInputs,
    tasks,
    poolEntries,
    selectedFileName,
  });
}

export function renderWorkflowStartupCheck({
  elements,
  workflowOverviewRenderers,
  startupCheck,
}) {
  workflowOverviewRenderers.renderStartupCheck({
    startupCheckPanel: elements.startupCheckPanel,
    startupCheckRaw: elements.startupCheckRaw,
    startupCheckInputs: elements.startupCheckInputs,
    startupCheckStatus: elements.startupCheckStatus,
    startupCheck,
  });
}
