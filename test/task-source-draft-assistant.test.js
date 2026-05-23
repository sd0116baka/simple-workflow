import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import {
  buildTaskSourceDraftPrompt,
  createTaskSourceDraftAssistant,
  runOpencodeTaskSourceDraftAssistant,
  validateTaskSourceDraft,
} from "../src/workflow/task-source-draft-assistant.js";
import { createWorkflowService } from "../src/workflow/workflow-service.js";

test("task source draft prompt keeps discussion mode separate from finalization", () => {
  const prompt = buildTaskSourceDraftPrompt({
    basePrompt: "base instructions",
    mode: "discuss",
    messages: [
      { role: "user", content: "想做导入功能" },
      { role: "assistant", content: "需要确认文件格式。" },
    ],
    existingTasks: [
      {
        fileName: "task-001.yaml",
        parsed: { id: "task-001", title: "已有任务", type: "feature" },
        validation: { status: "valid" },
      },
    ],
  });

  assert.match(prompt, /base instructions/);
  assert.match(prompt, /"mode": "discuss"/);
  assert.match(prompt, /想做导入功能/);
  assert.match(prompt, /task-001.yaml/);
});

test("task source draft assistant returns discussion without task text before finalization", async () => {
  const assistant = createTaskSourceDraftAssistant({
    promptPath: "prompt.md",
    readPrompt: async () => "base prompt",
    listTasks: async () => [],
    runAssistant: async () => ({
      stdout: JSON.stringify({
        message: "先确认用户要导入 CSV 还是 JSON。",
        taskSourceText: "id: should-not-leak",
      }),
      stderr: "",
      exitCode: 0,
      error: null,
    }),
  });

  const result = await assistant.discussTaskSourceDraft({
    mode: "discuss",
    messages: [{ role: "user", content: "做导入" }],
  });

  assert.equal(result.assistantMessage, "先确认用户要导入 CSV 还是 JSON。");
  assert.equal(result.taskSourceText, null);
  assert.equal(result.validation.status, "empty");
});

test("task source draft assistant validates finalized YAML text", async () => {
  const taskSourceText = [
    "id: import-csv",
    "title: 导入 CSV",
    "type: feature",
    "priority: normal",
    "description: |",
    "  支持导入 CSV 任务数据。",
    "acceptance:",
    "  - 可以选择 CSV 文件",
  ].join("\n");
  const assistant = createTaskSourceDraftAssistant({
    promptPath: "prompt.md",
    readPrompt: async () => "base prompt",
    listTasks: async () => [],
    runAssistant: async () => ({
      stdout: JSON.stringify({
        message: "已经生成任务真源文本。",
        taskSourceText,
      }),
      stderr: "",
      exitCode: 0,
      error: null,
    }),
  });

  const result = await assistant.discussTaskSourceDraft({
    mode: "finalize",
    messages: [{ role: "user", content: "敲定" }],
  });

  assert.equal(result.assistantMessage, "已经生成任务真源文本。");
  assert.equal(result.taskSourceText, taskSourceText);
  assert.equal(result.validation.status, "valid");
  assert.equal(result.validation.parsed.id, "import-csv");
});

test("task source draft validation reports malformed YAML", () => {
  const validation = validateTaskSourceDraft("id: [");

  assert.equal(validation.status, "invalid");
  assert.match(validation.parseError, /YAML parse error/);
});

test("task source draft assistant runs opencode without a shell by default", async () => {
  const observed = {};

  await runOpencodeTaskSourceDraftAssistant({
    prompt: "起草任务",
    repositoryDir: "repo",
    runProcess: async (input) => {
      Object.assign(observed, input);
      return {
        stdout: JSON.stringify({ type: "message", text: "ok" }),
        stderr: "",
        exitCode: 0,
        error: null,
      };
    },
  });

  assert.equal(observed.shell, false);
  assert.equal(observed.prompt, "起草任务");
});

test("workflow service reads task draft prompt from app profile directory", async () => {
  const observed = {};
  const service = createWorkflowService({
    tasksDir: "tasks",
    repositoryDir: join(process.cwd(), ".tmp-test-repository"),
    promptProfileDir: join(process.cwd(), "project_profiles"),
    getRepositoryStatus: () => ({ clean: true }),
    runTaskSourceDraftAssistant: async ({ prompt, repositoryDir }) => {
      observed.prompt = prompt;
      observed.repositoryDir = repositoryDir;
      return {
        stdout: JSON.stringify({ message: "继续讨论。", taskSourceText: null }),
        stderr: "",
        exitCode: 0,
        error: null,
      };
    },
  });

  const result = await service.discussTaskSourceDraft({
    mode: "discuss",
    messages: [{ role: "user", content: "起草一个导入任务" }],
  });

  service.stopWatching();

  assert.equal(result.assistantMessage, "继续讨论。");
  assert.match(observed.prompt, /simple-workflow 的任务真源起草助手/);
  assert.equal(observed.repositoryDir, join(process.cwd(), ".tmp-test-repository"));
});
