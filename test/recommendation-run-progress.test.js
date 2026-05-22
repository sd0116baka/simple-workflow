import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendRecommendationRunCancellationProgress,
  appendRecommendationRunProgress,
} from "../src/workflow/recommendation-run-progress.js";

test("recommendation run progress appends timestamped entries", () => {
  const run = { progress: [] };

  appendRecommendationRunProgress(
    run,
    {
      type: "stdout",
      message: "running",
    },
    {
      now: () => "2026-05-22T00:00:00.000Z",
    },
  );

  assert.deepEqual(run.progress, [
    {
      type: "stdout",
      message: "running",
      timestamp: "2026-05-22T00:00:00.000Z",
    },
  ]);
});

test("recommendation run progress keeps the latest entries within the limit", () => {
  const run = {
    progress: Array.from({ length: 200 }, (_, index) => ({
      type: "stdout",
      message: `line-${index + 1}`,
      timestamp: "old",
    })),
  };

  appendRecommendationRunProgress(
    run,
    {
      type: "stdout",
      message: "line-201",
    },
    {
      now: () => "2026-05-22T00:00:00.000Z",
    },
  );

  assert.equal(run.progress.length, 200);
  assert.equal(run.progress[0].message, "line-2");
  assert.deepEqual(run.progress.at(-1), {
    type: "stdout",
    message: "line-201",
    timestamp: "2026-05-22T00:00:00.000Z",
  });
});

test("recommendation run cancellation progress uses the canonical event shape", () => {
  const run = { progress: [] };

  appendRecommendationRunCancellationProgress(run, {
    now: () => "2026-05-22T00:00:00.000Z",
  });

  assert.deepEqual(run.progress, [
    {
      type: "cancel_requested",
      stream: "system",
      message: "用户请求取消运行",
      terminalLine: "process: cancellation requested by user",
      timestamp: "2026-05-22T00:00:00.000Z",
    },
  ]);
});
