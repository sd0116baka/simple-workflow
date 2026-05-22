# 架构维护说明

本项目已经完成一轮大规模拆分和收尾。后续目标不是持续追求文件数量更少或更多，而是让每个模块保留清晰职责、稳定接口和足够行为深度。

## 稳定方向

- `src/server/server.js` 保持为进程入口，实际 HTTP 组合、路由分发、静态资源和重启流程放在 `src/server/` 的专门模块中。
- `src/workflow/workflow-service.js` 保持为 workflow 组合入口，read model、推荐运行、人工动作、测试状态桩、事件总线和任务监听各自拥有清晰接口。
- 浏览器端保留 page shell、API client、状态选择、view model 和 renderer 的分层，让 DOM 写入与 workflow 数据解释分开。
- `task-package-artifacts`、`stage-timeline`、agent session contract、auto-merge transaction 这类被多处消费且承载规则的模块优先保留。
- 测试优先覆盖行为、contract、错误分支和端到端流程，而不是锁死内部转发关系。

## 当前可接受的模块形状

- Server layer: 入口、runtime config、HTTP adapter、route catalog、route family definitions。
- Workflow layer: service composition、runtime facade、read model、task context mutation、recommendation lifecycle、manual action、test fixture、agent/session contracts。
- UI layer: page shell、snapshot state、data controller、commands/actions、section view models、section renderers、shared render helpers。

