import {
  createElement,
} from "./dom-renderer-helpers.js";

export function createStageTimelinePanel(documentRef, viewModel) {
  const panel = createElement(documentRef, "div", { className: "stage-timeline-frame" });
  const track = createElement(documentRef, "div", { className: "stage-timeline-track" });

  viewModel.nodes.forEach((node, index) => {
    const item = createElement(documentRef, "div", { className: node.className });
    item.append(
      createElement(documentRef, "span", { textContent: node.indexText }),
      createElement(documentRef, "strong", { textContent: node.label }),
      createElement(documentRef, "small", { textContent: node.stage }),
      createElement(documentRef, "time", { textContent: node.timestampText }),
      createElement(documentRef, "em", { textContent: node.detail }),
    );
    track.append(item);

    const transition = viewModel.transitions[index];
    if (transition) {
      const connector = createElement(documentRef, "div", { className: transition.className });
      connector.append(
        createElement(documentRef, "span", { textContent: transition.iconText }),
        createElement(documentRef, "em", { textContent: transition.label }),
      );
      track.append(connector);
    }
  });

  panel.append(track);

  if (viewModel.notes.length > 0) {
    const notes = createElement(documentRef, "div", { className: "stage-timeline-notes" });
    for (const note of viewModel.notes) {
      notes.append(createElement(documentRef, "span", { textContent: note }));
    }
    panel.append(notes);
  }

  return panel;
}
