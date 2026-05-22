import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createStageTimelinePanel,
} from "../public/stage-timeline-panel-renderer.js";
import {
  createFakeDocument,
  findAll,
} from "./support/fake-dom.js";

test("stage timeline panel renderer creates nodes, connectors, and notes", () => {
  const panel = createStageTimelinePanel(createFakeDocument(), {
    nodes: [
      {
        className: "stage-timeline-node completed",
        indexText: "01",
        label: "执行",
        stage: "execution-agent",
        timestampText: "10:00",
        detail: "execution-agent:001",
      },
      {
        className: "stage-timeline-node current",
        indexText: "02",
        label: "审查",
        stage: "review-agent",
        timestampText: "10:01",
        detail: "review-agent:001",
      },
    ],
    transitions: [
      {
        className: "stage-timeline-connector completed",
        iconText: "->",
        label: "进入审查",
      },
    ],
    notes: ["人工意见已进入下一轮执行"],
  });

  assert.equal(panel.className, "stage-timeline-frame");
  assert.match(panel.textContent, /执行/);
  assert.match(panel.textContent, /审查/);
  assert.match(panel.textContent, /进入审查/);
  assert.match(panel.textContent, /人工意见已进入下一轮执行/);
  assert.equal(findAll(panel, (element) => element.className === "stage-timeline-track").length, 1);
  assert.equal(findAll(panel, (element) => element.className === "stage-timeline-notes").length, 1);
});

test("stage timeline panel renderer omits notes container when there are no notes", () => {
  const panel = createStageTimelinePanel(createFakeDocument(), {
    nodes: [],
    transitions: [],
    notes: [],
  });

  assert.equal(panel.className, "stage-timeline-frame");
  assert.equal(findAll(panel, (element) => element.className === "stage-timeline-track").length, 1);
  assert.equal(findAll(panel, (element) => element.className === "stage-timeline-notes").length, 0);
});
