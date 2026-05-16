function summarizeTask(task) {
  return task
    ? {
        id: task.id,
        sourceFile: task.sourceFile,
        title: task.title,
        type: task.type,
        priority: task.priority,
        status: task.status,
        validationStatus: task.validation?.status ?? "unknown",
      }
    : null;
}

function summarizeExecutionIntent(executionIntent) {
  return executionIntent
    ? {
        recommendedTask: { ...executionIntent.recommendedTask },
        confidence: executionIntent.confidence,
        rationaleCount: executionIntent.rationale?.length ?? 0,
        nextAction: executionIntent.nextAction,
      }
    : null;
}

function summarizeExecutionAuthorization(executionAdmission) {
  return executionAdmission?.authorized
    ? {
        status: executionAdmission.status,
        taskId: executionAdmission.taskId,
        requiresConfirmation: executionAdmission.requiresConfirmation,
        runtimeStatus: executionAdmission.runtimeStatus,
      }
    : null;
}

function summarizeAdmissionBlock(executionAdmission) {
  return executionAdmission && !executionAdmission.authorized
    ? {
        status: executionAdmission.status,
        taskId: executionAdmission.taskId,
        reasons: [...(executionAdmission.reasons ?? [])],
      }
    : null;
}

function resolvePackageStatus({ task, executionIntent, executionAdmission }) {
  if (executionAdmission?.authorized) return "authorization-appended";
  if (executionAdmission && !executionAdmission.authorized) return "authorization-blocked";
  if (executionIntent) return "intent-appended";
  if (task?.status) return task.status;
  return "missing-task";
}

function buildRecords({ task, executionIntent, executionAdmission }) {
  const records = [];

  if (task) {
    records.push({
      stage: "任务解析器",
      artifact: "任务上下文包",
      status: task.status,
      summary: `由 ${task.sourceFile} 生成基础任务上下文包。`,
    });
  }

  if (executionIntent) {
    records.push({
      stage: "任务推荐器",
      artifact: "执行意图",
      status: "appended",
      summary: `推荐执行 ${executionIntent.recommendedTask.id}，confidence: ${executionIntent.confidence}。`,
    });
  }

  if (executionAdmission?.authorized) {
    records.push({
      stage: "执行准入器",
      artifact: "执行授权",
      status: "appended",
      summary: `已为 ${executionAdmission.taskId} 追加执行授权。`,
    });
  } else if (executionAdmission) {
    records.push({
      stage: "执行准入器",
      artifact: "授权拒绝",
      status: "blocked",
      summary: `未追加执行授权：${executionAdmission.reasons?.join("; ") || "无原因"}`,
    });
  }

  return records;
}

export function buildTaskContextPackage({
  taskPool,
  executionIntent,
  executionAdmission,
} = {}) {
  const taskId =
    executionAdmission?.taskId ??
    executionIntent?.recommendedTask?.id ??
    null;
  if (!taskId) return null;

  const task = taskPool?.entries?.find((entry) => entry.id === taskId) ?? null;
  const status = resolvePackageStatus({ task, executionIntent, executionAdmission });

  return {
    schemaVersion: 1,
    id: `task-context-package:${taskId}`,
    taskId,
    sourceFile: task?.sourceFile ?? executionIntent?.recommendedTask?.sourceFile ?? null,
    status,
    currentStage: "执行准入器",
    task: summarizeTask(task),
    appended: {
      executionIntent: summarizeExecutionIntent(executionIntent),
      executionAuthorization: summarizeExecutionAuthorization(executionAdmission),
      admissionBlock: summarizeAdmissionBlock(executionAdmission),
    },
    records: buildRecords({ task, executionIntent, executionAdmission }),
  };
}
