import { buildValidationViewModel } from "./workflow-overview-validation-view-model.js";
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
