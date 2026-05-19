# 自动合并

## 前置校验职责

自动合并前置校验只判断一个已被人工接受的任务是否可以进入自动合并执行。

本环节不修改主线，不执行合并。

## 前置校验输入

输入是处于 `auto-merge` 环节的任务上下文包。

必须存在：

```text
taskCompletion
humanDecision
isolatedWorkspace
```

`humanDecision.body.decision` 必须是 `accept-completion`。

## 前置校验通过产物

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
      ]
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

## 前置校验拒绝产物

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

## 前置校验字段规则

`autoMergePlan` 不包含 `strategy`。

`autoMergePlan` 不包含 `nextRequiredStage`。

`autoMergePlan` 不包含 `taskCompletionRef`。任务完成结论通过 `decisionRef -> humanDecision.taskCompletionRef` 追溯。

`autoMergePlan.changeSet.changedFiles` 必须是非空数组。

`autoMergePlan` 只在确认有可合并变更时出现。没有变更时产出 `autoMergeRejection`。

## 前置校验边界

自动合并前置校验不运行 Agent。

自动合并前置校验不合并主线。

自动合并执行模块只消费 `autoMergePlan`，不消费 `autoMergeRejection`。

## 执行职责

自动合并执行消费 `autoMergePlan`，把隔离工作树中的变更合入目标分支。

本环节会修改主线。

本环节不运行 Agent。

## 执行输入

输入是处于 `auto-merge-execution` 环节的任务上下文包。

必须存在：

```text
autoMergePlan
isolatedWorkspace
humanDecision
```

`autoMergePlan.target.currentCommit` 必须仍然等于目标分支当前 commit。

主工作区必须干净。

隔离工作树必须有可提交变更。

## 执行成功产物

成功时追加 `autoMergeResult`。

```json
{
  "artifactId": "autoMergeResult",
  "body": {
    "mergedAt": "2026-05-19T10:05:00.000Z",
    "planRef": "autoMergePlan",
    "source": {
      "worktreePath": ".workflow/worktrees/tasks/tasks-task-003",
      "branchName": "workflow/tasks/tasks-task-003",
      "baseCommit": "abc123",
      "commit": "def456"
    },
    "target": {
      "branchName": "main",
      "beforeCommit": "abc123",
      "afterCommit": "def456"
    },
    "changeSet": {
      "changedFiles": [
        ".workflow-agent/execution-agent-001.txt"
      ]
    },
    "checks": [
      {
        "name": "mainWorktreeClean",
        "passed": true
      },
      {
        "name": "targetStillAtPlannedCommit",
        "passed": true
      },
      {
        "name": "sourceCommitted",
        "passed": true
      },
      {
        "name": "mergedFastForward",
        "passed": true
      }
    ]
  },
  "appendedAt": "2026-05-19T10:05:00.000Z"
}
```

追加 `autoMergeResult` 后，`currentWorkStage` 推进到 `merged`。

## 执行失败产物

失败时追加 `autoMergeFailure`。

```json
{
  "artifactId": "autoMergeFailure",
  "body": {
    "failedAt": "2026-05-19T10:05:00.000Z",
    "planRef": "autoMergePlan",
    "reasons": [
      {
        "code": "TARGET_MOVED",
        "message": "目标分支已经不在自动合并计划记录的 commit。"
      }
    ],
    "checkedInputs": {
      "currentWorkStage": "auto-merge-execution",
      "hasAutoMergePlan": true,
      "hasIsolatedWorkspace": true,
      "hasHumanDecision": true
    }
  },
  "appendedAt": "2026-05-19T10:05:00.000Z"
}
```

追加 `autoMergeFailure` 后，`currentWorkStage` 保持 `auto-merge-execution`。

## 执行字段规则

`autoMergeResult.changeSet.changedFiles` 来自执行前隔离工作树的变更文件列表。

`autoMergeResult.source.commit` 是系统在隔离工作树中创建的提交。

`autoMergeResult.target.afterCommit` 是合入目标分支后的 commit。

`autoMergeFailure` 不包含恢复建议。失败原因只记录事实，后续恢复策略另行定义。

## 执行边界

自动合并执行只做 fast-forward 合并。

自动合并执行不解决冲突。

自动合并执行不清理隔离工作树。
