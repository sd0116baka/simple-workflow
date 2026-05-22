# 架构收尾说明

本项目经历了一轮大规模拆分后，当前目标不是继续增加模块数量，而是保留有深度的模块，合并只转发参数或只复述调用顺序的浅模块。

## 保留方向

- `src/server/server.js` 保持为进程入口，实际 HTTP 组合、路由分发、静态资源和重启流程放在 `src/server/` 的专门模块中。
- `src/workflow/workflow-service.js` 保持为 workflow 组合入口，read model、推荐运行、人工动作、测试状态桩、事件总线和任务监听各自拥有清晰接口。
- 浏览器端保留 page shell、API client、状态选择、view model 和 renderer 的分层，让 DOM 写入与 workflow 数据解释分开。
- `task-package-artifacts`、`stage-timeline`、agent session contract、auto-merge transaction 这类被多处消费且承载规则的模块优先保留。
- 测试优先覆盖行为、contract、错误分支和端到端流程，而不是锁死内部转发关系。

## 收敛规则

- 删除只记录过程的 round 文档。破坏性调整只在本文件、领域定义文档或必要 ADR 中总结。
- 合并只有一个 caller、只有少量代码、且删除后不会让 caller 变复杂的浅模块。
- 保留有真实 interface leverage 的模块：调用方不需要知道内部顺序、错误处理或存储形状。
- 新增模块前先做 deletion test：如果删除模块后复杂性只是消失或转移成同等简单代码，就不要新增。
- 不为历史兼容保留旧接口；当前调用面可直接迁移到新的深模块接口。

## 当前可接受的模块形状

- Server layer: 入口、runtime config、HTTP adapter、route catalog、route family definitions。
- Workflow layer: service composition、runtime facade、read model、task context mutation、recommendation lifecycle、manual action、test fixture、agent/session contracts。
- UI layer: page shell、snapshot state、data controller、commands/actions、section view models、section renderers、shared render helpers。

## 收尾验证

每轮收敛后至少运行：

```powershell
npm test
npm run testenv:start
```

测试环境固定使用 `http://localhost:5173`。如果端口被占用，先结束占用进程再启动测试环境。
