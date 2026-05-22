import { buildStartupCheckViewModel } from "./workflow-overview-startup-check-view-model.js";
import {
  createElement,
  renderInputs,
} from "./dom-renderer-helpers.js";

export function renderStartupCheckOverview({
  documentRef,
  startupCheckPanel,
  startupCheckRaw,
  startupCheckInputs,
  startupCheckStatus,
  startupCheck,
}) {
  const viewModel = buildStartupCheckViewModel(startupCheck);
  startupCheckPanel.replaceChildren();
  startupCheckRaw.textContent = viewModel.rawText;
  renderInputs(documentRef, startupCheckInputs, viewModel.inputs);
  startupCheckStatus.textContent = viewModel.statusText;
  if (viewModel.emptyText) {
    startupCheckPanel.textContent = viewModel.emptyText;
    return viewModel;
  }

  startupCheckPanel.append(createElement(documentRef, "div", {
    className: viewModel.summary.className,
    textContent: viewModel.summary.text,
  }));

  for (const metric of viewModel.metrics) {
    const element = createElement(documentRef, "div", { className: "startup-check-metric" });
    element.append(
      createElement(documentRef, "span", { textContent: metric.label }),
      createElement(documentRef, "strong", { textContent: metric.value }),
    );
    startupCheckPanel.append(element);
  }

  if (viewModel.findings.length > 0) {
    const list = createElement(documentRef, "ul", { className: "startup-check-list" });
    for (const finding of viewModel.findings) {
      list.append(createElement(documentRef, "li", { textContent: finding }));
    }
    startupCheckPanel.append(list);
  }

  if (viewModel.changedFiles.length > 0) {
    const list = createElement(documentRef, "ul", {
      className: "startup-check-list git-list",
    });
    for (const filePath of viewModel.changedFiles) {
      list.append(createElement(documentRef, "li", { textContent: filePath }));
    }
    startupCheckPanel.append(list);
  }
  return viewModel;
}
