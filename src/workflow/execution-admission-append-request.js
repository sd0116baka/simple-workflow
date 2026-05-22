import { cloneJsonValue } from "./json-value.js";
import { normalizeRuntimeSnapshot } from "./execution-admission-runtime.js";

export function buildAdmissionRejectionRequest({
  packageId,
  rejectedAt,
  findings,
}) {
  return {
    appendRequest: {
      packageId,
      artifactType: "admissionRejection",
      artifact: {
        rejectedAt,
        findings,
      },
    },
  };
}

export function buildAdmissionDefaultDecisionRequest({
  packageId,
  requestedAt,
  findings,
}) {
  return {
    appendRequest: {
      packageId,
      artifactType: "humanDecisionRequest",
      artifact: {
        requestedAt,
        reason: "执行授权需要 Project Profile 默认值，但当前无法确定。",
        findings,
      },
    },
  };
}

export function buildExecutionAuthorizationRequest({
  taskContextPackage,
  authorizedAt,
  runtimeSnapshot,
  maxIterations,
}) {
  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "executionAuthorization",
      artifact: {
        authorizedAt,
        task: {
          id: taskContextPackage.taskDraft?.id ?? null,
          name: taskContextPackage.taskDraft?.name ?? null,
          goal: taskContextPackage.taskDraft?.goal ?? null,
          acceptanceCriteria: [...(taskContextPackage.taskDraft?.acceptanceCriteria ?? [])],
        },
        runtimeSnapshot: cloneJsonValue(normalizeRuntimeSnapshot(runtimeSnapshot)),
        termination: {
          maxIterations,
        },
      },
    },
  };
}
