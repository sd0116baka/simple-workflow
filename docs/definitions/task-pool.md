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
      "taskPoolState": "ready",
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
      "timeline": [
        {
          "eventType": "taskPoolStateChanged",
          "from": "parsed",
          "to": "ready",
          "reason": "qualityGate.pass",
          "sourceContentHash": "abc123",
          "findings": [],
          "appendedAt": "2026-05-18T10:00:00.000Z"
        }
      ]
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

## taskPoolState

`taskPoolState` 表示任务进入任务池后的早期可消费状态。它只描述任务定义在任务池中的健康度和可推荐性，不表达当前工作环节；当前工作环节仍由 `currentWorkStage` 表达。

第一版最小状态集合：

```text
raw
parsed
blocked
ready
```

`raw` 表示任务池已收到某个 `source.path` 的解析器报告，但尚未把报告归并成可稳定读取的任务上下文包。进入条件：收到新的 `taskRecognitionReport`，并完成 `packageId` 计算之前。`raw` 是任务池内部归并过程中的短暂状态，正常输出的任务上下文包不应长期停留在 `raw`。

`parsed` 表示任务池已经基于解析器报告创建或更新任务上下文包，且 `source`、`recognition`、`taskDraft`、`qualityGate` 已写入包内。进入条件：`packageId` 已确定，报告已归并，但尚未根据 `recognition.outcome` 和 `qualityGate.outcome` 做可推荐性判定。

`blocked` 表示任务上下文包存在，但不能进入候选任务视图。进入条件满足任一项即可：`recognition.outcome` 不是 `recognized`；`qualityGate.outcome` 不是 `pass`；`taskDraft` 为 `null`；或 `recognition.findings` 中存在 `severity: "blocking"`。`blocked` 的原因必须从对应 `findings` 或状态变化记录中可追溯。

`ready` 表示任务定义层面可被推荐器消费。进入条件必须同时满足：`recognition.outcome` 为 `recognized`；`qualityGate.outcome` 为 `pass`；`taskDraft` 不为 `null`；`recognition.findings` 中没有 `severity: "blocking"`。`ready` 不代表当前运行环境允许启动工作，也不代表已经获得执行授权。

状态判定顺序固定为：

```text
raw -> parsed -> blocked | ready
```

当同一路径的任务源内容变化时，任务池基于新的 `contentHash` 重新归并解析器报告，并按同一顺序重新判定 `taskPoolState`。内容从坏到好时可以从 `blocked` 变为 `ready`；内容从好到坏时可以从 `ready` 变为 `blocked`。

## 状态变化记录

任务池每次改变 `taskPoolState` 时，都必须向对应任务上下文包的 `timeline` 追加一条记录。状态未变化但源内容 `contentHash` 改变时，也应追加记录，便于追溯“重新解析但状态不变”。

记录格式：

```json
{
  "eventType": "taskPoolStateChanged",
  "from": "parsed",
  "to": "ready",
  "reason": "qualityGate.pass",
  "sourceContentHash": "abc123",
  "findings": [],
  "appendedAt": "2026-05-18T10:00:00.000Z"
}
```

字段规则：

```text
eventType 固定为 taskPoolStateChanged。
from 是变化前状态；首次创建任务上下文包时为 null。
to 是变化后状态。
reason 是本次判定的直接触发原因，使用稳定代码，例如 recognition.content-broken、qualityGate.fail、qualityGate.pass、source.content-changed。
sourceContentHash 记录触发本次判定的 source.contentHash。
findings 保存导致 blocked 或需要诊断的相关 findings；ready 时通常为空数组。
appendedAt 是任务池执行本次状态记录追加的时间。
```

`timeline` 只记录状态变化事实和必要诊断信息，不重复保存完整 `taskDraft`，也不保存原始任务源内容。

## currentWorkStage

`currentWorkStage` 表示围绕该任务正在进行或停留的工作环节。本节是 `currentWorkStage` 枚举和语义的文档权威来源；其他文档可以描述某条流程如何推进到这些环节，但不重新定义枚举含义。

它不表达阻塞原因，不表达整体健康度，也不表达是否可执行。

正式枚举：

| currentWorkStage | 含义 | 进入依据 |
| --- | --- | --- |
| `task-parser` | 系统正在读取并解析任务真源。 | 原始任务文件刚进入解析流程，尚未形成可消费任务池条目。 |
| `task-pool` | 任务已进入任务池，等待推荐或继续观察。 | 任务真源可解析，且尚未被推荐器选中执行。 |
| `task-recommender` | 推荐器正在选择本轮要执行的任务。 | 系统开始消费任务池候选任务，并准备生成 `executionIntent`。 |
| `execution-admission` | 执行准入器正在判断推荐任务是否允许进入执行。 | 已生成 `executionIntent`，等待追加 `executionAuthorization` 或 `admissionRejection`。 |
| `isolated-workspace` | 系统正在为任务分配隔离执行工作树。 | 已追加 `executionAuthorization`，等待追加任务级 `isolatedWorkspace`。 |
| `main-agent` | Main Agent 正在初始化该任务的执行上下文。 | 已分配 `isolatedWorkspace`，等待记录 `main-agent:initialization`。 |
| `execution-agent` | Execution Agent 正在执行或修正任务。 | 已完成 main 初始化；首轮执行或带收敛意见的新一轮执行都会进入该环节。 |
| `review-agent` | Review Agent 正在审查本轮执行结果。 | 已追加本轮 `executionReport`，等待追加 `reviewReport`。 |
| `convergence` | Main Agent 正在判断本轮执行和审查结果是否收敛。 | 已追加本轮 `reviewReport`，等待追加 `convergenceAdvice`、`convergenceSuccess` 或 `convergenceFailure`。 |
| `human-decision` | 系统正在等待人工处理需要判断的工作流结果。 | 已追加 `humanDecisionRequest`；请求目标可以是 `convergenceSuccess`、`convergenceFailure`、`autoMergeRejection` 或 `autoMergeFailure`。 |
| `auto-merge-planning` | 系统正在为人工接受的收敛结果生成自动合并计划。 | 已追加 `humanDecision(decision: accept-convergence)`，等待追加 `autoMergePlan` 或 `autoMergeRejection`。 |
| `auto-merge-execution` | 系统正在执行自动合并。 | 已追加 `autoMergePlan`，等待追加 `autoMergeResult` 或 `autoMergeFailure`。 |
| `merged` | 任务成果已经合入目标分支，等待统一收尾。 | 已追加 `autoMergeResult`。 |
| `task-closeout` | 任务已经决定退出，系统正在清理执行侧资源。 | 成功路径通常从 `merged` 进入；取消路径从 `humanDecision(decision: cancel-task)` 进入。 |
| `closed` | 成功路径终态。 | 已追加 `taskCloseout(closeoutReason: merged)`，隔离工作树和任务分支已经清理。 |
| `cancelled` | 取消路径终态。 | 已追加 `taskCloseout(closeoutReason: cancelled)`，隔离工作树和任务分支已经清理，任务成果不会合入主线。 |

`human-decision` 内部可以包含一次请求和一次人工响应，例如 `humanDecisionRequest -> humanConvergenceGuidance`。这仍然是同一次人工决策环节，不表示状态机进入了两次 `human-decision`。

`human-guided-execution` 不是 `currentWorkStage`。它只是本地测试状态桩场景名，用来生成已经追加 `humanConvergenceGuidance` 且当前停在下一轮 `execution-agent` 的任务包。

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

收敛失败后的人工处理也通过追加请求进入任务池。`convergenceFailure`、`humanConvergenceGuidance` 和取消决策都是任务上下文包 artifact，由对应工作流环节构造追加请求，任务池只负责原子追加、生成 `artifactId`、补全 `agentRun.outputArtifactRefs`，不解释人工意见，也不执行清理。

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

`agentRuns` 是任务上下文包内的最小持久运行账本，只保存后续流程判断和长期追溯需要的事实：

```text
runId
role
sessionId
status
failure
inputArtifactRefs
outputArtifactRefs
startedAt
finishedAt
```

`agentRuns` 不保存 agent 聊天记录、完整 prompt、stdout/stderr、终端 transcript、进程事件、pid、command、cwd 或调试计数。这些属于实时调试态，可以存在于当前 `recommendationRun.progress`、terminal session 或临时日志中，但不进入任务上下文包的长期事实。

`agentRun` 是调用账本，artifact 是业务产物。Agent 的最终结构化输出只通过对应 artifact 长期保存，例如 `executionReport`、`reviewReport`、`convergenceAdvice`、`convergenceSuccess` 或 `convergenceFailure`。`agentRun.outputArtifactRefs` 只保存这些产物的引用，不复制产物正文。

`agentRun.status` 是运行状态摘要，`agentRun.failure` 是失败详情。二者必须保持一致：

```text
running/succeeded 不保存 failure。
failed 必须保存 failure，且 failure.kind 不能是 cancelled。
cancelled 必须保存 failure，且 failure.kind 必须是 cancelled。
```

失败的 agent run 可以追加本环节失败报告，例如 `executionReport(status: failed)`，但失败报告不能作为下游成功输入。下游环节必须检查对应 `agentRun.status` 和 artifact 状态，避免失败产物继续驱动 review、convergence 或后续自动化。

执行前产物是单例。Agent loop 产物是多例。

## 派生视图

`views` 是从 `taskContextPackages` 派生出来的视图，不是新的事实来源。

第一版视图：

```text
candidateTasks
needsAttention
brokenContent
```

`candidateTasks` 表示任务定义层面可以进入后续流程的候选任务，只包含 `taskPoolState: "ready"` 的任务上下文包。

`needsAttention` 表示能形成任务草稿，但当前质量门槛未通过，需要维护者处理。它来自 `taskPoolState: "blocked"` 且 `recognition.outcome: "incomplete"` 或 `qualityGate.outcome: "fail"` 的任务上下文包。

`brokenContent` 表示源内容已经成功读取，但内容格式坏了，无法形成任务草稿。它来自 `taskPoolState: "blocked"` 且 `recognition.outcome: "content-broken"` 的任务上下文包。

## 边界规则

任务池不读取文件。

任务池不解析任务源内容。

任务池不接收任务真源输出，也不处理 `sourceErrors`。

任务池只接收 `taskRecognitionReports`。

任务池维护完整任务上下文包集合，并从中派生视图。

任务池是唯一执行追加请求的模块。

任务池不推荐任务，不判断运行时环境，不授权执行，不运行 Agent，不审查结果。
