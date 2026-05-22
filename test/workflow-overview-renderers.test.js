import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowOverviewRenderers } from "../public/workflow-overview-renderers.js";
import {
  createFakeDocument,
  FakeElement,
  findAll,
} from "./support/fake-dom.js";

function createRenderers() {
  const selectedFiles = [];
  return {
    selectedFiles,
    renderers: createWorkflowOverviewRenderers({
      documentRef: createFakeDocument(),
      onSelectTask: (fileName) => {
        selectedFiles.push(fileName);
      },
    }),
  };
}

test("workflow overview renderers render task source buttons and selection callback", () => {
  const { renderers, selectedFiles } = createRenderers();
  const taskList = new FakeElement("div");
  const taskCount = new FakeElement("span");
  const taskSourceInputs = new FakeElement("div");

  renderers.renderTaskSource({
    taskList,
    taskCount,
    taskSourceInputs,
    selectedFileName: "task-002.yaml",
    tasks: [
      { fileName: "task-001.yaml", format: "yaml" },
      { fileName: "task-002.yaml", format: "yaml" },
    ],
  });

  assert.equal(taskCount.textContent, "2 个文件");
  assert.match(taskSourceInputs.textContent, /当前选择task-002.yaml/);
  const buttons = findAll(taskList, (element) => element.tagName === "button");
  assert.equal(buttons.length, 2);
  assert.equal(buttons[1].className, "task-item active");
  assert.match(buttons[0].textContent, /task-001.yamlyaml/);
  buttons[0].click();
  assert.deepEqual(selectedFiles, ["task-001.yaml"]);
});

test("workflow overview renderers render task pool entries and raw text", () => {
  const { renderers, selectedFiles } = createRenderers();
  const taskPool = new FakeElement("div");
  const poolCount = new FakeElement("span");
  const taskPoolRaw = new FakeElement("pre");
  const taskPoolInputs = new FakeElement("div");

  renderers.renderTaskPool({
    taskPool,
    poolCount,
    taskPoolRaw,
    taskPoolInputs,
    selectedFileName: "task-001.yaml",
    tasks: [{ fileName: "task-001.yaml" }],
    poolEntries: [
      {
        sourceFile: "task-001.yaml",
        title: "测试任务",
        type: "feature",
        status: "ready",
      },
    ],
  });

  assert.equal(poolCount.textContent, "1 个条目");
  assert.match(taskPoolRaw.textContent, /"sourceFile": "task-001.yaml"/);
  assert.match(taskPoolInputs.textContent, /过滤规则/);
  const buttons = findAll(taskPool, (element) => element.tagName === "button");
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].className, "pool-item ready active");
  assert.match(buttons[0].textContent, /测试任务task-001.yaml · featureready/);
  buttons[0].click();
  assert.deepEqual(selectedFiles, ["task-001.yaml"]);
});

test("workflow overview renderers render startup check details and validation states", () => {
  const { renderers } = createRenderers();
  const startupCheckPanel = new FakeElement("div");
  const startupCheckRaw = new FakeElement("pre");
  const startupCheckInputs = new FakeElement("div");
  const startupCheckStatus = new FakeElement("span");

  renderers.renderStartupCheck({
    startupCheckPanel,
    startupCheckRaw,
    startupCheckInputs,
    startupCheckStatus,
    startupCheck: {
      canStartWork: false,
      findings: [{ code: "WORKTREE_DIRTY", message: "工作区有未提交变更" }],
      runtimeSnapshot: {
        activeWork: { packageId: "task-context-package:tasks/task-001.yaml" },
        worktree: {
          clean: false,
          changedFiles: ["a.txt", "b.txt"],
        },
      },
    },
  });

  assert.equal(startupCheckStatus.textContent, "不可启动");
  assert.match(startupCheckRaw.textContent, /WORKTREE_DIRTY/);
  assert.match(startupCheckPanel.textContent, /当前不能启动新任务。/);
  assert.match(startupCheckPanel.textContent, /a.txt/);

  const validationResult = new FakeElement("div");
  const validationStatus = new FakeElement("span");
  renderers.renderValidation({
    validationResult,
    validationStatus,
    validation: { status: "invalid", errors: ["缺少 name"] },
  });

  assert.equal(validationStatus.textContent, "校验未通过");
  assert.match(validationResult.textContent, /该任务暂时不能进入下一阶段。/);
  assert.match(validationResult.textContent, /缺少 name/);
});

test("workflow overview renderers render selected and missing task details", () => {
  const { renderers } = createRenderers();
  const elements = {
    selectedTitle: new FakeElement("span"),
    selectedMeta: new FakeElement("span"),
    rawText: new FakeElement("pre"),
    parsedText: new FakeElement("pre"),
    parseStatus: new FakeElement("span"),
    validationResult: new FakeElement("pre"),
    validationStatus: new FakeElement("span"),
  };

  renderers.renderSelectedTask({
    ...elements,
    task: {
      fileName: "task-001.yaml",
      format: "yaml",
      rawText: "name: 测试任务",
    },
  });

  assert.equal(elements.selectedTitle.textContent, "task-001.yaml");
  assert.equal(elements.selectedMeta.textContent, "YAML 任务真源");
  assert.equal(elements.rawText.textContent, "name: 测试任务");

  renderers.renderMissingTaskSelection(elements);
  assert.equal(elements.selectedTitle.textContent, "未发现任务");
  assert.equal(elements.parseStatus.textContent, "无任务");
  assert.equal(elements.validationStatus.textContent, "无任务");
});
