import { createElement } from "./dom-renderer-helpers.js";

export function renderValidationOverview({
  documentRef,
  validationResult,
  validationStatus,
  validation,
}) {
  const viewModel = buildValidationViewModel(validation);
  validationResult.replaceChildren();
  validationStatus.textContent = viewModel.statusText;
  if (viewModel.emptyText) {
    validationResult.textContent = viewModel.emptyText;
    return viewModel;
  }

  const summary = createElement(documentRef, "div", {
    className: viewModel.summary.className,
    textContent: viewModel.summary.text,
  });
  if (viewModel.errors.length === 0) {
    validationResult.append(summary);
    return viewModel;
  }

  const list = createElement(documentRef, "ul", { className: "validation-errors" });
  for (const error of viewModel.errors) {
    list.append(createElement(documentRef, "li", { textContent: error }));
  }
  validationResult.append(summary, list);
  return viewModel;
}

export function buildValidationViewModel(validation = null) {
  if (!validation) {
    return {
      statusText: "未校验",
      emptyText: "未返回校验结果。",
      summary: null,
      errors: [],
    };
  }

  if (validation.status === "valid") {
    return {
      statusText: "校验通过",
      emptyText: null,
      summary: {
        className: "validation-summary valid",
        text: "该任务满足进入后续流程的最小字段要求。",
      },
      errors: [],
    };
  }

  return {
    statusText: "校验未通过",
    emptyText: null,
    summary: {
      className: `validation-summary ${validation.status}`,
      text: "该任务暂时不能进入下一阶段。",
    },
    errors: validation.errors ?? [],
  };
}
