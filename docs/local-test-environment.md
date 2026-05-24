# 本地测试环境

本地测试环境只做一件事：在 `.workflow/test-environment/repository` 里生成一个独立 git 仓库，避免 workflow 调试污染 simple-workflow 项目仓库。

## 重建测试仓库

```bash
npm run testenv:reset
```

脚本会删除并重建测试仓库，初始化 `main` 分支和 `tasks/` 目录，然后打印启动服务需要的环境变量。

## 启动服务

默认使用包装脚本启动测试环境：

```powershell
npm.cmd run testenv:start
```

脚本会杀掉占用 `5173` 的旧进程，重建测试仓库，把测试仓库路径写入当前服务进程的环境变量，然后启动网页管理界面。

如果已经手动执行过 `testenv:reset`，也可以把它打印出的环境变量用于当前 shell，再启动服务：

```bash
npm run dev
```

默认访问地址：

```text
http://localhost:5173
```

## 状态种子与冒烟测试

页面右上角可以生成状态桩。状态桩会写入测试仓库中的 `stub-*` 任务和对应上下文包；每次生成前会清理旧状态桩。

可用状态桩包括：`task-pool`、`task-recommender`、`execution-admission`、`isolated-workspace`、`main-agent`、`execution-agent`、`review-agent`、`convergence`、`convergence-success`、`convergence-failure`、`human-guided-execution`、`auto-merge-planning`、`auto-merge-execution`、`merged`、`closed`、`cancelled`。

服务已启动后，可以跑：

```bash
npm run testenv:smoke
```

真实 agent 失败模型验收仍使用：

```bash
npm run testenv:agent-failure-e2e
```

## 边界

`.workflow/test-environment/` 是运行时产物，不属于源码。应用代码仍来自当前项目；任务、上下文包、隔离 worktree 和任务分支都位于测试仓库内。
