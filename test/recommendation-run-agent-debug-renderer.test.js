import { test } from "node:test";
import assert from "node:assert/strict";
import { renderRecommendationRunAgentDebug } from "../public/recommendation-run-agent-debug-renderer.js";
import { createFakeDocument, fakeElements } from "./support/fake-dom.js";

test("agent debug renderer writes empty state", () => {
  const elements = fakeElements(["agentDebugStatus", "agentDebugPanel"]);

  const viewModel = renderRecommendationRunAgentDebug({
    documentRef: createFakeDocument(),
    elements,
    recommendationRun: null,
  });

  assert.equal(elements.agentDebugStatus.textContent, "未运行");
  assert.equal(elements.agentDebugPanel.textContent, "尚未启动真实 agent。");
  assert.deepEqual(viewModel.runs, []);
});

test("agent debug renderer writes agent cards", () => {
  const elements = fakeElements(["agentDebugStatus", "agentDebugPanel"]);

  renderRecommendationRunAgentDebug({
    documentRef: createFakeDocument(),
    elements,
    recommendationRun: {
      status: "running",
      progress: [
        {
          type: "main_process_start",
          stream: "main-agent",
          message: "启动 main-agent:convergence:001：opencode run --format json",
          terminalLine: "$ opencode run --format json\ncwd: D:\\repo\\.workflow\\worktrees\\tasks\\task-001\nrunId: main-agent:convergence:001\npid: 777",
          timestamp: "2026-05-23T10:00:00.000Z",
        },
      ],
    },
  });

  assert.match(elements.agentDebugStatus.textContent, /1 个 agent run/);
  assert.equal(elements.agentDebugPanel.children.length, 1);
  assert.match(elements.agentDebugPanel.textContent, /main-agent:convergence:001/);
  assert.match(elements.agentDebugPanel.textContent, /pid777/);
  assert.match(elements.agentDebugPanel.textContent, /running/);
});

test("agent debug renderer writes failure details", () => {
  const elements = fakeElements(["agentDebugStatus", "agentDebugPanel"]);

  renderRecommendationRunAgentDebug({
    documentRef: createFakeDocument(),
    elements,
    taskContextPackage: {
      agentRuns: [
        {
          runId: "execution-agent:001",
          role: "execution",
          sessionId: "session:execution",
          inputArtifactRefs: [],
          outputArtifactRefs: [],
          status: "failed",
          startedAt: "2026-05-23T10:00:00.000Z",
          finishedAt: "2026-05-23T10:00:01.000Z",
          failure: {
            code: "agent.non-zero-exit",
            kind: "non-zero-exit",
            message: "execution failed",
            exitCode: 1,
          },
        },
      ],
    },
  });

  assert.match(elements.agentDebugPanel.textContent, /agent.non-zero-exit/);
  assert.match(elements.agentDebugPanel.textContent, /execution failed/);
});
