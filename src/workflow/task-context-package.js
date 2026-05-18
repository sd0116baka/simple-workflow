function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toTaskDraft(task) {
  return task
    ? {
        id: task.parsed?.id ?? task.id,
        name: task.parsed?.title ?? task.title,
        kind: task.parsed?.type ?? "default",
        priority: task.parsed?.priority ?? "default",
        goal: task.parsed?.description ?? "default",
        acceptanceCriteria: Array.isArray(task.parsed?.acceptance)
          ? [...task.parsed.acceptance]
          : "default",
        maxIterations: "default",
      }
    : null;
}

function toRecognition(task) {
  return {
    outcome: task?.status === "ready" ? "recognized" : "incomplete",
    findings: task?.validation?.errors?.map((message) => ({
      field: "taskDraft",
      severity: "blocking",
      message,
    })) ?? [],
  };
}

function toQualityGate(task) {
  return {
    outcome: task?.status === "ready" ? "pass" : "fail",
  };
}

function toExecutionIntentArtifact(executionIntent, packageId) {
  return executionIntent
    ? {
        recommendedPackageId: packageId,
        recommendedTask: { ...executionIntent.recommendedTask },
        confidence: executionIntent.confidence,
        rationale: [...(executionIntent.rationale ?? [])],
        nextAction: executionIntent.nextAction,
      }
    : null;
}

function applyAppendRequest(artifacts, appendRequest) {
  if (!appendRequest?.artifactType) return;
  artifacts[appendRequest.artifactType] = clone(appendRequest.artifact);
}

export function buildTaskContextPackage({
  taskPool,
  executionIntent,
  appendRequest,
} = {}) {
  const taskId =
    executionIntent?.recommendedTask?.id ??
    appendRequest?.packageId?.replace(/^task-context-package:tasks\//, "").replace(/\.ya?ml$/, "") ??
    null;
  if (!taskId) return null;

  const task = taskPool?.entries?.find((entry) => entry.id === taskId) ?? null;
  const packageId =
    task?.packageId ??
    appendRequest?.packageId ??
    (executionIntent?.recommendedTask?.sourceFile
      ? `task-context-package:${executionIntent.recommendedTask.sourceFile}`
      : null);
  if (!packageId) return null;

  const artifacts = {};
  const executionIntentArtifact = toExecutionIntentArtifact(executionIntent, packageId);
  if (executionIntentArtifact) {
    artifacts.executionIntent = executionIntentArtifact;
  }
  applyAppendRequest(artifacts, appendRequest);

  return {
    schemaVersion: 1,
    packageId,
    currentWorkStage: appendRequest ? "execution-admission" : "task-recommender",
    source: {
      path: packageId.replace(/^task-context-package:/, ""),
      format: "yaml",
      contentHash: "unavailable",
    },
    recognition: toRecognition(task),
    taskDraft: toTaskDraft(task),
    qualityGate: toQualityGate(task),
    artifacts,
    agents: {},
    timeline: [],
  };
}
