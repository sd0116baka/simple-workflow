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
  "runId": "main-agent:initialization",
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

`runId` 使用 Agent 名称和轮次命名，不使用全局流水号。

第一版命名规则：

```text
main-agent:initialization
execution-agent:001
review-agent:001
main-agent:convergence:001
execution-agent:002
review-agent:002
main-agent:convergence:002
```

`main-agent:initialization` 表示任务级 main Agent 会话初始化，不属于执行轮次。

`execution-agent:001` 表示第 1 轮执行。

`review-agent:001` 表示第 1 轮审查。

`main-agent:convergence:001` 表示第 1 轮收敛建议。

`execution-agent:002` 表示收敛建议后的第 2 轮执行。

`review-agent:002` 表示第 2 轮审查。

`main-agent:convergence:002` 表示第 2 轮收敛；它可以继续产出下一轮 `convergenceAdvice`，也可以产出终态 `taskCompletion`。

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
      "runId": "main-agent:initialization",
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
      "summary": "完成 tasks 目录监听。",
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
humanDecision
isolatedWorkspace
autoMergePlan
autoMergeRejection
autoMergeResult
autoMergeFailure
taskCloseout
```

Agent loop 产物是多例：

```text
executionReport:001
reviewReport:001
convergenceAdvice:001
```

任务成功收敛产物是单例：

```text
taskCompletion
```

人工决策请求产物是单例：

```text
humanDecisionRequest
```

人工决策结果产物是单例：

```text
humanDecision
```

artifactId 由任务池生成。Agent 不生成 artifactId。

## 隔离工作树

`isolatedWorkspace` 是任务级单例 artifact。

它表示这个任务的隔离开发工作树，绑定任务生命周期，不绑定某一轮 `execution` Agent。

第一版每个任务最多只有一个 `isolatedWorkspace`：

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

系统负责创建真实 git worktree，并把分配结果追加为 `isolatedWorkspace`。Agent 不决定工作树路径，不决定分支名，不决定主线合入。

创建时机：

```text
executionAuthorization
-> isolatedWorkspace
-> main-agent:initialization
-> execution-agent:001
```

准入通过后才创建 `isolatedWorkspace`。第一个 `execution` Agent 启动前，`isolatedWorkspace` 必须已经追加到任务上下文包。

系统尝试创建任务 worktree 时，如果发现同一路径已有上次运行残留，先自动清理，再完成本次分配。

如果同一任务的 worktree 已经存在且仍被 git 注册，系统复用它，不重复创建新工作树。

复用前系统必须自动清理该 worktree：

```text
git reset --hard <baseBranch>
git clean -fdx
```

这会丢弃该隔离工作树里的未提交变更和未跟踪文件，并把任务分支重新对齐当前 `baseBranch`。

如果目标路径存在但不是 git 注册的 worktree，且路径位于 `.workflow/worktrees/tasks/` 系统管理目录下，系统删除该残留路径后重新创建 worktree。

如果 git 记录里仍有该 worktree，但路径已经不存在，系统先 `git worktree prune`，再重新创建。

第一版命名规则：

```text
baseBranch: main
worktreePath: .workflow/worktrees/tasks/<safe-package-id>
branchName: workflow/tasks/<safe-package-id>
```

`safe-package-id` 从 `source.path` 派生，不从任务标题派生。

示例：

```text
tasks/task-003.yaml -> tasks-task-003
```

第一版不考虑文件改名。

`execution` Agent 使用 `isolatedWorkspace.body.worktreePath` 作为 `cwd`，可以修改这个工作树。

`executionReport` 必须记录本次执行使用的 `cwd` 和该 worktree 内的 `changedFiles`。

运行时 `execution` Agent 通过 `opencode run --format json` 在隔离工作树中执行。测试环境可以注入 stub execution Agent；stub 会写入 `.workflow-agent/<task>/<base>/<run>.txt`，只用于验证 cwd 传递和变更收集。

`review` Agent 读取同一个 `isolatedWorkspace.body.worktreePath`，原则上只读。第一版只在 review Agent 提示词中要求不得修改文件，不做代码级 diff 检查。

`main` Agent 不读取 `isolatedWorkspace`。

`accept-completion` 后，后续 integration flow 读取 `isolatedWorkspace`、`taskCompletion`、人工决策产物、最新 `executionReport` 和最新 `reviewReport`，由系统负责合入主线。

未来如果需要从某一轮接收成果、重试或并行探索，再新增 `workspaceCheckpoint` 或 `workspaceFork`。第一版不引入多工作树。

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

它会作为下一轮 `execution` Agent 和 `review` Agent 的输入，帮助执行过程收敛。

收敛环节不会结束工作流。状态机收到 `convergenceAdvice:N` 后，可以继续调用下一轮 `execution` Agent，并把该建议放进下一轮 `execution` Agent 的 `inputArtifactRefs`。

如果 `main` Agent 在收敛环节判断任务已经满足完成条件，它不再产出 `convergenceAdvice`，而是产出：

```text
taskCompletion
```

`taskCompletion` 表示任务成功收敛。它是终态产物，不作为下一轮 Agent 输入。

`taskCompletion` 不是任务最终关闭凭据。它只表示 Agent 认为任务已经完成。

系统收到 `taskCompletion` 后，必须追加 `humanDecisionRequest`，把是否接受完成交给人工决定。

人工接受完成后，系统追加 `humanDecision`：

```json
{
  "artifactId": "humanDecision",
  "body": {
    "decision": "accept-completion",
    "decidedAt": "2026-05-19T10:00:00.000Z",
    "taskCompletionRef": "taskCompletion",
    "acceptedWork": {
      "isolatedWorkspaceRef": "isolatedWorkspace",
      "worktreePath": ".workflow/worktrees/tasks/tasks-task-003",
      "branchName": "workflow/tasks/tasks-task-003",
      "baseCommit": "abc123"
    },
    "worktreeSnapshot": {
      "cwd": ".workflow/worktrees/tasks/tasks-task-003",
      "changedFiles": [
        ".workflow-agent/execution-agent-001.txt"
      ]
    },
    "nextRequiredStage": "auto-merge"
  },
  "appendedAt": "2026-05-19T10:00:00.000Z"
}
```

追加 `humanDecision` 后，`currentWorkStage` 推进到 `auto-merge`。自动合并环节另行消费该产物，本环节不合并主线。

第一版只处理成功收敛后的人工确认；任务无法收敛、超过循环次数、审查冲突等分支另行定义。

## inputArtifactRefs 业务规则

`inputArtifactRefs` 表示本次 Agent 工作所依据的任务事实、授权、上一轮结果和收敛意见。

第一版规则：

```text
main 初始化：
taskDraft, executionIntent, executionAuthorization

execution 第 1 轮：
taskDraft, executionIntent, executionAuthorization, isolatedWorkspace

review 第 1 轮：
taskDraft, executionAuthorization, isolatedWorkspace, executionReport:001

review 第 N 轮，N >= 2：
taskDraft, executionAuthorization, convergenceAdvice:N-1, isolatedWorkspace, executionReport:N

convergence 第 N 轮：
taskDraft, executionIntent, executionAuthorization, convergenceAdvice:N-1, executionReport:N, reviewReport:N

execution 第 N+1 轮：
taskDraft, executionIntent, executionAuthorization, convergenceAdvice:N, isolatedWorkspace
```

`convergenceAdvice:0` 不存在。第一轮 execution、第一轮 review 和第一轮 convergence 都不使用 `convergenceAdvice`。

代码、文档、diff、测试输出等外部材料，如果没有被追加成任务上下文包 artifact，不进入 `inputArtifactRefs`。

## 边界规则

Agent 只产出结构化业务结果。

系统记录 `agentRun`。

任务池负责把 `agentRun` 和 artifact 原子追加到任务上下文包。

任务池负责生成 artifactId 和 `outputArtifactRefs`。

Agent 不直接写任务上下文包。

Agent 不决定工作流状态。

`main` Agent 不替代状态机；它只产出收敛建议。
