import { test } from "node:test";
import assert from "node:assert/strict";
import { renderValidationOverview } from "../public/workflow-overview-validation-renderer.js";
import {
  createFakeDocument,
  FakeElement,
  findAll,
} from "./support/fake-dom.js";

test("workflow overview validation renderer renders invalid validation errors", () => {
  const validationResult = new FakeElement("div");
  const validationStatus = new FakeElement("span");

  const viewModel = renderValidationOverview({
    documentRef: createFakeDocument(),
    validationResult,
    validationStatus,
    validation: { status: "invalid", errors: ["缺少 name", "缺少 goal"] },
  });

  assert.equal(viewModel.statusText, "校验未通过");
  assert.equal(validationStatus.textContent, "校验未通过");
  assert.match(validationResult.textContent, /该任务暂时不能进入下一阶段。/);
  assert.match(validationResult.textContent, /缺少 name/);
  assert.match(validationResult.textContent, /缺少 goal/);
  assert.equal(findAll(
    validationResult,
    (element) => element.className === "validation-errors",
  ).length, 1);
});

test("workflow overview validation renderer renders valid and empty states", () => {
  const documentRef = createFakeDocument();
  const validationResult = new FakeElement("div");
  const validationStatus = new FakeElement("span");

  renderValidationOverview({
    documentRef,
    validationResult,
    validationStatus,
    validation: { status: "valid", errors: [] },
  });
  assert.equal(validationStatus.textContent, "校验通过");
  assert.match(validationResult.textContent, /该任务满足进入后续流程的最小字段要求。/);

  renderValidationOverview({
    documentRef,
    validationResult,
    validationStatus,
    validation: null,
  });
  assert.equal(validationStatus.textContent, "未校验");
  assert.equal(validationResult.textContent, "未返回校验结果。");
});
