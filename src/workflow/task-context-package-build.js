import { cloneJsonValue } from "./json-value.js";
import { createInitialTaskModuleStates } from "./module-status.js";

function taskDraftFromEntry(entry) {
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

function recognitionFromEntry(entry) {
  return {
    outcome: entry.status === "ready" ? "recognized" : "incomplete",
    findings: entry.validation?.errors?.map((message) => ({
      field: "taskDraft",
      severity: "blocking",
      message,
    })) ?? [],
  };
}

function qualityGateFromEntry(entry) {
  return {
    outcome: entry.status === "ready" ? "pass" : "fail",
  };
}

export function taskContextPackageFromEntry(entry, existingPackage = null) {
  return {
    packageId: entry.packageId,
    currentWorkStage: existingPackage?.currentWorkStage ?? "task-pool",
    source: {
      path: `tasks/${entry.sourceFile}`,
      format: "yaml",
      contentHash: "unavailable",
    },
    recognition: recognitionFromEntry(entry),
    taskDraft: taskDraftFromEntry(entry),
    qualityGate: qualityGateFromEntry(entry),
    artifacts: cloneJsonValue(existingPackage?.artifacts ?? {}),
    agentRuns: cloneJsonValue(existingPackage?.agentRuns ?? []),
    timeline: cloneJsonValue(existingPackage?.timeline ?? []),
    modules: createInitialTaskModuleStates(existingPackage?.modules),
  };
}

export function taskContextPackagesFromEntries(entries, existingTaskPool = null) {
  const existingPackages = new Map(
    (existingTaskPool?.taskContextPackages ?? []).map((taskPackage) => [
      taskPackage.packageId,
      taskPackage,
    ]),
  );
  return entries.map((entry) =>
    taskContextPackageFromEntry(entry, existingPackages.get(entry.packageId) ?? null),
  );
}
