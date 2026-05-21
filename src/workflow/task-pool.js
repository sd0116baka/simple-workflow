import { cloneJsonValue } from "./json-value.js";

const MULTI_ARTIFACT_TYPES = new Set([
  "executionReport",
  "reviewReport",
  "convergenceAdvice",
  "convergenceFailure",
  "humanConvergenceGuidance",
]);

function toTaskDraft(entry) {
  return {
    id: entry.parsed?.id ?? entry.id,
    name: entry.parsed?.title ?? entry.title,
    kind: entry.parsed?.type ?? "default",
    priority: entry.parsed?.priority ?? "default",
    goal: entry.parsed?.description ?? "default",
    acceptanceCriteria: Array.isArray(entry.parsed?.acceptance)
      ? [...entry.parsed.acceptance]
      : "default",
    maxIterations: "default",
  };
}

function toRecognition(entry) {
  return {
    outcome: entry.status === "ready" ? "recognized" : "incomplete",
    findings: entry.validation?.errors?.map((message) => ({
      field: "taskDraft",
      severity: "blocking",
      message,
    })) ?? [],
  };
}

function toQualityGate(entry) {
  return {
    outcome: entry.status === "ready" ? "pass" : "fail",
  };
}

function toTaskContextPackage(entry, existingPackage = null) {
  return {
    packageId: entry.packageId,
    currentWorkStage: existingPackage?.currentWorkStage ?? "task-pool",
    source: {
      path: `tasks/${entry.sourceFile}`,
      format: "yaml",
      contentHash: "unavailable",
    },
    recognition: toRecognition(entry),
    taskDraft: toTaskDraft(entry),
    qualityGate: toQualityGate(entry),
    artifacts: cloneJsonValue(existingPackage?.artifacts ?? {}),
    agentRuns: cloneJsonValue(existingPackage?.agentRuns ?? []),
    timeline: cloneJsonValue(existingPackage?.timeline ?? []),
  };
}

function toEntry(task) {
  return {
    id: task.parsed.id ?? task.id,
    packageId: `task-context-package:tasks/${task.fileName}`,
    sourceFile: task.fileName,
    title: task.parsed.title ?? null,
    type: task.parsed.type ?? null,
    priority: task.parsed.priority ?? null,
    status: task.validation?.status === "valid" ? "ready" : "blocked",
    parsed: task.parsed,
    validation: task.validation,
  };
}

function entryStatusFromPackage(entry, taskPackage) {
  if (entry.status !== "ready") return entry.status;
  return taskPackage.currentWorkStage === "task-pool"
    ? "ready"
    : taskPackage.currentWorkStage;
}

function buildViews(taskContextPackages) {
  return {
    candidateTasks: taskContextPackages
      .filter((taskPackage) =>
        taskPackage.qualityGate.outcome === "pass"
          && taskPackage.currentWorkStage === "task-pool")
      .map((taskPackage) => ({
        packageId: taskPackage.packageId,
        taskDraft: cloneJsonValue(taskPackage.taskDraft),
      })),
    needsAttention: taskContextPackages
      .filter((taskPackage) => taskPackage.recognition.outcome === "incomplete")
      .map((taskPackage) => taskPackage.packageId),
    brokenContent: [],
  };
}

export function buildTaskPool(tasks, existingTaskPool = null) {
  const existingPackages = new Map(
    (existingTaskPool?.taskContextPackages ?? []).map((taskPackage) => [
      taskPackage.packageId,
      taskPackage,
    ]),
  );
  const entries = tasks
    .filter((task) => task.parseError === null && task.parsed)
    .map(toEntry);
  const taskContextPackages = entries.map((entry) =>
    toTaskContextPackage(entry, existingPackages.get(entry.packageId) ?? null),
  );
  const packagesById = new Map(taskContextPackages.map((taskPackage) => [
    taskPackage.packageId,
    taskPackage,
  ]));
  const entriesWithWorkflowStatus = entries.map((entry) => ({
    ...entry,
    status: entryStatusFromPackage(entry, packagesById.get(entry.packageId)),
  }));

  return {
    entries: entriesWithWorkflowStatus,
    taskContextPackages,
    views: buildViews(taskContextPackages),
  };
}

export function findTaskContextPackage(taskPool, packageId) {
  return taskPool?.taskContextPackages?.find((taskPackage) => taskPackage.packageId === packageId) ?? null;
}

function artifactRecord({ artifactId, artifact, appendedAt }) {
  return {
    artifactId,
    body: cloneJsonValue(artifact),
    appendedAt,
  };
}

function nextMultiArtifactId(artifacts, artifactType) {
  const existing = Array.isArray(artifacts?.[artifactType])
    ? artifacts[artifactType]
    : [];
  return `${artifactType}:${String(existing.length + 1).padStart(3, "0")}`;
}

function appendArtifact(artifacts, appendRequest, appendedAt) {
  if (!appendRequest.artifactType) return { artifacts, artifactId: null };

  const artifactType = appendRequest.artifactType;
  const artifactId = MULTI_ARTIFACT_TYPES.has(artifactType)
    ? nextMultiArtifactId(artifacts, artifactType)
    : artifactType;
  const record = artifactRecord({
    artifactId,
    artifact: appendRequest.artifact,
    appendedAt,
  });

  if (MULTI_ARTIFACT_TYPES.has(artifactType)) {
    return {
      artifactId,
      artifacts: {
        ...artifacts,
        [artifactType]: [
          ...(Array.isArray(artifacts?.[artifactType]) ? artifacts[artifactType] : []),
          record,
        ],
      },
    };
  }

  return {
    artifactId,
    artifacts: {
      ...artifacts,
      [artifactType]: record,
    },
  };
}

function normalizeAgentRun(agentRun, artifactId) {
  if (!agentRun) return null;
  return {
    ...cloneJsonValue(agentRun),
    outputArtifactRefs: artifactId ? [artifactId] : [],
  };
}

function validateAgentRun(agentRun) {
  for (const field of ["runId", "role", "sessionId", "status", "startedAt", "finishedAt"]) {
    if (!agentRun[field]) {
      throw new Error(`appendRequest.agentRun.${field} is required`);
    }
  }
  if (!["main", "execution", "review"].includes(agentRun.role)) {
    throw new Error("appendRequest.agentRun.role must be main, execution, or review");
  }
  if (!Array.isArray(agentRun.inputArtifactRefs)) {
    throw new Error("appendRequest.agentRun.inputArtifactRefs must be an array");
  }
  if (!Array.isArray(agentRun.outputArtifactRefs)) {
    throw new Error("appendRequest.agentRun.outputArtifactRefs must be an array");
  }
}

export function applyAppendRequest(taskPool, appendRequest, { currentWorkStage } = {}) {
  if (!appendRequest?.packageId) {
    throw new Error("appendRequest.packageId is required");
  }
  const hasArtifact = Boolean(appendRequest.artifactType);
  const hasAgentRun = Boolean(appendRequest.agentRun);
  if (!hasArtifact && !hasAgentRun) {
    throw new Error("appendRequest requires artifact or agentRun");
  }
  if (hasArtifact && (typeof appendRequest.artifact !== "object" || appendRequest.artifact === null)) {
    throw new Error("appendRequest.artifact must be an object");
  }
  if (hasAgentRun && (typeof appendRequest.agentRun !== "object" || appendRequest.agentRun === null)) {
    throw new Error("appendRequest.agentRun must be an object");
  }
  if (hasAgentRun) {
    validateAgentRun(appendRequest.agentRun);
  }

  const target = findTaskContextPackage(taskPool, appendRequest.packageId);
  if (!target) {
    throw new Error(`Task context package not found: ${appendRequest.packageId}`);
  }

  const updatedPackages = taskPool.taskContextPackages.map((taskPackage) => {
    if (taskPackage.packageId !== appendRequest.packageId) return taskPackage;
    const appendedAt = appendRequest.artifact?.appendedAt
      ?? appendRequest.agentRun?.finishedAt
      ?? new Date().toISOString();
    const { artifacts, artifactId } = appendArtifact(
      taskPackage.artifacts,
      appendRequest,
      appendedAt,
    );
    const agentRun = normalizeAgentRun(appendRequest.agentRun, artifactId);
    return {
      ...taskPackage,
      currentWorkStage: currentWorkStage ?? taskPackage.currentWorkStage,
      artifacts,
      agentRuns: agentRun
        ? [...taskPackage.agentRuns, agentRun]
        : taskPackage.agentRuns,
      timeline: [
        ...taskPackage.timeline,
        {
          artifactType: appendRequest.artifactType ?? null,
          artifactId,
          agentRunId: agentRun?.runId ?? null,
          appendedAt,
        },
      ],
    };
  });

  return {
    ...taskPool,
    taskContextPackages: updatedPackages,
    views: buildViews(updatedPackages),
  };
}
