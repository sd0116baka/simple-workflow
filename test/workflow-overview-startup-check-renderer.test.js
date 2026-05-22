import { test } from "node:test";
import assert from "node:assert/strict";
import { renderStartupCheckOverview } from "../public/workflow-overview-startup-check-renderer.js";
import {
  createFakeDocument,
  FakeElement,
  findAll,
} from "./support/fake-dom.js";

function createTargets() {
  return {
    startupCheckPanel: new FakeElement("div"),
    startupCheckRaw: new FakeElement("pre"),
    startupCheckInputs: new FakeElement("div"),
    startupCheckStatus: new FakeElement("span"),
  };
}

test("workflow overview startup check renderer renders findings, metrics, and changed files", () => {
  const targets = createTargets();

  const viewModel = renderStartupCheckOverview({
    documentRef: createFakeDocument(),
    ...targets,
    startupCheck: {
      canStartWork: false,
      findings: [{ code: "WORKTREE_DIRTY", message: "工作区有未提交变更" }],
      runtimeSnapshot: {
        activeWork: { packageId: "task-context-package:tasks/task-001.yaml" },
        worktree: {
          clean: false,
          changedFiles: ["a.txt", "b.txt"],
        },
      },
    },
  });

  assert.equal(viewModel.statusText, "不可启动");
  assert.equal(targets.startupCheckStatus.textContent, "不可启动");
  assert.match(targets.startupCheckRaw.textContent, /WORKTREE_DIRTY/);
  assert.match(targets.startupCheckInputs.textContent, /activeWork/);
  assert.match(targets.startupCheckPanel.textContent, /当前不能启动新任务。/);
  assert.match(targets.startupCheckPanel.textContent, /工作区有未提交变更/);
  assert.match(targets.startupCheckPanel.textContent, /a.txt/);
  assert.equal(findAll(
    targets.startupCheckPanel,
    (element) => element.className === "startup-check-list git-list",
  ).length, 1);
});

test("workflow overview startup check renderer renders empty state", () => {
  const targets = createTargets();

  const viewModel = renderStartupCheckOverview({
    documentRef: createFakeDocument(),
    ...targets,
    startupCheck: null,
  });

  assert.equal(viewModel.emptyText, "未返回启动检查。");
  assert.equal(targets.startupCheckStatus.textContent, "未载入");
  assert.equal(targets.startupCheckPanel.textContent, "未返回启动检查。");
});
