import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRuntimeSnapshot,
  runtimeSnapshotFromRepositoryStatus,
} from "../src/workflow/execution-admission-runtime.js";

test("execution admission runtime normalizes partial snapshots and repository status", () => {
  assert.deepEqual(normalizeRuntimeSnapshot({}), {
    activeWork: null,
    worktree: {
      clean: true,
      changedFiles: [],
    },
  });
  assert.deepEqual(
    runtimeSnapshotFromRepositoryStatus({
      clean: false,
      entries: [{ path: "public/app.js" }],
    }),
    {
      activeWork: null,
      worktree: {
        clean: false,
        changedFiles: ["public/app.js"],
      },
    },
  );
});
