# 任务推荐器

## 职责

任务推荐器负责在启动检查通过后，从任务池 `candidateTasks` 中选择一个建议执行的任务，并产出执行意图追加请求。

任务推荐器不直接写任务上下文包。它把执行意图 artifact 本体放进追加请求，由任务池执行追加。

执行意图 artifact 本体不保存 `artifactType`。`artifactType` 只属于追加请求外层。

## 输入

任务推荐器只读取系统注入的推荐器输入。

任务推荐器不读取代码文件、文档文件或任务真源目录。它的推理只能基于 `candidateTasks`。

```json
{
  "candidateTasks": [
    {
      "packageId": "task-context-package:tasks/task-003.yaml",
      "taskDraft": {
        "id": "task-003",
        "name": "监听任务文件变化",
        "kind": "feature",
        "priority": "high",
        "goal": "监听 tasks 目录中的任务源文件变化，并让界面自动刷新。",
        "acceptanceCriteria": [
          "修改任务源文件后界面自动刷新"
        ],
        "maxIterations": "default"
      }
    }
  ]
}
```

`candidateTasks` 来自任务池候选任务视图。启动检查未通过时，任务推荐器不运行。

## 输出

任务推荐器输出执行意图追加请求。

```json
{
  "appendRequest": {
    "packageId": "task-context-package:tasks/task-003.yaml",
    "artifactType": "executionIntent",
    "artifact": {
      "recommendedPackageId": "task-context-package:tasks/task-003.yaml",
      "confidence": "high",
      "selectionReasoning": [
        "这是当前候选任务中唯一 high 优先级任务。",
        "它能增强 tasks 目录作为任务真源的反馈闭环。"
      ],
      "candidateComparison": [
        {
          "packageId": "task-context-package:tasks/task-003.yaml",
          "decision": "selected",
          "reason": "优先级最高且能改善后续调试体验。"
        }
      ],
      "executionBrief": {
        "goalInterpretation": "让任务真源变化能自动推动界面和任务池刷新，减少手动刷新带来的状态错觉。",
        "expectedOutcome": [
          "新增任务文件后任务列表自动出现。",
          "修改任务文件后解析结果和任务池视图自动更新。"
        ],
        "implementationHints": [
          "围绕任务真源变化到界面刷新的反馈链路展开实现。"
        ],
        "riskSignals": [
          "文件系统事件可能重复触发，需要防抖。"
        ],
        "openQuestions": []
      }
    }
  }
}
```

## 追加结果

任务池执行追加请求后，任务上下文包中只保存 artifact 本体。

```json
{
  "artifacts": {
    "executionIntent": {
      "recommendedPackageId": "task-context-package:tasks/task-003.yaml",
      "confidence": "high",
      "selectionReasoning": [],
      "candidateComparison": [],
      "executionBrief": {}
    }
  }
}
```

`artifactType` 属于追加请求，不属于执行意图 artifact 本体。任务池执行追加后，产物类型由 `artifacts.executionIntent` 表达。

## 字段规则

`appendRequest.packageId` 是追加目标。

`appendRequest.artifactType` 固定为：

```text
executionIntent
```

`artifact.recommendedPackageId` 是执行意图选中的任务包，必须与 `appendRequest.packageId` 一致。

任务摘要、任务名称、优先级、源路径等能由 `recommendedPackageId` 从任务上下文包推导出来，不应由任务推荐器重复输出。

仓库状态、启动检查结果等由系统掌握，不应由任务推荐器重复输出。

`artifact.confidence` 表示推荐器对本次选择的确信程度，只能是：

```text
high
medium
low
```

`artifact.selectionReasoning` 解释为什么选择该任务。

`artifact.candidateComparison` 解释候选任务之间的取舍。第一版 `decision` 只使用：

```text
selected
deferred
```

`artifact.candidateComparison` 必须包含 `recommendedPackageId` 对应的 `selected` 项。

如果候选任务很多，`candidateComparison` 不需要全量列出。第一版要求：

```text
必须包含 selected 任务
最多包含 3 个最相关的 deferred 任务
没有值得比较的其他任务时，可以只有 selected
```

`artifact.executionBrief` 是给后续执行 Agent 的执行前上下文，不参与执行准入器的确定性授权判断。

`artifact.executionBrief` 只能基于系统注入的 `candidateTasks` 推理。

任务推荐器不能假装知道具体代码文件、函数名、接口或文档内容。如果需要代码或文档上下文才能确定，应写入 `openQuestions`。

## 边界规则

任务推荐器不读取任务真源。

任务推荐器不读取代码文件。

任务推荐器不读取文档文件。

任务推荐器不解析任务内容。

任务推荐器不输出任务摘要中可由任务上下文包推导的字段。

任务推荐器不输出仓库状态或启动检查结果。

任务推荐器不直接写任务上下文包。

任务推荐器输出追加请求，但不执行追加请求。

任务推荐器不在 artifact 本体中输出 `artifactType`。

任务推荐器不生成执行授权。
