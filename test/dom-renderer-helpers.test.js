import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendEmptyState,
  appendTextItems,
  createElement,
  renderInputs,
} from "../public/dom-renderer-helpers.js";
import {
  createFakeDocument,
  FakeElement,
} from "./support/fake-dom.js";

test("dom renderer helpers create elements with class and text", () => {
  const element = createElement(createFakeDocument(), "span", {
    className: "status",
    textContent: "ready",
  });

  assert.equal(element.tagName, "span");
  assert.equal(element.className, "status");
  assert.equal(element.textContent, "ready");
});

test("dom renderer helpers append text lists and empty states", () => {
  const documentRef = createFakeDocument();
  const container = new FakeElement("div");

  const list = appendTextItems(documentRef, container, "ul", "items", ["a", "b"]);
  const empty = appendEmptyState(documentRef, container, "暂无数据");

  assert.equal(list.className, "items");
  assert.equal(list.textContent, "ab");
  assert.equal(empty.className, "empty-state");
  assert.match(container.textContent, /ab暂无数据/);
  assert.equal(appendTextItems(documentRef, container, "ul", "items", []), null);
});

test("dom renderer helpers render input summary lists", () => {
  const documentRef = createFakeDocument();
  const container = new FakeElement("div");
  container.textContent = "old";

  const list = renderInputs(documentRef, container, [
    { label: "当前选择", value: "task-001.yaml" },
    { label: "任务池", value: "1 个条目" },
  ]);

  assert.equal(list.className, "stage-input-list");
  assert.equal(container.textContent, "当前选择task-001.yaml任务池1 个条目");
  assert.equal(container.children.length, 1);
});
