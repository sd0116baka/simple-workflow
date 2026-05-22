import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRecommendationPrompt } from "../src/workflow/recommendation-run-records.js";

test("recommendation prompt injects only task pool candidates", () => {
  const prompt = buildRecommendationPrompt({
    basePrompt: "推荐一个任务。",
    candidateTasks: [
      {
        packageId: "task-context-package:tasks/task-003.yaml",
        taskDraft: {
          id: "task-003",
          name: "监听任务文件变化",
          kind: "feature",
          priority: "high",
          goal: "监听 tasks 目录变化",
          acceptanceCriteria: ["修改任务源文件后界面自动刷新"],
          maxIterations: "default",
        },
      },
    ],
  });

  assert.match(prompt, /candidateTasks/);
  assert.match(prompt, /task-003/);
  assert.doesNotMatch(prompt, /task-005-invalid/);
  assert.match(prompt, /只能使用这段 JSON 中的 candidateTasks/);
  assert.doesNotMatch(prompt, /canStartWork/);
});
