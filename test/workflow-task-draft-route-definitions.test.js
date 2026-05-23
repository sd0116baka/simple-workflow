import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowTaskDraftRouteDefinitions } from "../src/server/workflow-task-draft-route-definitions.js";

function createHttpAdapterProbe() {
  const calls = [];
  return {
    calls,
    async readJsonBody(request) {
      calls.push(["readJsonBody", request.body]);
      return request.body ?? {};
    },
    sendJson(response, status, payload) {
      calls.push(["sendJson", status, payload]);
      response.sent = { status, payload };
    },
  };
}

test("task draft route discusses task source drafts", async () => {
  const httpAdapter = createHttpAdapterProbe();
  const calls = [];
  const definitions = createWorkflowTaskDraftRouteDefinitions({
    httpAdapter,
    workflowService: {
      async discussTaskSourceDraft(input) {
        calls.push(input);
        return {
          assistantMessage: "先确认验收标准。",
          taskSourceText: null,
        };
      },
      async createTaskSourceFromDraft(input) {
        calls.push(input);
        return { fileName: "drafted-task.yaml" };
      },
    },
  });
  const response = {};

  await definitions[0].handle({
    request: {
      body: {
        mode: "discuss",
        messages: [{ role: "user", content: "做一个导入功能" }],
      },
    },
    response,
  });

  assert.deepEqual(calls, [{
    mode: "discuss",
    messages: [{ role: "user", content: "做一个导入功能" }],
  }]);
  assert.equal(response.sent.status, 200);
  assert.deepEqual(response.sent.payload.taskDraft, {
    assistantMessage: "先确认验收标准。",
    taskSourceText: null,
  });
});

test("task draft route creates task source from finalized text", async () => {
  const httpAdapter = createHttpAdapterProbe();
  const calls = [];
  const definitions = createWorkflowTaskDraftRouteDefinitions({
    httpAdapter,
    workflowService: {
      async createTaskSourceFromDraft(input) {
        calls.push(input);
        return { fileName: "drafted-task.yaml" };
      },
    },
  });
  const response = {};

  await definitions[1].handle({
    request: {
      body: {
        taskSourceText: "id: drafted-task\n",
      },
    },
    response,
  });

  assert.deepEqual(calls, [{ taskSourceText: "id: drafted-task\n" }]);
  assert.equal(response.sent.status, 201);
  assert.deepEqual(response.sent.payload.taskSource, {
    fileName: "drafted-task.yaml",
  });
});

test("task draft route maps task source creation errors to bad request", async () => {
  const httpAdapter = createHttpAdapterProbe();
  const definitions = createWorkflowTaskDraftRouteDefinitions({
    httpAdapter,
    workflowService: {
      async createTaskSourceFromDraft() {
        throw new Error("task source is invalid");
      },
    },
  });
  const response = {};

  await definitions[1].handle({
    request: { body: { taskSourceText: "bad" } },
    response,
  });

  assert.equal(response.sent.status, 400);
  assert.deepEqual(response.sent.payload, {
    error: "task source is invalid",
  });
});
