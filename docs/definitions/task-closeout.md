# 任务收尾

## 职责

任务收尾负责任务退出前的统一资源收束。

成功路径消费 `autoMergeResult`，关闭已经合入主线的任务上下文包。

取消路径消费 `humanDecision(cancel-task)`，取消任务并清理执行侧资源。

本环节不运行 Agent。

本环节不修改业务代码。

## 输入

成功路径输入是处于 `merged` 环节的任务上下文包。

必须存在：

```text
autoMergeResult
isolatedWorkspace
```

`autoMergeResult.source.commit` 必须等于 `autoMergeResult.target.afterCommit`。

取消路径必须存在：

```text
humanDecision(decision: cancel-task)
isolatedWorkspace
```

## 动作

任务收尾执行三个动作：

```text
追加 taskCloseout
删除隔离工作树
删除任务分支
```

## 产物

成功时追加 `taskCloseout`。

```json
{
  "artifactId": "taskCloseout",
  "body": {
    "closeoutAt": "2026-05-19T10:10:00.000Z",
    "closedAt": "2026-05-19T10:10:00.000Z",
    "closeoutReason": "merged",
    "resultRef": "autoMergeResult",
    "cleanup": {
      "worktree": {
        "path": ".workflow/worktrees/tasks/tasks-task-003",
        "removed": true
      },
      "branch": {
        "name": "workflow/tasks/tasks-task-003",
        "deleted": true
      }
    },
    "finalStage": "closed"
  },
  "appendedAt": "2026-05-19T10:10:00.000Z"
}
```

取消路径追加：

```json
{
  "artifactId": "taskCloseout",
  "body": {
    "closeoutAt": "2026-05-19T10:10:00.000Z",
    "closeoutReason": "cancelled",
    "decisionRef": "humanDecision",
    "cleanup": {
      "worktree": {
        "path": ".workflow/worktrees/tasks/tasks-task-003",
        "removed": true
      },
      "branch": {
        "name": "workflow/tasks/tasks-task-003",
        "deleted": true
      }
    },
    "finalStage": "cancelled"
  },
  "appendedAt": "2026-05-19T10:10:00.000Z"
}
```

追加 `taskCloseout` 后，成功路径 `currentWorkStage` 推进到 `closed`，取消路径推进到 `cancelled`。

## 边界

任务收尾只处理资源清理和任务退出。

任务收尾不生成 Agent 总结。

任务收尾不评价任务质量。

任务收尾不清理 `main` 上已经合入的文件。
