# Agent 生命周期

## 职责

Agent 生命周期定义单个任务进入执行期后，三种 Agent 如何被调用、如何记录、以及它们的结构化结果如何追加到任务上下文包。

三种 Agent：

```text
main
execution
review
```

`main` Agent 负责单个任务全流程内的智能汇总和收敛建议。

`execution` Agent 负责一次性执行任务。

`review` Agent 负责一次性审查执行结果。

系统状态机负责决定什么时候调用哪个 Agent。Agent 不负责推进工作流状态。

## 生命周期规则

`main` Agent 是任务级会话。

单个任务进入执行期后，系统先创建或唤起 `main` Agent，让它知道自己负责该任务的后续智能汇总。这个初始化调用不产出业务 artifact，只记录一次 `agentRun`。

`execution` 和 `review` Agent 是一次性会话。

每轮执行或审查都创建新的 Agent session，避免上一轮错误污染下一轮上下文。

任务上下文包不设置 `agentSessions`。

所有 Agent 调用事实都记录在 `agentRuns`。

进入执行期后，`agentRuns[0]` 必须是 `main` Agent 初始化记录。`main` Agent 的任务级 sessionId 从 `agentRuns[0].sessionId` 获得。

如果 `agentRuns` 为空，表示该任务还没有进入 Agent 执行期。

## agentRun

`agentRun` 记录一次 Agent 调用事实，不承载业务结果。

最小字段：

```json
{
  "runId": "agent-run-001",
  "role": "main",
  "sessionId": "opencode-session-main-task-003",
  "inputArtifactRefs": [
    "taskDraft",
    "executionIntent",
    "executionAuthorization"
  ],
  "outputArtifactRefs": [],
  "status": "succeeded",
  "startedAt": "2026-05-18T10:00:00.000Z",
  "finishedAt": "2026-05-18T10:00:10.000Z"
}
```

`role` 枚举值：

```text
main
execution
review
```

`sessionId` 必须记录。三种 Agent 都需要通过 `sessionId` 支持事故后追溯。

`inputArtifactRefs` 由调用 Agent 的 flow 生成，表示系统本次明确交给 Agent 参考的任务上下文包内容。

`outputArtifactRefs` 由任务池在追加 artifact 后生成，表示本次调用最终产出了哪些任务上下文包 artifact。

Agent 不生成 `inputArtifactRefs`，也不生成 `outputArtifactRefs`。

原始 prompt、stdout、stderr、rawOutput、parseError 不进入任务上下文包。它们属于运行记录，通过 `runId` 追溯。

## 追加请求

Agent 调用完成后，flow 仍然通过统一追加请求交给任务池。

只记录 Agent 调用，不追加业务 artifact：

```json
{
  "appendRequest": {
    "packageId": "task-context-package:tasks/task-003.yaml",
    "agentRun": {
      "runId": "agent-run-001",
      "role": "main",
      "sessionId": "opencode-session-main-task-003",
      "inputArtifactRefs": [
        "taskDraft",
        "executionIntent",
        "executionAuthorization"
      ],
      "outputArtifactRefs": [],
      "status": "succeeded",
      "startedAt": "2026-05-18T10:00:00.000Z",
      "finishedAt": "2026-05-18T10:00:10.000Z"
    }
  }
}
```

记录 Agent 调用，并追加业务 artifact：

```json
{
  "appendRequest": {
    "packageId": "task-context-package:tasks/task-003.yaml",
    "artifactType": "executionReport",
    "artifact": {
      "summary": "完成 tasks 目录监听。"
    },
    "agentRun": {
      "runId": "agent-run-002",
      "role": "execution",
      "sessionId": "opencode-session-execution-002",
      "inputArtifactRefs": [
        "taskDraft",
        "executionIntent",
        "executionAuthorization"
      ],
      "outputArtifactRefs": [],
      "status": "succeeded",
      "startedAt": "2026-05-18T10:10:00.000Z",
      "finishedAt": "2026-05-18T10:20:00.000Z"
    }
  }
}
```

任务池执行追加时生成 artifactId，并补全 `agentRun.outputArtifactRefs`。

## Artifact 规则

执行前产物是单例：

```text
executionIntent
executionAuthorization
admissionRejection
humanDecisionRequest
```

Agent loop 产物是多例：

```text
executionReport:001
reviewReport:001
convergenceAdvice:001
```

artifactId 由任务池生成。Agent 不生成 artifactId。

## 收敛环节

收敛环节由 `main` Agent 执行。

它汇总某一轮 `execution` Agent 和 `review` Agent 的结果，结合任务上下文包内已有信息，产出下一轮执行意见。

收敛环节产物：

```text
convergenceAdvice
```

`convergenceAdvice` 是多例 artifact：

```text
convergenceAdvice:001
convergenceAdvice:002
```

它会作为下一轮 `execution` Agent 的输入，帮助执行过程收敛。

## inputArtifactRefs 业务规则

`inputArtifactRefs` 表示本次 Agent 工作所依据的任务事实、授权、上一轮结果和收敛意见。

第一版规则：

```text
main 初始化：
taskDraft, executionIntent, executionAuthorization

execution 第 1 轮：
taskDraft, executionIntent, executionAuthorization

review 第 1 轮：
taskDraft, executionAuthorization, executionReport:001

review 第 N 轮，N >= 2：
taskDraft, executionAuthorization, convergenceAdvice:N-1, executionReport:N

convergence 第 N 轮：
taskDraft, executionIntent, executionAuthorization, executionReport:N, reviewReport:N

execution 第 N+1 轮：
taskDraft, executionAuthorization, convergenceAdvice:N
```

`convergenceAdvice:0` 不存在。第一轮 execution 使用 `executionIntent`，第一轮 review 不使用 `convergenceAdvice`。

代码、文档、diff、测试输出等外部材料，如果没有被追加成任务上下文包 artifact，不进入 `inputArtifactRefs`。

## 边界规则

Agent 只产出结构化业务结果。

系统记录 `agentRun`。

任务池负责把 `agentRun` 和 artifact 原子追加到任务上下文包。

任务池负责生成 artifactId 和 `outputArtifactRefs`。

Agent 不直接写任务上下文包。

Agent 不决定工作流状态。

`main` Agent 不替代状态机；它只产出收敛建议。
