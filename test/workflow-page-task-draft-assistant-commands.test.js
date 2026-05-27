import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageTaskDraftAssistantCommands } from "../public/workflow-page-task-draft-assistant-commands.js";

class FakeElement {
  constructor({ value = "", textContent = "" } = {}) {
    this.children = [];
    this.dataset = {};
    this.disabled = false;
    this.scrollHeight = 0;
    this.scrollTop = 0;
    this.textContent = textContent;
    this.value = value;
    this.ownerDocument = {
      createElement: () => new FakeElement(),
    };
  }

  append(child) {
    this.children.push(child);
  }

  replaceChildren() {
    this.children = [];
  }
}

function createHarness() {
  const calls = [];
  const taskSourceText = [
    "id: drafted-task",
    "title: 起草任务",
    "type: feature",
    "description: 测试",
    "acceptance:",
    "  - 通过",
  ].join("\n");
  const elements = {
    taskDraftInput: new FakeElement({ value: "敲定" }),
    taskDraftFinalizeButton: new FakeElement({ textContent: "生成任务真源文本" }),
    taskDraftCreateButton: new FakeElement({ textContent: "加入任务池" }),
    taskDraftMessages: new FakeElement(),
    taskDraftOutput: new FakeElement(),
    taskDraftStatus: new FakeElement(),
    taskDraftValidation: new FakeElement(),
  };
  const commands = createWorkflowPageTaskDraftAssistantCommands({
    elements,
    workflowApi: {
      async discussTaskSourceDraft(input) {
        calls.push(["discussTaskSourceDraft", structuredClone(input)]);
        return {
          taskDraft: {
            assistantMessage: "已生成。",
            taskSourceText,
            validation: { status: "valid", errors: [] },
          },
        };
      },
      async createTaskSourceFromDraft(input) {
        calls.push(["createTaskSourceFromDraft", input]);
        return { taskSource: { fileName: "drafted-task.yaml" } };
      },
    },
    refreshPage: async () => calls.push(["refreshPage"]),
  });
  return { calls, commands, elements, taskSourceText };
}

test("task draft commands enable creation after valid finalized text", async () => {
  const { calls, commands, elements, taskSourceText } = createHarness();

  await commands.finalizeTaskDraft();
  assert.equal(elements.taskDraftOutput.textContent, taskSourceText);
  assert.equal(elements.taskDraftValidation.textContent, "YAML 校验通过");
  assert.equal(elements.taskDraftCreateButton.disabled, false);

  await commands.createTaskSourceFromDraft();
  assert.equal(elements.taskDraftCreateButton.disabled, true);
  assert.equal(elements.taskDraftStatus.textContent, "已加入 drafted-task.yaml");
  assert.deepEqual(calls, [
    ["discussTaskSourceDraft", {
      mode: "finalize",
      messages: [{ role: "user", content: "敲定" }],
    }],
    ["createTaskSourceFromDraft", { taskSourceText }],
    ["refreshPage"],
  ]);
});

test("task draft commands skip creation before a valid draft exists", async () => {
  const { calls, commands } = createHarness();

  assert.deepEqual(await commands.createTaskSourceFromDraft(), {
    ok: false,
    skipped: true,
  });
  assert.deepEqual(calls, []);
});

test("task draft commands surface finalize errors without enabling creation", async () => {
  const { elements } = createHarness();
  elements.taskDraftInput.value = "敲定";
  const errorCommands = createWorkflowPageTaskDraftAssistantCommands({
    elements,
    workflowApi: {
      async discussTaskSourceDraft() {
        return {
          taskDraft: {
            assistantMessage: "任务起草助手运行失败：unknown certificate verification error",
            taskSourceText: null,
            validation: { status: "empty", errors: [] },
            error: { data: { message: "unknown certificate verification error" } },
          },
        };
      },
      async createTaskSourceFromDraft() {
        throw new Error("should not create");
      },
    },
  });

  await errorCommands.finalizeTaskDraft();

  assert.equal(elements.taskDraftStatus.textContent, "失败");
  assert.match(elements.taskDraftValidation.textContent, /unknown certificate verification error/);
  assert.equal(elements.taskDraftCreateButton.disabled, true);
});
