function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

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
    artifacts: clone(existingPackage?.artifacts ?? {}),
    agents: clone(existingPackage?.agents ?? {}),
    timeline: clone(existingPackage?.timeline ?? []),
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

function buildViews(taskContextPackages) {
  return {
    candidateTasks: taskContextPackages
      .filter((taskPackage) => taskPackage.qualityGate.outcome === "pass")
      .map((taskPackage) => ({
        packageId: taskPackage.packageId,
        taskDraft: clone(taskPackage.taskDraft),
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

  return {
    entries,
    taskContextPackages,
    views: buildViews(taskContextPackages),
  };
}

export function findTaskContextPackage(taskPool, packageId) {
  return taskPool?.taskContextPackages?.find((taskPackage) => taskPackage.packageId === packageId) ?? null;
}

export function applyAppendRequest(taskPool, appendRequest, { currentWorkStage } = {}) {
  if (!appendRequest?.packageId) {
    throw new Error("appendRequest.packageId is required");
  }
  if (!appendRequest?.artifactType) {
    throw new Error("appendRequest.artifactType is required");
  }
  if (!appendRequest || typeof appendRequest.artifact !== "object" || appendRequest.artifact === null) {
    throw new Error("appendRequest.artifact must be an object");
  }

  const target = findTaskContextPackage(taskPool, appendRequest.packageId);
  if (!target) {
    throw new Error(`Task context package not found: ${appendRequest.packageId}`);
  }

  const updatedPackages = taskPool.taskContextPackages.map((taskPackage) => {
    if (taskPackage.packageId !== appendRequest.packageId) return taskPackage;
    return {
      ...taskPackage,
      currentWorkStage: currentWorkStage ?? taskPackage.currentWorkStage,
      artifacts: {
        ...taskPackage.artifacts,
        [appendRequest.artifactType]: clone(appendRequest.artifact),
      },
      timeline: [
        ...taskPackage.timeline,
        {
          artifactType: appendRequest.artifactType,
          appendedAt: appendRequest.artifact.appendedAt ?? new Date().toISOString(),
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
