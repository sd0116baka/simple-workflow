# Opencode Agent Probe Design

## Goal

手动触发一次 `opencode run`，服务端接收原始输出，前端展示结果。

这一版只验证 agent CLI 调用链路，不解析推荐、不生成执行意图、不修改任务状态。

## Scope

- 前端增加“任务推荐器”面板和手动触发按钮。
- 服务端提供一次性 recommendation run API。
- 服务端用子进程调用 `opencode run`。
- 捕获并展示 `stdout`、`stderr`、`exitCode`、`status`。
- run 只保存在内存里。

## Non-goals

- 不做自动推荐。
- 不做 JSON schema 校验。
- 不把输出写回任务上下文包。
- 不进入执行准入、执行授权或主 Agent 调度。

## Interfaces

- `POST /api/recommendation-runs`
  - 创建一次 run，立即返回 run snapshot。
- `GET /api/recommendation-runs/latest`
  - 返回最近一次 run，没有则返回 `null`。
- SSE 事件：`recommendation-run-changed`
  - run 状态变化时通知前端刷新。

## Prompt

推荐器 agent 的 prompt 放在 `project_profiles/recommender-agent.prompt.md`。

第一版 prompt 只要求 agent 返回一段可见文本，并明确不要修改文件。

## Testing

- 单元测试使用可注入命令，不真实调用模型。
- 覆盖成功输出、失败退出、stderr 捕获、workflow 事件。
- 手动验证真实 `opencode run` 能从界面触发并显示输出。
