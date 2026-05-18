import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRecommendationPrompt } from "../src/workflow/recommendation-prompt.js";

test("recommendation prompt injects only task pool candidates", () => {
  const prompt = buildRecommendationPrompt({
    basePrompt: "推荐一个任务。",
    candidateTasks: [
      {
        packageId: "task-context-package:tasks/task-003.yaml",
        id: "task-003",
        title: "监听任务文件变化",
        type: "feature",
        priority: "high",
        sourceFile: "task-003.yaml",
      },
    ],
    startupCheck: {
      canStartWork: true,
      findings: [],
      runtimeSnapshot: {
        activeWork: null,
        worktree: {
          clean: true,
          changedFiles: [],
        },
      },
    },
  });

  assert.match(prompt, /candidateTasks/);
  assert.match(prompt, /task-003/);
  assert.doesNotMatch(prompt, /task-005-invalid/);
  assert.match(prompt, /只能使用这段 JSON 中的 candidateTasks/);
  assert.match(prompt, /canStartWork/);
});
