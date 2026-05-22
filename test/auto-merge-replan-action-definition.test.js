import { test } from "node:test";
import assert from "node:assert/strict";
import { createAutoMergeReplanActionDefinition } from "../src/workflow/auto-merge-replan-action-definition.js";

function createDefinition(overrides = {}) {
  const replanAutoMerge = createAutoMergeReplanActionDefinition({
    repositoryDir: "repo",
    findAutoMergePlannablePackage: async () => null,
    applyAppendRequest: async () => null,
    replanAutoMergeAction: async () => ({ shouldEmit: false }),
    ...overrides,
  });

  return replanAutoMerge({
    packageId: "task-context-package:tasks/task-001.yaml",
  });
}

test("replan action definition rejects packages that already have closeout", () => {
  const definition = createDefinition();

  assert.equal(definition.packageId, "task-context-package:tasks/task-001.yaml");
  assert.deepEqual(definition.unavailableResponse, { planned: false });
  assert.equal(
    definition.isUnavailable({
      artifacts: {
        taskCloseout: {
          body: { status: "closed" },
        },
      },
    }),
    true,
  );
  assert.equal(
    definition.isUnavailable({
      artifacts: {
        taskCloseout: [
          {
            body: { status: "closed" },
          },
        ],
      },
    }),
    false,
  );
});

test("replan action definition injects recommendation run and append adapter", async () => {
  const recommendationRun = { id: "manual-workflow-action" };
  const applyAppendRequest = async () => "append";
  let actionArgs = null;
  const definition = createDefinition({
    applyAppendRequest,
    replanAutoMergeAction: async (args) => {
      actionArgs = args;
      return {
        shouldEmit: true,
        response: { planned: true },
      };
    },
  });

  const result = await definition.run({ recommendationRun });

  assert.deepEqual(result.response, { planned: true });
  assert.equal(actionArgs.recommendationRun, recommendationRun);
  assert.equal(actionArgs.repositoryDir, "repo");
  assert.equal(actionArgs.applyAppendRequest, applyAppendRequest);
});
