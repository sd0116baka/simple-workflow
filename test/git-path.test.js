import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePathForGit } from "../src/workflow/git-path.js";

test("normalizes Windows path separators for git arguments and artifacts", () => {
  assert.equal(normalizePathForGit("C:\\repo\\.workflow\\worktrees\\task"), "C:/repo/.workflow/worktrees/task");
  assert.equal(normalizePathForGit("tasks/task-001.yaml"), "tasks/task-001.yaml");
});
