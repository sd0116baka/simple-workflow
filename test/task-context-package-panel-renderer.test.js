import { test } from "node:test";
import assert from "node:assert/strict";
import { createTaskContextPackagePanel } from "../public/task-context-package-panel-renderer.js";
import {
  createFakeDocument,
  findAll,
} from "./support/fake-dom.js";

test("task context package panel renderer creates artifact and agent run DOM", () => {
  const panel = createTaskContextPackagePanel(createFakeDocument(), {
    packageId: "task-context-package:tasks/task-001.yaml",
    currentWorkStage: "auto-merge-execution",
    source: { path: "tasks/task-001.yaml" },
    qualityGate: { outcome: "passed" },
    artifacts: {
      executionIntent: {
        artifactId: "executionIntent:001",
        body: {
          executionBrief: { goalInterpretation: "实现任务池过滤" },
        },
      },
      executionAuthorization: {
        artifactId: "executionAuthorization:001",
        body: { authorizedAt: "2026-05-21T10:00:00.000Z" },
      },
      autoMergePlan: {
        artifactId: "autoMergePlan:001",
        body: { summary: "fast-forward merge" },
      },
    },
    agentRuns: [
      {
        runId: "execution-agent:001",
        role: "execution",
        status: "completed",
        sessionId: "session:execution:001",
      },
    ],
  });

  assert.equal(panel.className, "context-package auto-merge-execution");
  assert.match(panel.textContent, /task-context-package:tasks\/task-001\.yaml/);
  assert.match(panel.textContent, /currentWorkStage: auto-merge-execution/);
  assert.match(panel.textContent, /基础包passed/);
  assert.match(panel.textContent, /执行意图已追加/);
  assert.match(panel.textContent, /自动合并计划已生成/);
  assert.match(panel.textContent, /executionIntent:001/);
  assert.match(panel.textContent, /实现任务池过滤/);
  assert.match(panel.textContent, /Agent 调用/);
  assert.match(panel.textContent, /execution-agent:001/);
  assert.match(panel.textContent, /execution · completed/);
  assert.equal(findAll(panel, (element) => element.className === "context-package-records").length, 2);
});
