import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAdmissionDefaultDecisionRequest,
  buildAdmissionRejectionRequest,
  buildExecutionAuthorizationRequest,
} from "../src/workflow/execution-admission-append-request.js";
import { createTaskContextPackageFixture } from "./support/task-context-package-fixtures.js";

const taskContextPackage = createTaskContextPackageFixture({
  taskDraft: {
    id: "task-001",
    name: "展示任务真源",
    goal: "展示任务",
    acceptanceCriteria: ["可以看到任务"],
  },
});

test("execution admission append module builds execution authorization request", () => {
  const appendResult = buildExecutionAuthorizationRequest({
    taskContextPackage,
    authorizedAt: "2026-05-21T14:00:00.000Z",
    runtimeSnapshot: {
      activeWork: null,
      worktree: {
        clean: true,
        changedFiles: [],
      },
    },
    maxIterations: 3,
  });

  assert.deepEqual(appendResult, {
    appendRequest: {
      packageId: "task-context-package:tasks/task-001.yaml",
      artifactType: "executionAuthorization",
      artifact: {
        authorizedAt: "2026-05-21T14:00:00.000Z",
        task: {
          id: "task-001",
          name: "展示任务真源",
          goal: "展示任务",
          acceptanceCriteria: ["可以看到任务"],
        },
        runtimeSnapshot: {
          activeWork: null,
          worktree: {
            clean: true,
            changedFiles: [],
          },
        },
        termination: {
          maxIterations: 3,
        },
      },
    },
  });
});

test("execution admission append module builds rejection and default decision requests", () => {
  const finding = {
    field: "worktree",
    severity: "blocking",
    code: "WORKTREE_DIRTY",
    message: "工作区存在未提交变更。",
  };

  assert.deepEqual(buildAdmissionRejectionRequest({
    packageId: "task-context-package:tasks/task-001.yaml",
    rejectedAt: "2026-05-21T14:01:00.000Z",
    findings: [finding],
  }), {
    appendRequest: {
      packageId: "task-context-package:tasks/task-001.yaml",
      artifactType: "admissionRejection",
      artifact: {
        rejectedAt: "2026-05-21T14:01:00.000Z",
        findings: [finding],
      },
    },
  });

  assert.deepEqual(buildAdmissionDefaultDecisionRequest({
    packageId: "task-context-package:tasks/task-001.yaml",
    requestedAt: "2026-05-21T14:02:00.000Z",
    findings: [finding],
  }), {
    appendRequest: {
      packageId: "task-context-package:tasks/task-001.yaml",
      artifactType: "humanDecisionRequest",
      artifact: {
        requestedAt: "2026-05-21T14:02:00.000Z",
        reason: "执行授权需要 Project Profile 默认值，但当前无法确定。",
        findings: [finding],
      },
    },
  });
});
