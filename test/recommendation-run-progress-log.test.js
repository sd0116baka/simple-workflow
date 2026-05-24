import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRecommendationRunProgressLogStore,
  createRecommendationRunProgressRecorder,
} from "../src/workflow/recommendation-run-progress-log.js";

async function createLogDir(t) {
  const dir = await mkdtemp(join(tmpdir(), "simple-workflow-progress-log-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("recommendation run progress recorder keeps memory bounded while log stays complete", async (t) => {
  const logDir = await createLogDir(t);
  const run = { id: "recommendation-run-1", progress: [] };
  const store = createRecommendationRunProgressLogStore({
    logDir,
    now: () => "2026-05-24T00:00:00.000Z",
  });
  const recorder = createRecommendationRunProgressRecorder({
    progressLogStore: store,
    now: () => "2026-05-24T00:00:00.000Z",
  });

  for (let index = 1; index <= 205; index += 1) {
    recorder.appendProgress(run, {
      type: "execution_stdout",
      message: `line-${index}`,
    });
  }

  assert.equal(run.progress.length, 200);
  assert.equal(run.progress[0].message, "line-6");
  assert.equal(run.progress.at(-1).message, "line-205");

  const events = store.read("recommendation-run-1");
  assert.equal(events.length, 205);
  assert.equal(events[0].message, "line-1");
  assert.equal(events.at(-1).message, "line-205");
  assert.equal(events.at(-1).runId, "recommendation-run-1");
});

test("recommendation run progress recorder binds package ids for later log events", async (t) => {
  const logDir = await createLogDir(t);
  const run = { id: "recommendation-run-1", progress: [] };
  const store = createRecommendationRunProgressLogStore({
    logDir,
    now: () => "2026-05-24T00:00:00.000Z",
  });
  const recorder = createRecommendationRunProgressRecorder({
    progressLogStore: store,
    now: () => "2026-05-24T00:00:00.000Z",
  });

  recorder.recordSystemEvent(run, {
    type: "run_started",
    message: "started",
  });
  recorder.bindPackage(run, "task-context-package:tasks/task-001.yaml");
  recorder.appendProgress(run, {
    type: "execution_stdout",
    message: "execution output",
  });

  const events = store.read("recommendation-run-1");
  assert.equal(events[0].packageId, undefined);
  assert.equal(events[1].type, "package_bound");
  assert.equal(events[1].packageId, "task-context-package:tasks/task-001.yaml");
  assert.equal(events[2].packageId, "task-context-package:tasks/task-001.yaml");
});

test("recommendation run progress recorder exposes log write failures without throwing", () => {
  const run = { id: "recommendation-run-1", progress: [] };
  const recorder = createRecommendationRunProgressRecorder({
    progressLogStore: {
      append() {
        throw new Error("disk full");
      },
    },
    now: () => "2026-05-24T00:00:00.000Z",
  });

  assert.doesNotThrow(() => recorder.appendProgress(run, {
    type: "execution_stdout",
    message: "still running",
  }));
  assert.equal(run.progressLogError, "disk full");
  assert.equal(run.progress.at(-1).type, "log_write_failed");
  assert.match(run.progress.at(-1).terminalLine, /disk full/);
});
