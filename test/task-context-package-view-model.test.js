import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTaskContextPackageViewModel } from "../public/task-context-package-view-model.js";
import { createTaskContextPackageFixture } from "./support/task-context-package-fixtures.js";

test("task context package view model summarizes workflow artifact status", () => {
  const viewModel = buildTaskContextPackageViewModel(createTaskContextPackageFixture({
    currentWorkStage: "auto-merge-execution",
    qualityGate: {
      outcome: "passed",
    },
    artifacts: {
      executionIntent: {
        artifactId: "executionIntent",
        body: {
          executionBrief: {
            goalInterpretation: "实现任务池过滤",
          },
        },
        appendedAt: "2026-05-21T10:00:00.000Z",
      },
      executionAuthorization: {
        artifactId: "executionAuthorization",
        body: {
          authorizedAt: "2026-05-21T10:01:00.000Z",
        },
      },
      isolatedWorkspace: {
        artifactId: "isolatedWorkspace",
        body: {},
      },
      convergenceSuccess: {
        artifactId: "convergenceSuccess",
        body: {
          summary: "已收敛",
        },
      },
      humanDecision: {
        artifactId: "humanDecision",
        body: {},
      },
      autoMergePlan: {
        artifactId: "autoMergePlan",
        body: {},
      },
      autoMergeResult: {
        artifactId: "autoMergeResult",
        body: {},
      },
      taskCloseout: {
        artifactId: "taskCloseout",
        body: {
          finalStage: "closed",
        },
      },
    },
    agentRuns: [
      {
        runId: "execution-agent:001",
        role: "execution",
        status: "succeeded",
        sessionId: "session:execution",
      },
    ],
  }));

  assert.equal(viewModel.className, "context-package auto-merge-execution");
  assert.equal(viewModel.title, "task-context-package:tasks/task-001.yaml");
  assert.equal(viewModel.meta, "currentWorkStage: auto-merge-execution · source: tasks/task-001.yaml");
  assert.deepEqual(viewModel.artifactStatuses.map((item) => item.value), [
    "passed",
    "已追加",
    "已追加",
    "已分配",
    "待确认",
    "已接受收敛成功",
    "已生成",
    "已合并",
    "已关闭",
  ]);
  assert.deepEqual(viewModel.artifactRecords.map((item) => item.id), [
    "executionIntent",
    "executionAuthorization",
    "isolatedWorkspace",
    "convergenceSuccess",
    "humanDecision",
    "autoMergePlan",
    "autoMergeResult",
    "taskCloseout",
  ]);
  assert.equal(viewModel.artifactRecords[0].summary, "实现任务池过滤");
  assert.deepEqual(viewModel.agentRuns, [
    {
      id: "execution-agent:001",
      meta: "execution · succeeded",
      sessionId: "session:execution",
    },
  ]);
});

test("task context package view model reports missing and rejected states", () => {
  const viewModel = buildTaskContextPackageViewModel(createTaskContextPackageFixture({
    packageId: "task-context-package:tasks/task-002.yaml",
    currentWorkStage: "human-decision",
    source: undefined,
    taskDraft: undefined,
    timeline: undefined,
    artifacts: {
      admissionRejection: {
        artifactId: "admissionRejection",
        body: {
          reason: "缺少默认值",
          rejectedAt: "2026-05-21T10:02:00.000Z",
        },
      },
      humanDecisionRequest: {
        artifactId: "humanDecisionRequest",
        body: {
          requestedAt: "2026-05-21T10:03:00.000Z",
        },
      },
      autoMergeRejection: {
        artifactId: "autoMergeRejection",
        body: {},
      },
      autoMergeFailure: {
        artifactId: "autoMergeFailure",
        body: {},
      },
      taskCloseout: {
        artifactId: "taskCloseout",
        body: {
          finalStage: "cancelled",
        },
      },
    },
  }));

  assert.deepEqual(viewModel.artifactStatuses.map((item) => item.value), [
    "missing",
    "未追加",
    "未授权",
    "未分配",
    "未生成",
    "等待人工决策",
    "未通过",
    "失败",
    "已取消",
  ]);
  assert.equal(viewModel.artifactRecords[0].timestamp, "2026-05-21T10:02:00.000Z");
  assert.equal(viewModel.artifactRecords[0].summary, "缺少默认值");
});

test("task context package status ignores malformed single artifact arrays", () => {
  const viewModel = buildTaskContextPackageViewModel(createTaskContextPackageFixture({
    packageId: "task-context-package:tasks/task-003.yaml",
    currentWorkStage: "human-decision",
    source: undefined,
    taskDraft: undefined,
    timeline: undefined,
    artifacts: {
      executionIntent: [{ artifactId: "executionIntent", body: { confidence: "high" } }],
      executionAuthorization: [{ artifactId: "executionAuthorization", body: { authorizedAt: "now" } }],
      isolatedWorkspace: [{ artifactId: "isolatedWorkspace", body: {} }],
      convergenceSuccess: [{ artifactId: "convergenceSuccess", body: {} }],
      humanDecisionRequest: [{ artifactId: "humanDecisionRequest", body: {} }],
      humanDecision: [{ artifactId: "humanDecision", body: {} }],
      autoMergePlan: [{ artifactId: "autoMergePlan", body: {} }],
      autoMergeResult: [{ artifactId: "autoMergeResult", body: {} }],
      taskCloseout: [{ artifactId: "taskCloseout", body: { finalStage: "closed" } }],
    },
  }));

  assert.deepEqual(viewModel.artifactStatuses.map((item) => item.value), [
    "missing",
    "未追加",
    "未追加",
    "未分配",
    "未生成",
    "未请求",
    "未检查",
    "未执行",
    "未收尾",
  ]);
  assert.deepEqual(viewModel.artifactRecords.map((item) => item.id), [
    "executionIntent",
    "executionAuthorization",
    "isolatedWorkspace",
    "convergenceSuccess",
    "humanDecisionRequest",
    "humanDecision",
    "autoMergePlan",
    "autoMergeResult",
    "taskCloseout",
  ]);
});
