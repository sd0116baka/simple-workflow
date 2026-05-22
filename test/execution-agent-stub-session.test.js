import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { runStubExecutionAgentSession } from "../src/workflow/execution-agent-stub-session.js";
import {
  createArtifactRecordFixture,
  createTaskContextPackageFixture,
} from "./support/task-context-package-fixtures.js";

function taskPackage() {
  return createTaskContextPackageFixture({
    packageId: "task-context-package:tasks/task-003.yaml",
    taskDraft: {
      id: "task-003",
    },
    artifacts: {
      isolatedWorkspace: createArtifactRecordFixture("isolatedWorkspace", {
        baseCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }),
    },
  });
}

test("stub execution session writes a deterministic probe file", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "simple-workflow-execution-stub-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));

  const session = runStubExecutionAgentSession({
    role: "execution",
    packageId: "task-context-package:tasks/task-003.yaml",
    cwd,
    runId: "execution-agent:001",
    taskContextPackage: taskPackage(),
    inputArtifactRefs: ["taskDraft", "executionIntent", "isolatedWorkspace"],
  });

  const probePath = join(cwd, ".workflow-agent", "task-003", "aaaaaaaaaaaa", "execution-agent-001.txt");
  const probe = await readFile(probePath, "utf8");

  assert.equal(session.sessionId, "stub-execution-session:task-context-package:tasks/task-003.yaml");
  assert.deepEqual(session.notes, [
    "execution agent stub 已在隔离工作树写入 .workflow-agent/task-003/aaaaaaaaaaaa/execution-agent-001.txt。",
  ]);
  assert.match(probe, /runId: execution-agent:001/);
  assert.match(probe, /packageId: task-context-package:tasks\/task-003.yaml/);
  assert.match(probe, /inputArtifactRefs: taskDraft, executionIntent, isolatedWorkspace/);
});

test("stub execution session notes convergence advice input", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "simple-workflow-execution-stub-advice-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(cwd, { recursive: true });

  const session = runStubExecutionAgentSession({
    role: "execution",
    packageId: "task-context-package:tasks/task-003.yaml",
    cwd,
    runId: "execution-agent:002",
    taskContextPackage: taskPackage(),
    inputArtifactRefs: ["taskDraft", "convergenceAdvice:001", "isolatedWorkspace"],
  });

  assert.deepEqual(session.notes, [
    "execution agent stub 已在隔离工作树写入 .workflow-agent/task-003/aaaaaaaaaaaa/execution-agent-002.txt，并接收上一轮收敛建议。",
  ]);
});
