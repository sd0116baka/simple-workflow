import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRecommendationIntent } from "../src/workflow/recommendation-intent.js";

const validIntent = {
  schemaVersion: 1,
  recommendedTask: {
    id: "task-003",
    sourceFile: "tasks/task-003.yaml",
    title: "监听任务文件变化",
    priority: "high",
  },
  confidence: "high",
  rationale: ["优先级最高"],
  repoStatus: {
    clean: true,
    changedFiles: [],
  },
  observedTasks: [
    {
      id: "task-003",
      sourceFile: "tasks/task-003.yaml",
      title: "监听任务文件变化",
      priority: "high",
      status: "unspecified",
    },
  ],
  nextAction: "优先实现 task-003。",
};

test("parses a fenced recommendation intent", () => {
  const result = parseRecommendationIntent(`\`\`\`json\n${JSON.stringify(validIntent)}\n\`\`\``);

  assert.equal(result.error, null);
  assert.equal(result.intent.recommendedTask.id, "task-003");
  assert.equal(result.intent.confidence, "high");
  assert.equal(result.intent.repoStatus.clean, true);
  assert.equal(result.intent.observedTasks[0].status, "unspecified");
});

test("returns an error for invalid recommendation intent JSON", () => {
  const result = parseRecommendationIntent("not json");

  assert.equal(result.intent, null);
  assert.match(result.error, /Unexpected token|JSON/);
});

test("returns an error when required fields are missing", () => {
  const result = parseRecommendationIntent(JSON.stringify({ ...validIntent, recommendedTask: null }));

  assert.equal(result.intent, null);
  assert.match(result.error, /recommendedTask/);
});
