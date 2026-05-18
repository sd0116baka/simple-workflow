import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateExecutionAdmission,
  evaluateStartupCheck,
  runtimeSnapshotFromRepositoryStatus,
} from "../src/workflow/execution-admission.js";

function taskContextPackage(overrides = {}) {
  return {
    packageId: "task-context-package:tasks/task-001.yaml",
    currentWorkStage: "task-recommender",
    taskDraft: {
      id: "task-001",
      name: "展示任务真源",
      goal: "展示任务",
      acceptanceCriteria: ["可以看到任务"],
      maxIterations: "default",
    },
    artifacts: {
      executionIntent: {
        artifactId: "executionIntent",
        body: {
          recommendedPackageId: "task-context-package:tasks/task-001.yaml",
          confidence: "medium",
        },
        appendedAt: "2026-05-18T09:00:00.000Z",
      },
    },
    ...overrides,
  };
}

const candidateTasks = [{ packageId: "task-context-package:tasks/task-001.yaml" }];
const cleanRuntimeSnapshot = {
  activeWork: null,
  worktree: {
    clean: true,
    changedFiles: [],
  },
};
const projectProfile = {
  defaults: {
    maxIterations: 3,
  },
};

test("startup check passes when the global environment can start work", () => {
  const startupCheck = evaluateStartupCheck({ runtimeSnapshot: cleanRuntimeSnapshot });

  assert.equal(startupCheck.canStartWork, true);
  assert.deepEqual(startupCheck.findings, []);
});

test("startup check blocks when the worktree is dirty", () => {
  const startupCheck = evaluateStartupCheck({
    runtimeSnapshot: {
      activeWork: null,
      worktree: {
        clean: false,
        changedFiles: ["public/app.js"],
      },
    },
  });

  assert.equal(startupCheck.canStartWork, false);
  assert.equal(startupCheck.findings[0].code, "WORKTREE_DIRTY");
});

test("builds runtime snapshot from repository status", () => {
  assert.deepEqual(
    runtimeSnapshotFromRepositoryStatus({
      clean: false,
      entries: [{ code: "M", path: "docs/definitions/execution-admission.md" }],
    }),
    {
      activeWork: null,
      worktree: {
        clean: false,
        changedFiles: ["docs/definitions/execution-admission.md"],
      },
    },
  );
});

test("requests execution authorization when all deterministic checks pass", () => {
  const admission = evaluateExecutionAdmission({
    taskContextPackage: taskContextPackage(),
    candidateTasks,
    runtimeSnapshot: cleanRuntimeSnapshot,
    projectProfile,
    now: () => "2026-05-18T10:00:00.000Z",
  });

  assert.equal(admission.appendRequest.packageId, "task-context-package:tasks/task-001.yaml");
  assert.equal(admission.appendRequest.artifactType, "executionAuthorization");
  assert.equal(admission.appendRequest.artifact.authorizedAt, "2026-05-18T10:00:00.000Z");
  assert.equal(admission.appendRequest.artifact.termination.maxIterations, 3);
});

test("requests admission rejection when execution intent is not a candidate", () => {
  const admission = evaluateExecutionAdmission({
    taskContextPackage: taskContextPackage(),
    candidateTasks: [],
    runtimeSnapshot: cleanRuntimeSnapshot,
    projectProfile,
  });

  assert.equal(admission.appendRequest.artifactType, "admissionRejection");
  assert.equal(admission.appendRequest.artifact.findings[0].code, "INTENT_NOT_CANDIDATE");
});

test("requests human decision when a required default cannot resolve", () => {
  const admission = evaluateExecutionAdmission({
    taskContextPackage: taskContextPackage(),
    candidateTasks,
    runtimeSnapshot: cleanRuntimeSnapshot,
    projectProfile: { defaults: {} },
  });

  assert.equal(admission.appendRequest.artifactType, "humanDecisionRequest");
  assert.equal(admission.appendRequest.artifact.findings[0].code, "DEFAULT_NOT_RESOLVED");
});
