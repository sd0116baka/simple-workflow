import {
  appendTextItems,
  createElement,
} from "./dom-renderer-helpers.js";
import {
  buildAutoMergeExecutionViewModel,
  buildAutoMergePlanningViewModel,
  buildTaskCloseoutViewModel,
} from "./auto-merge-panel-view-model.js";

export function createAutoMergeListPanel(documentRef, viewModel) {
  if (!viewModel) return null;

  const panel = createElement(documentRef, "div", { className: viewModel.className });
  panel.append(
    createElement(documentRef, "div", {
      className: "auto-merge-title",
      textContent: viewModel.title,
    }),
    createElement(documentRef, "div", {
      className: "auto-merge-meta",
      textContent: viewModel.meta,
    }),
  );
  appendTextItems(documentRef, panel, "ul", "auto-merge-list", viewModel.listItems);
  return panel;
}

export function createAutoMergePanel(documentRef, taskContextPackage) {
  return createAutoMergeListPanel(
    documentRef,
    buildAutoMergePlanningViewModel(taskContextPackage),
  );
}

export function createAutoMergeExecutionPanel(documentRef, taskContextPackage) {
  return createAutoMergeListPanel(
    documentRef,
    buildAutoMergeExecutionViewModel(taskContextPackage),
  );
}

export function createTaskCloseoutPanel(documentRef, taskContextPackage) {
  return createAutoMergeListPanel(
    documentRef,
    buildTaskCloseoutViewModel(taskContextPackage),
  );
}
