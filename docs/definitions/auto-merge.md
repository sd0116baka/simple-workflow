# 自动合并前置校验

## 职责

自动合并前置校验只判断一个已被人工接受的任务是否可以进入自动合并执行。

本环节不修改主线，不执行合并。

## 输入

输入是处于 `auto-merge` 环节的任务上下文包。

必须存在：

```text
taskCompletion
humanDecision
isolatedWorkspace
```

`humanDecision.body.decision` 必须是 `accept-completion`。

## 通过产物

通过时追加 `autoMergePlan`。

```json
{
  "artifactId": "autoMergePlan",
  "body": {
    "plannedAt": "2026-05-19T10:00:00.000Z",
    "decisionRef": "humanDecision",
    "source": {
      "worktreePath": ".workflow/worktrees/tasks/tasks-task-003",
      "branchName": "workflow/tasks/tasks-task-003",
      "baseCommit": "abc123"
    },
    "target": {
      "branchName": "main",
      "currentCommit": "abc123"
    },
    "changeSet": {
      "changedFiles": [
        ".workflow-agent/execution-agent-001.txt"
      ],
      "hasChanges": true
    },
    "checks": [
      {
        "name": "humanDecisionAccepted",
        "passed": true
      },
      {
        "name": "worktreeExists",
        "passed": true
      },
      {
        "name": "worktreeHeadMatchesAcceptedBase",
        "passed": true
      },
      {
        "name": "targetBranchAvailable",
        "passed": true
      }
    ]
  },
  "appendedAt": "2026-05-19T10:00:00.000Z"
}
```

追加 `autoMergePlan` 后，`currentWorkStage` 推进到 `auto-merge-execution`。

## 拒绝产物

失败时追加 `autoMergeRejection`。

```json
{
  "artifactId": "autoMergeRejection",
  "body": {
    "rejectedAt": "2026-05-19T10:00:00.000Z",
    "decisionRef": "humanDecision",
    "reasons": [
      {
        "code": "NO_CHANGES",
        "message": "隔离工作树没有可合并变更。"
      }
    ],
    "checkedInputs": {
      "currentWorkStage": "auto-merge",
      "hasHumanDecision": true,
      "hasTaskCompletion": true,
      "hasIsolatedWorkspace": true
    }
  },
  "appendedAt": "2026-05-19T10:00:00.000Z"
}
```

追加 `autoMergeRejection` 后，`currentWorkStage` 保持 `auto-merge`。

## 字段规则

`autoMergePlan` 不包含 `strategy`。

`autoMergePlan` 不包含 `nextRequiredStage`。

`autoMergePlan` 不包含 `taskCompletionRef`。任务完成结论通过 `decisionRef -> humanDecision.taskCompletionRef` 追溯。

`hasChanges` 只出现在 `changeSet`，不重复出现在 `checks`。

`autoMergePlan` 只在确认有可合并变更时出现。没有变更时产出 `autoMergeRejection`。

## 边界

自动合并前置校验不运行 Agent。

自动合并前置校验不合并主线。

自动合并执行模块只消费 `autoMergePlan`，不消费 `autoMergeRejection`。
