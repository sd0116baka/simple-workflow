# 本地测试环境

用于在独立 git 仓库里测试 workflow，不污染 simple-workflow 项目仓库。

## 启动

```powershell
npm.cmd run testenv:start
```

脚本会：

```text
1. 杀掉占用 5173 的旧进程。
2. 重建 .workflow/test-environment/repository。
3. 在测试仓库内初始化 main 分支和 tasks/。
4. 用测试仓库作为 SIMPLE_WORKFLOW_REPOSITORY_DIR 启动网页管理界面。
```

访问：

```text
http://localhost:5173
```

## 重置

```powershell
npm.cmd run testenv:reset
```

该命令只重建测试仓库，不启动服务。

## 状态种子

网页右上角先选择目标状态，再点“生成状态桩”，会在测试仓库中生成一个 stub 任务和任务上下文包。

可选状态桩包括 `task-pool`、`task-recommender`、`execution-admission`、`isolated-workspace`、`main-agent`、`execution-agent`、`review-agent`、`convergence`、`auto-merge-planning`、`auto-merge-execution`、`merged`、`closed`、`cancelled`。`currentWorkStage` 的正式枚举和含义以 `docs/definitions/task-pool.md` 为准。

可选测试场景包括 `convergence-success`、`convergence-failure`、`human-guided-execution`。测试场景用于生成特定上下文包，不等同于 `currentWorkStage` 枚举。

其中 `convergence-success` 选项表示收敛成功场景：生成 `convergenceSuccess` 后会立即追加 `humanDecisionRequest`，并停在 `human-decision` 等待人工接受、带意见继续收敛或取消任务。

`convergence-failure` 选项表示收敛失败场景：生成 `convergenceFailure` 后追加 `humanDecisionRequest`，并停在 `human-decision` 等待人工提供收敛意见继续或取消任务。

真实 agent 失败模型验收：

```powershell
npm run testenv:agent-failure-e2e
```

该脚本会重置 5173 测试环境，并用临时 fake `opencode` 命令逐个制造 main 初始化、execution、review、convergence 的非零退出，验证 `agentRun.failure`、流程阻断位置和调试面板可读字段。

`human-guided-execution` 选项表示人工带意见继续收敛后的回环场景：先生成 `convergenceFailure` 和 `humanDecisionRequest`，再追加 `humanConvergenceGuidance`，并直接停在下一轮 `execution-agent`。

每次生成前会先清理旧的 `stub-*` 测试任务，所以一次只保留一个状态桩。测试完成后可以点击“清理状态桩”，删除所有 `stub-*` 任务文件和对应上下文包。

该按钮只允许写入 `.workflow/test-environment/repository`，避免误写项目仓库。

## 边界

测试环境位于 `.workflow/test-environment/`，该目录已被 `.gitignore` 忽略。

应用代码仍来自当前项目；workflow 读写的任务、上下文包、隔离 worktree 和任务分支都位于测试仓库内。
