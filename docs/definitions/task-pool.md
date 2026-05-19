# 任务池

## 职责

任务池维护所有任务上下文包的实时集合。

任务池接收任务解析器输出的 `taskRecognitionReports`，为每个报告创建或更新对应的任务上下文包。后续工作流环节会继续向对应任务上下文包追加产物。

任务池基于任务上下文包集合派生界面视图和后续环节输入。

## 输入

任务池只接收任务解析器输出。

```json
{
  "taskRecognitionReports": [
    {
      "source": {
        "path": "tasks/task-003.yaml",
        "format": "yaml",
        "contentHash": "abc123"
      },
      "recognition": {
        "outcome": "recognized",
        "findings": []
      },
      "taskDraft": {
        "id": "task-003",
        "name": "监听任务文件变化",
        "kind": "default",
        "priority": "high",
        "goal": "监听 tasks 目录中的任务源文件变化，并让界面自动刷新。",
        "acceptanceCriteria": [
          "修改任务源文件后界面自动刷新"
        ],
        "maxIterations": "default"
      },
      "qualityGate": {
        "outcome": "pass"
      }
    }
  ]
}
```

## 输出

任务池输出完整任务上下文包集合、派生视图和摘要。

```json
{
  "taskContextPackages": [
    {
      "packageId": "task-context-package:tasks/task-003.yaml",
      "currentWorkStage": "task-pool",
      "source": {
        "path": "tasks/task-003.yaml",
        "format": "yaml",
        "contentHash": "abc123"
      },
      "recognition": {
        "outcome": "recognized",
        "findings": []
      },
      "taskDraft": {
        "id": "task-003",
        "name": "监听任务文件变化",
        "kind": "default",
        "priority": "high",
        "goal": "监听 tasks 目录中的任务源文件变化，并让界面自动刷新。",
        "acceptanceCriteria": [
          "修改任务源文件后界面自动刷新"
        ],
        "maxIterations": "default"
      },
      "qualityGate": {
        "outcome": "pass"
      },
      "artifacts": {},
      "agentRuns": [],
      "timeline": []
    }
  ],
  "views": {
    "candidateTasks": [
      "task-context-package:tasks/task-003.yaml"
    ],
    "needsAttention": [],
    "brokenContent": []
  },
  "updatedAt": "2026-05-18T10:00:00.000Z"
}
```

## packageId

`packageId` 始终基于 `source.path`。

```text
packageId = "task-context-package:" + source.path
```

示例：

```text
task-context-package:tasks/task-003.yaml
```

`taskDraft.id` 是任务内容里的业务身份，不负责任务上下文包身份。

即使内容从 `content-broken` 修复为 `recognized`，只要 `source.path` 不变，`packageId` 就不变。

第一版不考虑文件改名。`source.path` 改变时，视为旧任务上下文包移除、新任务上下文包创建。

## currentWorkStage

`currentWorkStage` 表示围绕该任务正在进行或停留的工作环节。

它不表达阻塞原因，不表达整体健康度，也不表达是否可执行。

第一版枚举值：

```text
task-parser
task-pool
task-recommender
execution-admission
isolated-workspace
main-agent
execution-agent
review-agent
convergence
task-completion
human-decision
auto-merge
auto-merge-execution
merged
closed
```

`task-completion` 表示 Agent 已产出任务完成结论。

`human-decision` 表示系统正在等待人工接受、打回或另行处理该结论。

`auto-merge` 表示人工已经接受任务完成，系统等待自动合并环节消费 `humanDecision`。

`auto-merge-execution` 表示自动合并前置校验已通过，系统等待自动合并执行环节消费 `autoMergePlan`。

`merged` 表示自动合并执行已成功追加 `autoMergeResult`，任务成果已经合入目标分支。

`closed` 表示任务收尾已成功追加 `taskCloseout`，隔离工作树和任务分支已经清理。

## isolatedWorkspace

`isolatedWorkspace` 是任务上下文包里的任务级单例 artifact。

它表示该任务的隔离开发工作树：

```json
{
  "artifactId": "isolatedWorkspace",
  "body": {
    "worktreePath": ".workflow/worktrees/tasks/task-003",
    "branchName": "workflow/tasks/task-003",
    "baseBranch": "main",
    "baseCommit": "abc123",
    "status": "ready"
  },
  "appendedAt": "2026-05-18T10:00:00.000Z"
}
```

`isolatedWorkspace` 不按执行轮次重复创建。多轮 `execution` 和 `review` 都引用同一个任务级工作树。

创建时机：

```text
executionAuthorization
-> isolatedWorkspace
-> main-agent:initialization
-> execution-agent:001
```

第一版命名规则：

```text
baseBranch: main
worktreePath: .workflow/worktrees/tasks/<safe-package-id>
branchName: workflow/tasks/<safe-package-id>
```

`safe-package-id` 从 `source.path` 派生，不从任务标题派生。示例：`tasks/task-003.yaml -> tasks-task-003`。

系统创建真实 git worktree 后，再通过追加请求把 `isolatedWorkspace` 交给任务池保存。

任务池只负责保存 `isolatedWorkspace` 产物。创建 git worktree、指定 Agent `cwd`、检查工作树状态、合入主线，属于任务池外部的工作流模块职责。

`.workflow/` 是系统运行目录，必须保持在版本控制忽略列表中，避免隔离工作树本身污染主线工作区。

## 任务上下文包

任务上下文包是任务池的一等输出，不是隐藏在详情接口里的附属数据。

界面可以根据用户选择决定显示摘要、完整包，或只显示包内部分字段。显示策略属于 UI 视图层，不改变任务池输出完整任务上下文包的事实。

任务上下文包基础字段来自任务解析器报告：

```text
source
recognition
taskDraft
qualityGate
```

后续工作流环节会向任务池提交追加请求。任务池负责执行追加请求，把产物写入对应任务上下文包。

追加请求由产出该产物的工作流环节提供，负责说明追加目标、产物类型和产物本体：

```json
{
  "appendRequest": {
    "packageId": "task-context-package:tasks/task-003.yaml",
    "artifactType": "executionIntent",
    "artifact": {}
  }
}
```

任务池执行追加后，产物类型由 `artifacts` 的 key 表达，artifact 本体不重复保存 `artifactType`。

任务池不负责为其他模块包装追加请求。

任务池只负责校验并执行收到的追加请求。

Agent 调用也通过同一个追加请求接口进入任务池。

```json
{
  "appendRequest": {
    "packageId": "task-context-package:tasks/task-003.yaml",
    "artifactType": "executionReport",
    "artifact": {
      "summary": "完成执行。",
      "cwd": ".workflow/worktrees/tasks/tasks-task-003",
      "changedFiles": [
        "src/server/server.js"
      ],
      "tests": [],
      "notes": []
    },
    "agentRun": {
      "runId": "execution-agent:001",
      "role": "execution",
      "sessionId": "opencode-session-execution-002",
      "inputArtifactRefs": [
        "taskDraft",
        "executionAuthorization"
      ],
      "outputArtifactRefs": [],
      "status": "succeeded",
      "startedAt": "2026-05-18T10:00:00.000Z",
      "finishedAt": "2026-05-18T10:10:00.000Z"
    }
  }
}
```

任务池执行 Agent 追加请求时：

```text
有 artifactType + artifact 时，追加 artifact。
有 agentRun 时，追加 agentRuns。
如果同一次追加请求同时包含 artifact 和 agentRun，任务池生成 artifactId 并补全 agentRun.outputArtifactRefs。
```

执行前产物是单例。Agent loop 产物是多例。

## 派生视图

`views` 是从 `taskContextPackages` 派生出来的视图，不是新的事实来源。

第一版视图：

```text
candidateTasks
needsAttention
brokenContent
```

`candidateTasks` 表示任务定义层面可以进入后续流程的候选任务。

`needsAttention` 表示能形成任务草稿，但当前质量门槛未通过，需要维护者处理。

`brokenContent` 表示源内容已经成功读取，但内容格式坏了，无法形成任务草稿。

## 边界规则

任务池不读取文件。

任务池不解析任务源内容。

任务池不接收任务真源输出，也不处理 `sourceErrors`。

任务池只接收 `taskRecognitionReports`。

任务池维护完整任务上下文包集合，并从中派生视图。

任务池是唯一执行追加请求的模块。

任务池不推荐任务，不判断运行时环境，不授权执行，不运行 Agent，不审查结果。
