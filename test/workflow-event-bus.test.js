import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowEventBus } from "../src/workflow/workflow-event-bus.js";

test("workflow event bus emits task change events to active listeners", () => {
  const eventBus = createWorkflowEventBus();
  const events = [];
  const unsubscribe = eventBus.onEvent((event) => events.push(event));

  eventBus.emitTaskChange({
    eventType: "change",
    fileName: "task.yaml",
    timestamp: "2026-05-21T00:00:00.000Z",
  });
  unsubscribe();
  eventBus.emitTaskChange({
    eventType: "change",
    fileName: "ignored.yaml",
    timestamp: "2026-05-21T00:00:01.000Z",
  });

  assert.deepEqual(events, [
    {
      type: "tasks-changed",
      eventType: "change",
      fileName: "task.yaml",
      timestamp: "2026-05-21T00:00:00.000Z",
    },
  ]);
});

test("workflow event bus snapshots recommendation run change events", () => {
  const eventBus = createWorkflowEventBus({
    now: () => "2026-05-21T00:00:00.000Z",
    toRecommendationRunSnapshot(run) {
      return {
        id: run.id,
        status: run.status,
      };
    },
  });
  const events = [];
  eventBus.onEvent((event) => events.push(event));

  eventBus.emitRecommendationChanged({
    id: "recommendation-run-1",
    status: "running",
    mutable: {
      value: true,
    },
  });

  assert.deepEqual(events, [
    {
      type: "recommendation-run-changed",
      run: {
        id: "recommendation-run-1",
        status: "running",
      },
      timestamp: "2026-05-21T00:00:00.000Z",
    },
  ]);
});

test("workflow event bus emits terminal session change events", () => {
  const eventBus = createWorkflowEventBus({
    now: () => "2026-05-21T00:00:00.000Z",
  });
  const events = [];
  eventBus.onEvent((event) => events.push(event));

  eventBus.emitTerminalSessionChanged({
    id: "terminal-session-1",
    status: "running",
  });

  assert.deepEqual(events, [
    {
      type: "terminal-session-changed",
      terminalSession: {
        id: "terminal-session-1",
        status: "running",
      },
      timestamp: "2026-05-21T00:00:00.000Z",
    },
  ]);
});

test("workflow event bus clears all listeners", () => {
  const eventBus = createWorkflowEventBus();
  let count = 0;
  eventBus.onEvent(() => {
    count += 1;
  });
  eventBus.onEvent(() => {
    count += 1;
  });

  eventBus.clear();
  eventBus.emit({
    type: "ignored",
  });

  assert.equal(count, 0);
});
