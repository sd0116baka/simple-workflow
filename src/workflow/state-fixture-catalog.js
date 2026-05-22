export const STAGE_FIXTURES = [
  { id: "stub-task-pool", title: "Stub task-pool", fixtureKey: "task-pool", currentWorkStage: "task-pool" },
  { id: "stub-task-recommender", title: "Stub task-recommender", fixtureKey: "task-recommender", currentWorkStage: "task-recommender" },
  { id: "stub-execution-admission", title: "Stub execution-admission", fixtureKey: "execution-admission", currentWorkStage: "execution-admission" },
  { id: "stub-isolated-workspace", title: "Stub isolated-workspace", fixtureKey: "isolated-workspace", currentWorkStage: "isolated-workspace" },
  { id: "stub-main-agent", title: "Stub main-agent", fixtureKey: "main-agent", currentWorkStage: "main-agent" },
  { id: "stub-execution-agent", title: "Stub execution-agent", fixtureKey: "execution-agent", currentWorkStage: "execution-agent" },
  { id: "stub-review-agent", title: "Stub review-agent", fixtureKey: "review-agent", currentWorkStage: "review-agent" },
  { id: "stub-convergence", title: "Stub convergence", fixtureKey: "convergence", currentWorkStage: "convergence" },
  {
    id: "stub-convergence-success",
    title: "Stub convergence-success",
    fixtureKey: "convergence-success",
    currentWorkStage: "human-decision",
    humanDecisionScenario: "convergence-success",
  },
  {
    id: "stub-convergence-failure",
    title: "Stub convergence-failure",
    fixtureKey: "convergence-failure",
    currentWorkStage: "human-decision",
    humanDecisionScenario: "convergence-failure",
  },
  {
    id: "stub-human-guided-execution",
    title: "Stub human-guided-execution",
    fixtureKey: "human-guided-execution",
    currentWorkStage: "execution-agent",
    humanDecisionScenario: "human-guided-execution",
  },
  { id: "stub-auto-merge-planning", title: "Stub auto-merge-planning", fixtureKey: "auto-merge-planning", currentWorkStage: "auto-merge-planning" },
  { id: "stub-auto-merge-execution", title: "Stub auto-merge-execution", fixtureKey: "auto-merge-execution", currentWorkStage: "auto-merge-execution" },
  { id: "stub-merged", title: "Stub merged", fixtureKey: "merged", currentWorkStage: "merged" },
  { id: "stub-closed", title: "Stub closed", fixtureKey: "closed", currentWorkStage: "closed" },
  { id: "stub-cancelled", title: "Stub cancelled", fixtureKey: "cancelled", currentWorkStage: "cancelled" },
];

export function yamlForFixture({ id, title, currentWorkStage }) {
  return [
    `id: ${id}`,
    `title: ${title}`,
    "type: fixture",
    "priority: low",
    `description: 用于测试 ${currentWorkStage} 环节展示的 stub 任务。`,
    "acceptance:",
    `  - 页面可以展示 ${currentWorkStage} 状态`,
    "",
  ].join("\n");
}
