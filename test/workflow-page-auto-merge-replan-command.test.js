import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowPageAutoMergeReplanCommand } from "../public/workflow-page-auto-merge-replan-command.js";

function createActionButton() {
  return {
    dataset: {},
    disabled: false,
    textContent: "",
    closest() {
      return {
        querySelector() {
          return { textContent: "" };
        },
      };
    },
  };
}

test("workflow page auto merge replan command syncs the latest run", async () => {
  const calls = [];
  const workflowApi = {
    async replanAutoMerge(payload) {
      calls.push(["replanAutoMerge", payload]);
      return { recommendationRun: { id: "manual-run:replan" } };
    },
  };
  const command = createWorkflowPageAutoMergeReplanCommand({
    workflowApi,
    activeTaskContextPackage: () => ({
      packageId: "task-context-package:tasks/task-001.yaml",
    }),
    setRecommendationRun: (run, options) =>
      calls.push(["setRecommendationRun", run, options]),
    renderRecommendationRun: () => calls.push(["renderRecommendationRun"]),
    loadTasks: async () => calls.push(["loadTasks"]),
    pageStatus: {
      setAutoMergeStatus: (text) => calls.push(["setAutoMergeStatus", text]),
    },
  });

  const result = await command.replanAutoMerge(createActionButton());

  assert.equal(result.ok, true);
  assert.deepEqual(calls, [
    ["setAutoMergeStatus", "规划中"],
    ["replanAutoMerge", { packageId: "task-context-package:tasks/task-001.yaml" }],
    ["setRecommendationRun", { id: "manual-run:replan" }, { syncTaskPackage: true }],
    ["renderRecommendationRun"],
    ["loadTasks"],
  ]);
});
