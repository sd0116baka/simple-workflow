import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAdmissionPanel,
  createIntentPanel,
} from "../public/recommendation-panel-renderers.js";
import {
  createFakeDocument,
  findAll,
} from "./support/fake-dom.js";

test("recommendation panel renderers create execution intent DOM", () => {
  const panel = createIntentPanel(createFakeDocument(), {
    recommendedPackageId: "task-context-package:tasks/task-001.yaml",
    confidence: "high",
    executionBrief: { goalInterpretation: "实现任务池过滤" },
    selectionReasoning: ["优先级最高", "验收标准清晰"],
    candidateComparison: [
      { packageId: "task-001", decision: "selected" },
      { packageId: "task-002", decision: "deferred" },
    ],
  });

  assert.equal(panel.className, "recommendation-intent");
  assert.match(panel.textContent, /task-context-package:tasks\/task-001\.yaml/);
  assert.match(panel.textContent, /推荐置信度：high/);
  assert.match(panel.textContent, /实现任务池过滤/);
  assert.match(panel.textContent, /优先级最高/);
  assert.match(panel.textContent, /candidateComparison: task-001:selected, task-002:deferred/);
  assert.equal(findAll(panel, (element) => element.className === "recommendation-intent-list").length, 1);
});

test("recommendation panel renderers create authorized admission DOM", () => {
  const panel = createAdmissionPanel(createFakeDocument(), {
    appendRequest: {
      packageId: "task-context-package:tasks/task-001.yaml",
      artifactType: "executionAuthorization",
      artifact: {},
    },
  });

  assert.equal(panel.className, "admission-panel executionAuthorization");
  assert.match(panel.textContent, /已授权执行：task-context-package:tasks\/task-001\.yaml/);
  assert.match(panel.textContent, /artifactType: executionAuthorization/);
});

test("recommendation panel renderers create rejected admission findings", () => {
  const panel = createAdmissionPanel(createFakeDocument(), {
    appendRequest: {
      packageId: "task-context-package:tasks/task-002.yaml",
      artifactType: "admissionRejection",
      artifact: {
        findings: [
          { code: "dirty-worktree", message: "工作区不干净" },
        ],
      },
    },
  });

  assert.equal(panel.className, "admission-panel admissionRejection");
  assert.match(panel.textContent, /未授权执行：task-context-package:tasks\/task-002\.yaml/);
  assert.match(panel.textContent, /dirty-worktree: 工作区不干净/);
  assert.equal(findAll(panel, (element) => element.className === "admission-reasons").length, 1);
});
