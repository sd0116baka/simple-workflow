# 自动合并

## 前置校验职责

自动合并前置校验只判断一个已被人工接受的任务是否可以进入自动合并执行。

本环节不修改主线，不执行合并。

本文只描述自动合并相关的推进规则，不定义 `currentWorkStage` 枚举语义。`currentWorkStage` 的正式枚举和含义以 `docs/definitions/task-pool.md` 为准。

## 前置校验输入

输入是处于 `auto-merge-planning` 环节的任务上下文包。

必须存在：

```text
convergenceSuccess
humanDecision
isolatedWorkspace
```

`humanDecision.body.decision` 必须是 `accept-convergence`。

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
      "baseCommit": "abc123",
      "currentCommit": "abc123"
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
        "name": "worktreeContainsAcceptedWork",
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
      "currentWorkStage": "auto-merge-planning",
      "hasHumanDecision": true,
      "hasConvergenceSuccess": true,
      "hasIsolatedWorkspace": true
    }
  },
  "appendedAt": "2026-05-19T10:00:00.000Z"
}
```

追加 `autoMergeRejection` 后，系统必须追加 `humanDecisionRequest`，并把 `currentWorkStage` 推进到 `human-decision`。

该人工决策请求指向 `autoMergeRejection`：

```json
{
  "artifactId": "humanDecisionRequest",
  "body": {
    "requestedAt": "2026-05-19T10:00:00.000Z",
    "reason": "自动合并无法继续，需要人工提供收敛意见或取消任务。",
    "targetType": "autoMergeRejection",
    "targetRef": "autoMergeRejection",
    "decisionOptions": [
      "continue-convergence-with-guidance",
      "cancel-task"
    ]
  }
}
```

`autoMergeRejection.body.reasons` 只记录失败事实，不决定控制流。无论具体原因是什么，后续都进入同一个人工决策入口。

## 前置校验字段规则

`autoMergePlan` 不包含 `strategy`。

`autoMergePlan` 不包含 `nextRequiredStage`。

`autoMergePlan` 不包含 `convergenceSuccessRef`。收敛成功证据通过 `decisionRef -> humanDecision.convergenceSuccessRef` 追溯。

`autoMergePlan.changeSet.changedFiles` 必须是非空数组。

`autoMergePlan` 只在确认有可合并变更时出现。没有变更时产出 `autoMergeRejection`。

如果上一次自动合并执行已经在隔离工作树里创建了 source commit，但没有合入目标分支，重新生成计划时 `source.currentCommit` 可以不同于 `source.baseCommit`。此时 `changeSet.changedFiles` 来自 `baseCommit...currentCommit`。

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

目标分支必须是主工作树当前分支。

主工作区必须干净。

隔离工作树必须有可提交变更。

如果隔离工作树的 source commit 不是基于 `autoMergePlan.target.currentCommit`，执行模块会先在隔离工作树中 rebase 到该 target commit，再做 fast-forward 合并。

rebase 只处理可自动套用的变更；发生冲突时产出 `autoMergeFailure`，不自动解冲突。

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
        "name": "sourceRebasedOntoTarget",
        "passed": false
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

追加 `autoMergeFailure` 后，系统必须追加 `humanDecisionRequest`，并把 `currentWorkStage` 推进到 `human-decision`。

该人工决策请求指向 `autoMergeFailure`：

```json
{
  "artifactId": "humanDecisionRequest",
  "body": {
    "requestedAt": "2026-05-19T10:05:00.000Z",
    "reason": "自动合并无法继续，需要人工提供收敛意见或取消任务。",
    "targetType": "autoMergeFailure",
    "targetRef": "autoMergeFailure",
    "decisionOptions": [
      "continue-convergence-with-guidance",
      "cancel-task"
    ]
  }
}
```

`autoMergeFailure.body.reasons` 只记录失败事实，不决定控制流。无论具体原因是什么，后续都进入同一个人工决策入口。

## 执行字段规则

`autoMergeResult.changeSet.changedFiles` 来自执行前隔离工作树的变更文件列表。

`autoMergeResult.source.commit` 是系统在隔离工作树中创建的提交。

`autoMergeResult.target.afterCommit` 是合入目标分支后的 commit。

`sourceRebasedOntoTarget` 表示执行时是否为了保持 fast-forward 合并而先把 source rebase 到目标 commit。

`autoMergeFailure` 不包含恢复建议。失败原因只记录事实；恢复动作由后续 `humanDecisionRequest` 承接。

## 执行边界

自动合并执行最终只做 fast-forward 合并。

自动合并执行不解决冲突。

自动合并执行不清理隔离工作树。
