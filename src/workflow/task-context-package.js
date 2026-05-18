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
        recommendedPackageId: executionIntent.recommendedPackageId ?? packageId,
        confidence: executionIntent.confidence,
        selectionReasoning: [...(executionIntent.selectionReasoning ?? [])],
        candidateComparison: clone(executionIntent.candidateComparison ?? []),
        executionBrief: clone(executionIntent.executionBrief),
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
  const packageId =
    executionIntent?.recommendedPackageId ??
    appendRequest?.packageId ??
    null;
  if (!packageId) return null;
  const task = taskPool?.entries?.find((entry) => entry.packageId === packageId) ?? null;

  const artifacts = {};
  const executionIntentArtifact = toExecutionIntentArtifact(executionIntent, packageId);
  if (executionIntentArtifact) {
    artifacts.executionIntent = executionIntentArtifact;
  }
  applyAppendRequest(artifacts, appendRequest);

  return {
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
