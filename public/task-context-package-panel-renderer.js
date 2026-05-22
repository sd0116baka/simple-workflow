import { createElement } from "./dom-renderer-helpers.js";
import { buildTaskContextPackageViewModel } from "./task-context-package-view-model.js";

function appendRecordList(documentRef, panel, titleText, records) {
  if (records.length === 0) return;
  if (titleText) {
    panel.append(createElement(documentRef, "div", {
      className: "context-package-section-title",
      textContent: titleText,
    }));
  }

  const list = createElement(documentRef, "ul", { className: "context-package-records" });
  for (const record of records) {
    const item = createElement(documentRef, "li");
    item.append(
      createElement(documentRef, "strong", { textContent: record.id }),
      createElement(documentRef, "span", { textContent: record.timestamp ?? record.meta }),
      createElement(documentRef, "em", { textContent: record.summary ?? record.sessionId }),
    );
    list.append(item);
  }
  panel.append(list);
}

export function createTaskContextPackagePanel(documentRef, taskContextPackage) {
  const viewModel = buildTaskContextPackageViewModel(taskContextPackage);
  const panel = createElement(documentRef, "div", { className: viewModel.className });
  panel.append(
    createElement(documentRef, "div", {
      className: "context-package-title",
      textContent: viewModel.title,
    }),
    createElement(documentRef, "div", {
      className: "context-package-meta",
      textContent: viewModel.meta,
    }),
  );

  const artifacts = createElement(documentRef, "div", { className: "context-package-artifacts" });
  for (const status of viewModel.artifactStatuses) {
    artifacts.append(
      createElement(documentRef, "span", { textContent: status.label }),
      createElement(documentRef, "strong", { textContent: status.value }),
    );
  }
  panel.append(artifacts);
  appendRecordList(documentRef, panel, "", viewModel.artifactRecords);
  appendRecordList(documentRef, panel, "Agent 调用", viewModel.agentRuns);
  return panel;
}
