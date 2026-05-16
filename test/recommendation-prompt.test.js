import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRecommendationPrompt } from "../src/workflow/recommendation-prompt.js";

test("recommendation prompt injects only runtime runnable tasks as candidates", () => {
  const prompt = buildRecommendationPrompt({
    basePrompt: "推荐一个任务。",
    runtimeStatus: {
      status: "idle",
      canStartNewTask: true,
      blockingReasons: [],
      runnableTasks: [
        {
          id: "task-003",
          title: "监听任务文件变化",
          type: "feature",
          priority: "high",
          sourceFile: "task-003.yaml",
        },
      ],
      repositoryStatus: {
        clean: true,
        entries: [],
      },
    },
  });

  assert.match(prompt, /candidateTasks/);
  assert.match(prompt, /task-003/);
  assert.doesNotMatch(prompt, /task-005-invalid/);
  assert.match(prompt, /只能使用这段 JSON 中的 candidateTasks/);
});
