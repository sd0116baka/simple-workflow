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

## 边界

测试环境位于 `.workflow/test-environment/`，该目录已被 `.gitignore` 忽略。

应用代码仍来自当前项目；workflow 读写的任务、上下文包、隔离 worktree 和任务分支都位于测试仓库内。
