import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderMissingTaskSelectionOverview,
  renderSelectedTaskOverview,
} from "../public/workflow-overview-selected-task-renderer.js";
import { FakeElement } from "./support/fake-dom.js";

function createSelectedTaskTargets() {
  return {
    selectedTitle: new FakeElement("span"),
    selectedMeta: new FakeElement("span"),
    rawText: new FakeElement("pre"),
    parsedText: new FakeElement("pre"),
    parseStatus: new FakeElement("span"),
    validationResult: new FakeElement("pre"),
    validationStatus: new FakeElement("span"),
  };
}

test("workflow overview selected task renderer writes selected task details", () => {
  const targets = createSelectedTaskTargets();

  const viewModel = renderSelectedTaskOverview({
    ...targets,
    task: {
      fileName: "task-001.yaml",
      format: "yaml",
      rawText: "name: 测试任务",
    },
  });

  assert.equal(viewModel.title, "task-001.yaml");
  assert.equal(targets.selectedTitle.textContent, "task-001.yaml");
  assert.equal(targets.selectedMeta.textContent, "YAML 任务真源");
  assert.equal(targets.rawText.textContent, "name: 测试任务");
  assert.equal(targets.parseStatus.textContent, "原始文本");
  assert.equal(targets.parsedText.textContent, "");
  assert.equal(targets.validationResult.textContent, "");
  assert.equal(targets.validationStatus.textContent, "未展示");
});

test("workflow overview selected task renderer writes missing task state", () => {
  const targets = createSelectedTaskTargets();

  const viewModel = renderMissingTaskSelectionOverview(targets);

  assert.equal(viewModel.title, "未发现任务");
  assert.equal(targets.selectedTitle.textContent, "未发现任务");
  assert.equal(targets.selectedMeta.textContent, "在 tasks/ 目录添加 YAML 文件后刷新。");
  assert.equal(targets.rawText.textContent, "");
  assert.equal(targets.parseStatus.textContent, "无任务");
  assert.equal(targets.parsedText.textContent, "");
  assert.equal(targets.validationResult.textContent, "");
  assert.equal(targets.validationStatus.textContent, "无任务");
});

test("workflow overview selected task renderer tolerates optional detail targets", () => {
  const selectedTitle = new FakeElement("span");
  const selectedMeta = new FakeElement("span");
  const rawText = new FakeElement("pre");
  const parseStatus = new FakeElement("span");

  renderSelectedTaskOverview({
    selectedTitle,
    selectedMeta,
    rawText,
    parseStatus,
    task: {
      fileName: "task-002.yml",
      format: "yml",
      rawText: "",
    },
  });

  assert.equal(selectedTitle.textContent, "task-002.yml");
  assert.equal(rawText.textContent, "(空文件)");
  assert.equal(parseStatus.textContent, "原始文本");

  renderMissingTaskSelectionOverview({
    selectedTitle,
    selectedMeta,
    rawText,
    parseStatus,
  });

  assert.equal(selectedTitle.textContent, "未发现任务");
  assert.equal(parseStatus.textContent, "无任务");
});
