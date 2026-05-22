import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTaskSourceOverview } from "../public/workflow-overview-task-source-renderer.js";
import {
  createFakeDocument,
  FakeElement,
  findAll,
} from "./support/fake-dom.js";

test("workflow overview task source renderer renders task buttons and selection callback", () => {
  const selectedFiles = [];
  const taskList = new FakeElement("div");
  const taskCount = new FakeElement("span");
  const taskSourceInputs = new FakeElement("div");

  const viewModel = renderTaskSourceOverview({
    documentRef: createFakeDocument(),
    onSelectTask: (fileName) => selectedFiles.push(fileName),
    taskList,
    taskCount,
    taskSourceInputs,
    selectedFileName: "task-002.yaml",
    tasks: [
      { fileName: "task-001.yaml", format: "yaml" },
      { fileName: "task-002.yaml", format: "yaml" },
    ],
  });

  assert.equal(viewModel.items.length, 2);
  assert.equal(taskCount.textContent, "2 个文件");
  assert.match(taskSourceInputs.textContent, /当前选择task-002.yaml/);
  const buttons = findAll(taskList, (element) => element.tagName === "button");
  assert.equal(buttons.length, 2);
  assert.equal(buttons[1].className, "task-item active");
  assert.match(buttons[0].textContent, /task-001.yamlyaml/);
  buttons[0].click();
  assert.deepEqual(selectedFiles, ["task-001.yaml"]);
});

test("workflow overview task source renderer renders empty state", () => {
  const taskList = new FakeElement("div");
  const taskCount = new FakeElement("span");
  const taskSourceInputs = new FakeElement("div");

  const viewModel = renderTaskSourceOverview({
    documentRef: createFakeDocument(),
    onSelectTask: () => {},
    taskList,
    taskCount,
    taskSourceInputs,
    selectedFileName: null,
    tasks: [],
  });

  assert.equal(viewModel.emptyText, "tasks/ 目录下还没有 .yaml 或 .yml 文件。");
  assert.equal(taskCount.textContent, "0 个文件");
  assert.match(taskList.textContent, /tasks\/ 目录下还没有 \.yaml 或 \.yml 文件。/);
});
