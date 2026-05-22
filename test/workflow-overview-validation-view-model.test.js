import { test } from "node:test";
import assert from "node:assert/strict";
import { buildValidationViewModel } from "../public/workflow-overview-validation-renderer.js";

test("overview validation view model renders empty validation state", () => {
  assert.deepEqual(buildValidationViewModel(null), {
    statusText: "未校验",
    emptyText: "未返回校验结果。",
    summary: null,
    errors: [],
  });
});

test("overview validation view model renders valid state", () => {
  assert.deepEqual(buildValidationViewModel({ status: "valid" }), {
    statusText: "校验通过",
    emptyText: null,
    summary: {
      className: "validation-summary valid",
      text: "该任务满足进入后续流程的最小字段要求。",
    },
    errors: [],
  });
});

test("overview validation view model renders invalid errors", () => {
  assert.deepEqual(buildValidationViewModel({
    status: "invalid",
    errors: ["缺少 title"],
  }), {
    statusText: "校验未通过",
    emptyText: null,
    summary: {
      className: "validation-summary invalid",
      text: "该任务暂时不能进入下一阶段。",
    },
    errors: ["缺少 title"],
  });
});
