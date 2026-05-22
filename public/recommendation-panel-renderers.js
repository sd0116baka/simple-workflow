import {
  appendTextItems,
  createElement,
} from "./dom-renderer-helpers.js";

export function createIntentPanel(documentRef, intent) {
  const panel = createElement(documentRef, "div", { className: "recommendation-intent" });
  panel.append(
    createElement(documentRef, "div", {
      className: "recommendation-intent-title",
      textContent: intent.recommendedPackageId,
    }),
    createElement(documentRef, "div", {
      className: "recommendation-intent-meta",
      textContent: `推荐置信度：${intent.confidence}`,
    }),
    createElement(documentRef, "div", {
      className: "recommendation-intent-next",
      textContent: intent.executionBrief?.goalInterpretation ?? "",
    }),
  );

  appendTextItems(
    documentRef,
    panel,
    "ul",
    "recommendation-intent-list",
    intent.selectionReasoning ?? [],
  );

  if (intent.candidateComparison?.length > 0) {
    panel.append(createElement(documentRef, "div", {
      className: "recommendation-observed",
      textContent: `candidateComparison: ${intent.candidateComparison
        .map((item) => `${item.packageId}:${item.decision}`)
        .join(", ")}`,
    }));
  }

  return panel;
}

export function createAdmissionPanel(documentRef, admission) {
  const appendRequest = admission.appendRequest;
  const artifactType = appendRequest?.artifactType ?? "unknown";
  const panel = createElement(documentRef, "div", {
    className: `admission-panel ${artifactType}`,
  });
  panel.append(
    createElement(documentRef, "div", {
      className: "admission-title",
      textContent: artifactType === "executionAuthorization"
        ? `已授权执行：${appendRequest.packageId}`
        : `未授权执行：${appendRequest?.packageId ?? "无任务"}`,
    }),
    createElement(documentRef, "div", {
      className: "admission-meta",
      textContent: `artifactType: ${artifactType}`,
    }),
  );

  appendTextItems(
    documentRef,
    panel,
    "ul",
    "admission-reasons",
    (appendRequest?.artifact?.findings ?? [])
      .map((finding) => `${finding.code}: ${finding.message}`),
  );

  return panel;
}
