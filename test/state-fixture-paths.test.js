import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fixtureBranchName,
  fixtureWorktreePath,
  isStubPackage,
  needsFixtureWorktree,
  packageIdFor,
  sourcePathFor,
} from "../src/workflow/state-fixture-paths.js";

test("state fixture paths derive package, source, worktree, and branch names", () => {
  assert.equal(packageIdFor("stub-human-guided-execution.yaml"), "task-context-package:tasks/stub-human-guided-execution.yaml");
  assert.equal(sourcePathFor("stub-human-guided-execution"), "tasks/stub-human-guided-execution.yaml");
  assert.equal(fixtureWorktreePath("stub-human-guided-execution"), ".workflow/worktrees/tasks/stub-human-guided-execution");
  assert.equal(fixtureBranchName("stub-human-guided-execution"), "workflow/tasks/stub-human-guided-execution");
});

test("state fixture paths decide worktree eligibility by formal stage", () => {
  assert.equal(needsFixtureWorktree({ currentWorkStage: "task-pool" }), false);
  assert.equal(needsFixtureWorktree({ currentWorkStage: "execution-agent" }), true);
  assert.equal(needsFixtureWorktree({ currentWorkStage: "closed" }), false);
});

test("state fixture paths identify generated stub packages", () => {
  assert.equal(isStubPackage({ source: { path: "tasks/stub-review-agent.yaml" } }), true);
  assert.equal(isStubPackage({ source: { path: "tasks/real-task.yaml" } }), false);
});
