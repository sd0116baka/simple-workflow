# 执行准入器

## 职责

执行准入器负责执行前的确定性门槛。

它有两个动作：

```text
启动检查
授权追加
```

启动检查发生在任务推荐器之前，用于判断当前全局运行环境是否允许启动新的任务工作。

授权追加发生在任务推荐器请求追加执行意图之后，用于判断已带有执行意图的任务上下文包是否可以进入执行阶段。

执行准入器不解释自然语言，不修改任务业务语义，不直接写任务上下文包。它只产出启动检查结果或追加请求。任务上下文包只能由任务池维护。

## 启动检查

### 输入

启动检查只读取当前运行环境快照。

```json
{
  "runtimeSnapshot": {
    "activeWork": null,
    "worktree": {
      "clean": true,
      "changedFiles": []
    }
  }
}
```

### 输出

```json
{
  "canStartWork": true,
  "findings": [],
  "runtimeSnapshot": {
    "activeWork": null,
    "worktree": {
      "clean": true,
      "changedFiles": []
    }
  }
}
```

无法启动任务时：

```json
{
  "canStartWork": false,
  "findings": [
    {
      "field": "worktree",
      "severity": "blocking",
      "code": "WORKTREE_DIRTY",
      "message": "工作区存在未提交变更。"
    }
  ],
  "runtimeSnapshot": {
    "activeWork": null,
    "worktree": {
      "clean": false,
      "changedFiles": [
        "docs/definitions/task-pool.md"
      ]
    }
  }
}
```

### 启动检查规则

`canStartWork` 只表示当前运行环境是否允许启动新的任务工作。

`findings` 记录启动检查发现的阻断或警告原因。

启动检查只判断全局运行环境，不逐个过滤任务。

如果 `canStartWork` 为 `true`，任务推荐器可以消费任务池的 `candidateTasks`。

如果 `canStartWork` 为 `false`，任务推荐器不运行。

启动检查不修改任务上下文包，不请求追加产物。

## 授权追加

### 前置条件

任务推荐器已经在 `canStartWork` 为 `true` 时，基于任务池 `candidateTasks` 选择任务，并向任务池请求追加执行意图。

任务池已经把执行意图追加到对应任务上下文包。

授权追加读取这个已经带有执行意图的任务上下文包。

### 输入

```json
{
  "taskContextPackage": {
    "packageId": "task-context-package:tasks/task-003.yaml",
    "currentWorkStage": "task-recommender",
    "source": {
      "path": "tasks/task-003.yaml",
      "format": "yaml",
      "contentHash": "abc123"
    },
    "taskDraft": {
      "id": "task-003",
      "name": "监听任务文件变化",
      "priority": "high",
      "goal": "监听 tasks 目录中的任务源文件变化，并让界面自动刷新。",
      "acceptanceCriteria": [
        "修改任务源文件后界面自动刷新"
      ],
      "maxIterations": "default"
    },
    "artifacts": {
      "executionIntent": {
        "recommendedPackageId": "task-context-package:tasks/task-003.yaml",
        "confidence": "high",
        "rationale": [
          "当前候选任务中优先级最高。"
        ]
      }
    }
  },
  "candidateTasks": [
    {
      "packageId": "task-context-package:tasks/task-003.yaml"
    }
  ],
  "runtimeSnapshot": {
    "activeWork": null,
    "worktree": {
      "clean": true,
      "changedFiles": []
    }
  },
  "projectProfile": {
    "defaults": {
      "maxIterations": 3
    }
  }
}
```

### 输出

授权通过时，执行准入器产出执行授权追加请求。

```json
{
  "appendRequest": {
    "packageId": "task-context-package:tasks/task-003.yaml",
    "artifactType": "executionAuthorization",
    "artifact": {
      "authorizedAt": "2026-05-18T10:00:00.000Z",
      "task": {
        "id": "task-003",
        "name": "监听任务文件变化",
        "goal": "监听 tasks 目录中的任务源文件变化，并让界面自动刷新。",
        "acceptanceCriteria": [
          "修改任务源文件后界面自动刷新"
        ]
      },
      "runtimeSnapshot": {
        "activeWork": null,
        "worktree": {
          "clean": true,
          "changedFiles": []
        }
      },
      "termination": {
        "maxIterations": 3
      }
    }
  }
}
```

授权未通过时，执行准入器产出准入拒绝追加请求。

```json
{
  "appendRequest": {
    "packageId": "task-context-package:tasks/task-003.yaml",
    "artifactType": "admissionRejection",
    "artifact": {
      "rejectedAt": "2026-05-18T10:00:00.000Z",
      "findings": [
        {
          "field": "executionIntent",
          "severity": "blocking",
          "code": "INTENT_NOT_CANDIDATE",
          "message": "执行意图指向的任务不在任务池候选任务视图中。"
        }
      ]
    }
  }
}
```

无法由确定性规则继续判断时，执行准入器产出人工决策请求追加请求。

```json
{
  "appendRequest": {
    "packageId": "task-context-package:tasks/task-003.yaml",
    "artifactType": "humanDecisionRequest",
    "artifact": {
      "requestedAt": "2026-05-18T10:00:00.000Z",
      "reason": "执行前置条件需要人工确认。"
    }
  }
}
```

### 授权追加规则

授权追加判断的是：已追加执行意图的任务上下文包，是否足以进入执行阶段。

它至少确认：

```text
执行意图存在
执行意图指向当前任务上下文包
当前任务上下文包仍在任务池 candidateTasks 中
当前运行环境仍允许启动工作
执行授权需要固化的 "default" 字段能从 Project Profile 解析出具体值
```

授权追加不直接修改任务上下文包。它只产出追加请求，由任务池执行追加。

## 与任务推荐器的边界

任务推荐器只负责在 `canStartWork` 为 `true` 时，从任务池 `candidateTasks` 中选择当前建议执行的任务，并请求追加执行意图。

任务推荐器不生成执行授权。

执行准入器不选择任务。

## 与任务池的边界

任务池维护任务上下文包。

执行准入器读取任务池提供的视图和任务上下文包，但不直接写入。

执行准入器产出的执行授权、准入拒绝、人工决策请求，都必须以追加请求形式交给任务池。

## 边界规则

执行准入器不读取任务源。

执行准入器不解析任务内容。

执行准入器不推荐任务。

执行准入器不运行 Agent。

执行准入器不审查执行结果。

执行准入器不修改任务业务语义。

执行准入器不直接写任务上下文包。
