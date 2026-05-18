import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRecommendationIntent } from "../src/workflow/recommendation-intent.js";

const validIntent = {
  appendRequest: {
    packageId: "task-context-package:tasks/task-003.yaml",
    artifactType: "executionIntent",
    artifact: {
      recommendedPackageId: "task-context-package:tasks/task-003.yaml",
      confidence: "high",
      selectionReasoning: ["优先级最高"],
      candidateComparison: [
        {
          packageId: "task-context-package:tasks/task-003.yaml",
          decision: "selected",
          reason: "优先级最高",
        },
      ],
      executionBrief: {
        goalInterpretation: "监听 tasks 目录变化",
        expectedOutcome: ["界面自动刷新"],
        implementationHints: ["检查 /api/events"],
        riskSignals: ["文件事件可能重复触发"],
        openQuestions: [],
      },
    },
  },
};

test("parses a fenced recommendation intent", () => {
  const result = parseRecommendationIntent(`\`\`\`json\n${JSON.stringify(validIntent)}\n\`\`\``);

  assert.equal(result.error, null);
  assert.equal(result.appendRequest.artifactType, "executionIntent");
  assert.equal(result.intent.recommendedPackageId, "task-context-package:tasks/task-003.yaml");
  assert.equal(result.intent.confidence, "high");
  assert.equal(result.intent.candidateComparison[0].decision, "selected");
  assert.equal(result.intent.executionBrief.openQuestions.length, 0);
});

test("returns an error for invalid recommendation intent JSON", () => {
  const result = parseRecommendationIntent("not json");

  assert.equal(result.intent, null);
  assert.match(result.error, /Unexpected token|JSON/);
});

test("returns an error when required fields are missing", () => {
  const result = parseRecommendationIntent(JSON.stringify({ appendRequest: null }));

  assert.equal(result.intent, null);
  assert.match(result.error, /appendRequest/);
});
