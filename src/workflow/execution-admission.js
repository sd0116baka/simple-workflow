function block(taskId, reasons, extra = {}) {
  return {
    status: "blocked",
    canExecute: false,
    taskId,
    requiresConfirmation: false,
    reasons,
    ...extra,
  };
}

export function evaluateExecutionAdmission({
  executionIntent,
  taskPool,
  runtimeStatus,
} = {}) {
  const taskId = executionIntent?.recommendedTask?.id ?? null;

  if (!executionIntent) {
    return block(null, ["No execution intent"]);
  }

  const task = taskPool?.entries?.find((entry) => entry.id === taskId) ?? null;
  if (!task) {
    return block(taskId, [`Recommended task ${taskId} is not in the task pool`], {
      recommendedTask: executionIntent.recommendedTask,
    });
  }

  const reasons = [];
  if (task.status !== "ready") {
    reasons.push(`Recommended task ${taskId} is ${task.status}`);
  }
  if (!runtimeStatus?.canStartNewTask) {
    reasons.push(...(runtimeStatus?.blockingReasons ?? ["Runtime does not allow starting a task"]));
  }
  const runnable = runtimeStatus?.runnableTasks?.some((entry) => entry.id === taskId) ?? false;
  if (runtimeStatus?.canStartNewTask && !runnable) {
    reasons.push(`Recommended task ${taskId} is not runnable now`);
  }

  if (reasons.length > 0) {
    return block(taskId, reasons, {
      task,
      runtimeStatus: runtimeStatus?.status ?? "unknown",
    });
  }

  return {
    status: "ready",
    canExecute: true,
    taskId,
    requiresConfirmation: true,
    reasons: [],
    task,
    runtimeStatus: runtimeStatus.status,
  };
}
