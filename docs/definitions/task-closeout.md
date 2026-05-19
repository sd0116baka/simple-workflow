# 任务收尾

## 职责

任务收尾消费 `autoMergeResult`，关闭已经合入主线的任务上下文包。

本环节不运行 Agent。

本环节不修改业务代码。

## 输入

输入是处于 `merged` 环节的任务上下文包。

必须存在：

```text
autoMergeResult
isolatedWorkspace
```

`autoMergeResult.source.commit` 必须等于 `autoMergeResult.target.afterCommit`。

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
    "closedAt": "2026-05-19T10:10:00.000Z",
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

追加 `taskCloseout` 后，`currentWorkStage` 推进到 `closed`。

## 边界

任务收尾只处理资源清理和任务包关闭。

任务收尾不生成 Agent 总结。

任务收尾不评价任务质量。

任务收尾不清理 `main` 上已经合入的文件。
