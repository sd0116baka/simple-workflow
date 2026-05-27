import { test } from "node:test";
import assert from "node:assert/strict";
import {
  commitTaskSourceFile,
  createTaskSourceMutationService,
} from "../src/workflow/task-source-mutation-service.js";

test("task source mutation service writes text and emits a task change", async () => {
  const calls = [];
  const service = createTaskSourceMutationService({
    tasksDir: "tasks",
    now: () => "2026-05-22T10:00:00.000Z",
    emitTaskChange: (event) => calls.push(["emitTaskChange", event]),
    createTaskSource: async (input) => {
      calls.push(["createTaskSource", input]);
      return { fileName: "drafted-task.yaml" };
    },
  });

  assert.deepEqual(
    await service.createTaskSourceFromText({ taskSourceText: "id: drafted-task\n" }),
    { fileName: "drafted-task.yaml" },
  );
  assert.deepEqual(calls, [
    ["createTaskSource", {
      tasksDir: "tasks",
      taskSourceText: "id: drafted-task\n",
    }],
    ["emitTaskChange", {
      eventType: "create-task-source",
      fileName: "drafted-task.yaml",
      timestamp: "2026-05-22T10:00:00.000Z",
    }],
  ]);
});

test("task source mutation service commits a drafted task source file", async () => {
  const calls = [];
  const service = createTaskSourceMutationService({
    repositoryDir: "repo",
    tasksDir: "repo/tasks",
    now: () => "2026-05-22T10:00:00.000Z",
    emitTaskChange: (event) => calls.push(["emitTaskChange", event]),
    commitTaskSource: async (input) => {
      calls.push(["commitTaskSource", input]);
      return {
        commitSha: "abc1234",
        fileName: input.fileName,
        message: "feat(tasks): 添加任务起草任务",
        path: "tasks/drafted-task.yaml",
      };
    },
  });

  assert.deepEqual(
    await service.commitTaskSourceFromDraft({ fileName: "drafted-task.yaml" }),
    {
      commitSha: "abc1234",
      fileName: "drafted-task.yaml",
      message: "feat(tasks): 添加任务起草任务",
      path: "tasks/drafted-task.yaml",
    },
  );
  assert.deepEqual(calls, [
    ["commitTaskSource", {
      repositoryDir: "repo",
      tasksDir: "repo/tasks",
      fileName: "drafted-task.yaml",
    }],
    ["emitTaskChange", {
      eventType: "commit-task-source",
      fileName: "drafted-task.yaml",
      commitSha: "abc1234",
      timestamp: "2026-05-22T10:00:00.000Z",
    }],
  ]);
});

test("commit task source file commits only the generated task path", async () => {
  const calls = [];
  const result = await commitTaskSourceFile({
    repositoryDir: "D:\\Project\\repo",
    tasksDir: "D:\\Project\\repo\\tasks",
    fileName: "drafted-task.yaml",
    runGitCommand: async (args, options) => {
      calls.push([args, options]);
      return args[0] === "rev-parse" ? "abc1234" : "";
    },
  });

  assert.deepEqual(result, {
    commitSha: "abc1234",
    fileName: "drafted-task.yaml",
    message: "feat(tasks): 添加任务起草任务",
    path: "tasks/drafted-task.yaml",
  });
  assert.deepEqual(calls, [
    [["add", "--", "tasks/drafted-task.yaml"], { cwd: "D:\\Project\\repo" }],
    [
      ["commit", "--only", "-m", "feat(tasks): 添加任务起草任务", "--", "tasks/drafted-task.yaml"],
      { cwd: "D:\\Project\\repo" },
    ],
    [["rev-parse", "HEAD"], { cwd: "D:\\Project\\repo" }],
  ]);
});

test("commit task source file rejects nested file names", async () => {
  await assert.rejects(
    () => commitTaskSourceFile({
      repositoryDir: "repo",
      tasksDir: "repo/tasks",
      fileName: "../secret.yaml",
      runGitCommand: async () => "",
    }),
    /plain file name/,
  );
});
