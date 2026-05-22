import {
  buildAdmissionDefaultDecisionRequest,
  buildAdmissionRejectionRequest,
  buildExecutionAuthorizationRequest,
} from "./execution-admission-append-request.js";
import { normalizeRuntimeSnapshot } from "./execution-admission-runtime.js";
import { artifactBody } from "./task-package-artifacts.js";

export { runtimeSnapshotFromRepositoryStatus } from "./execution-admission-runtime.js";

function blockingFinding(field, code, message) {
  return {
    field,
    severity: "blocking",
    code,
    message,
  };
}

function hasBlockingFindings(findings) {
  return findings.some((finding) => finding.severity === "blocking");
}

function findDefault(defaults, fieldName) {
  return Object.prototype.hasOwnProperty.call(defaults, fieldName)
    ? defaults[fieldName]
    : undefined;
}

function resolveDefaultField({ fieldName, value, projectProfile, findings }) {
  if (value !== "default") return value;

  const resolved = findDefault(projectProfile?.defaults ?? {}, fieldName);
  if (resolved === undefined) {
    findings.push(
      blockingFinding(
        `taskDraft.${fieldName}`,
        "DEFAULT_NOT_RESOLVED",
        `Project Profile 未提供 ${fieldName} 的默认值。`,
      ),
    );
    return null;
  }
  return resolved;
}

export function evaluateStartupCheck({ runtimeSnapshot } = {}) {
  const snapshot = normalizeRuntimeSnapshot(runtimeSnapshot);
  const findings = [];

  if (snapshot.activeWork) {
    findings.push(
      blockingFinding("activeWork", "ACTIVE_WORK_EXISTS", "当前已有进行中的任务工作。"),
    );
  }

  if (!snapshot.worktree.clean) {
    findings.push(
      blockingFinding("worktree", "WORKTREE_DIRTY", "工作区存在未提交变更。"),
    );
  }

  return {
    canStartWork: !hasBlockingFindings(findings),
    findings,
    runtimeSnapshot: snapshot,
  };
}

export function evaluateExecutionAdmission({
  taskContextPackage,
  candidateTasks = [],
  runtimeSnapshot,
  projectProfile = {},
  now = () => new Date().toISOString(),
} = {}) {
  const packageId = taskContextPackage?.packageId ?? null;
  const findings = [];

  if (!taskContextPackage) {
    return buildAdmissionRejectionRequest({
      packageId: null,
      rejectedAt: now(),
      findings: [
        blockingFinding(
          "taskContextPackage",
          "TASK_CONTEXT_PACKAGE_MISSING",
          "缺少任务上下文包，无法执行授权追加。",
        ),
      ],
    });
  }

  const executionIntent = artifactBody(taskContextPackage, "executionIntent");
  if (!executionIntent) {
    findings.push(
      blockingFinding(
        "artifacts.executionIntent",
        "EXECUTION_INTENT_MISSING",
        "任务上下文包尚未追加执行意图。",
      ),
    );
  }

  if (executionIntent?.recommendedPackageId !== packageId) {
    findings.push(
      blockingFinding(
        "artifacts.executionIntent.recommendedPackageId",
        "INTENT_TARGET_MISMATCH",
        "执行意图没有指向当前任务上下文包。",
      ),
    );
  }

  const candidatePackageIds = new Set(candidateTasks.map((task) => task.packageId));
  if (!candidatePackageIds.has(packageId)) {
    findings.push(
      blockingFinding(
        "candidateTasks",
        "INTENT_NOT_CANDIDATE",
        "执行意图指向的任务不在任务池候选任务视图中。",
      ),
    );
  }

  const startupCheck = evaluateStartupCheck({ runtimeSnapshot });
  findings.push(...startupCheck.findings);

  const maxIterations = resolveDefaultField({
    fieldName: "maxIterations",
    value: taskContextPackage.taskDraft?.maxIterations,
    projectProfile,
    findings,
  });

  if (findings.some((finding) => finding.code === "DEFAULT_NOT_RESOLVED")) {
    return buildAdmissionDefaultDecisionRequest({
      packageId,
      requestedAt: now(),
      findings,
    });
  }

  if (hasBlockingFindings(findings)) {
    return buildAdmissionRejectionRequest({
      packageId,
      rejectedAt: now(),
      findings,
    });
  }

  return buildExecutionAuthorizationRequest({
    taskContextPackage,
    authorizedAt: now(),
    runtimeSnapshot: startupCheck.runtimeSnapshot,
    maxIterations,
  });
}
