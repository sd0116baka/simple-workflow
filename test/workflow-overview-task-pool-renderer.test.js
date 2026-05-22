import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTaskPoolOverview } from "../public/workflow-overview-task-pool-renderer.js";
import {
  createFakeDocument,
  FakeElement,
  findAll,
} from "./support/fake-dom.js";

test("workflow overview task pool renderer renders entries, raw text, and selection callback", () => {
  const selectedFiles = [];
  const taskPool = new FakeElement("div");
  const poolCount = new FakeElement("span");
  const taskPoolRaw = new FakeElement("pre");
  const taskPoolInputs = new FakeElement("div");

  const viewModel = renderTaskPoolOverview({
    documentRef: createFakeDocument(),
    onSelectTask: (fileName) => selectedFiles.push(fileName),
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

  assert.equal(viewModel.items.length, 1);
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

test("workflow overview task pool renderer renders empty state", () => {
  const taskPool = new FakeElement("div");
  const poolCount = new FakeElement("span");
  const taskPoolRaw = new FakeElement("pre");
  const taskPoolInputs = new FakeElement("div");

  const viewModel = renderTaskPoolOverview({
    documentRef: createFakeDocument(),
    onSelectTask: () => {},
    taskPool,
    poolCount,
    taskPoolRaw,
    taskPoolInputs,
    selectedFileName: null,
    tasks: [],
    poolEntries: [],
  });

  assert.equal(viewModel.emptyText, "还没有解析成功的任务进入任务池。");
  assert.equal(poolCount.textContent, "0 个条目");
  assert.match(taskPool.textContent, /还没有解析成功的任务进入任务池。/);
  assert.match(taskPoolRaw.textContent, /\[\]/);
});
