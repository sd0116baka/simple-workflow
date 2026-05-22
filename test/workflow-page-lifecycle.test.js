import { test } from "node:test";
import assert from "node:assert/strict";
import {
  connectWorkflowEventStream,
  startRecommendationRunRefreshLoop,
} from "../public/workflow-page-lifecycle.js";

class FakeEventSource {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.listeners = new Map();
    FakeEventSource.instances.push(this);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  emit(type) {
    return this.listeners.get(type)?.({ type });
  }
}

function createCallLog() {
  const calls = [];
  return {
    calls,
    async task() {
      calls.push("tasks");
    },
    async recommendation() {
      calls.push("recommendation");
    },
    async terminal() {
      calls.push("terminal");
    },
    async sync() {
      calls.push("sync");
    },
    showError(error) {
      calls.push(`error:${error.message}`);
    },
  };
}

test("workflow event stream wires server events to page refresh actions", async () => {
  FakeEventSource.instances = [];
  const log = createCallLog();

  const stream = connectWorkflowEventStream({
    EventSourceCtor: FakeEventSource,
    loadTasks: log.task.bind(log),
    loadRecommendationRun: log.recommendation.bind(log),
    loadTerminalSession: log.terminal.bind(log),
    syncRecommendationRunSilently: log.sync.bind(log),
    showError: log.showError.bind(log),
  });

  assert.equal(stream.url, "/api/events");
  await stream.emit("open");
  assert.deepEqual(log.calls, ["tasks", "recommendation"]);

  await stream.emit("tasks-changed");
  assert.deepEqual(log.calls, ["tasks", "recommendation", "tasks"]);

  await stream.emit("recommendation-run-changed");
  assert.deepEqual(log.calls, [
    "tasks",
    "recommendation",
    "tasks",
    "tasks",
    "recommendation",
  ]);

  await stream.emit("terminal-session-changed");
  assert.deepEqual(log.calls, [
    "tasks",
    "recommendation",
    "tasks",
    "tasks",
    "recommendation",
    "terminal",
  ]);
});

test("workflow event stream routes refresh errors to the supplied error handler", async () => {
  const log = createCallLog();
  const stream = connectWorkflowEventStream({
    EventSourceCtor: FakeEventSource,
    loadTasks: async () => {
      throw new Error("tasks failed");
    },
    loadRecommendationRun: log.recommendation.bind(log),
    syncRecommendationRunSilently: log.sync.bind(log),
    showError: log.showError.bind(log),
  });

  await stream.emit("tasks-changed");
  assert.deepEqual(log.calls, ["error:tasks failed"]);
});

test("workflow event stream delays silent sync after a running connection error", () => {
  const log = createCallLog();
  const scheduled = [];
  const stream = connectWorkflowEventStream({
    EventSourceCtor: FakeEventSource,
    loadTasks: log.task.bind(log),
    loadRecommendationRun: log.recommendation.bind(log),
    syncRecommendationRunSilently: log.sync.bind(log),
    showError: log.showError.bind(log),
    onConnectionError: () => true,
    setTimeoutFn: (callback, delay) => {
      scheduled.push({ callback, delay });
    },
  });

  stream.emit("error");

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delay, 1500);
  scheduled[0].callback();
  assert.deepEqual(log.calls, ["sync"]);
});

test("workflow event stream skips unsupported EventSource environments", () => {
  assert.equal(connectWorkflowEventStream({ EventSourceCtor: null }), null);
});

test("recommendation run refresh loop renders and syncs only stale running runs", () => {
  const calls = [];
  let tick;
  const intervalId = startRecommendationRunRefreshLoop({
    isRecommendationRunRunning: () => true,
    renderRecommendationRun: () => calls.push("render"),
    latestRecommendationSyncAt: () => 1000,
    syncRecommendationRunSilently: () => calls.push("sync"),
    now: () => 7001,
    setIntervalFn: (callback, delay) => {
      tick = callback;
      calls.push(`interval:${delay}`);
      return "interval-id";
    },
  });

  assert.equal(intervalId, "interval-id");
  tick();
  assert.deepEqual(calls, ["interval:1000", "render", "sync"]);
});

test("recommendation run refresh loop does nothing when no run is active", () => {
  const calls = [];
  let tick;
  startRecommendationRunRefreshLoop({
    isRecommendationRunRunning: () => false,
    renderRecommendationRun: () => calls.push("render"),
    latestRecommendationSyncAt: () => 0,
    syncRecommendationRunSilently: () => calls.push("sync"),
    setIntervalFn: (callback) => {
      tick = callback;
    },
  });

  tick();
  assert.deepEqual(calls, []);
});
