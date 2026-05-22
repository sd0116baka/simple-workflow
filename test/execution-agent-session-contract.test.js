import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildExecutionAgentPrompt,
  parseExecutionAgentReportText,
} from "../src/workflow/execution-agent-session-contract.js";
import { createArtifactRecordFixture } from "./support/task-context-package-fixtures.js";
import { createExecutionSessionPackageFixture } from "./support/execution-session-package-fixtures.js";

function executablePackage(worktreePath = ".workflow/worktrees/tasks/tasks-task-003") {
  return createExecutionSessionPackageFixture({ worktreePath });
}

test("builds execution agent prompt from task context package artifacts", () => {
  const taskPackage = executablePackage();
  taskPackage.artifacts.convergenceAdvice = [
    createArtifactRecordFixture(
      "convergenceAdvice:001",
      {
        nextAction: "继续完善实现",
      },
      {
        appendedAt: "2026-05-18T10:00:03.000Z",
      },
    ),
  ];

  const prompt = buildExecutionAgentPrompt({
    taskContextPackage: taskPackage,
    runId: "execution-agent:002",
    inputArtifactRefs: [
      "taskDraft",
      "executionIntent",
      "executionAuthorization",
      "convergenceAdvice:001",
      "isolatedWorkspace",
    ],
  });

  assert.match(prompt, /execution-agent:002/);
  assert.match(prompt, /task-context-package:tasks\/task-003.yaml/);
  assert.match(prompt, /convergenceAdvice:001/);
  assert.match(prompt, /不要修改主工作树/);
  assert.match(prompt, /只输出 fenced JSON/);
});

test("parses fenced execution agent report text", () => {
  const report = parseExecutionAgentReportText([
    "```json",
    JSON.stringify({
      summary: "完成实现",
      tests: [{ command: "npm test", status: "passed" }],
      notes: ["done"],
    }),
    "```",
  ].join("\n"));

  assert.deepEqual(report, {
    summary: "完成实现",
    tests: [{ command: "npm test", status: "passed" }],
    notes: ["done"],
  });
});

test("returns an empty report for malformed or non-object execution output", () => {
  assert.deepEqual(parseExecutionAgentReportText("not json"), {});
  assert.deepEqual(parseExecutionAgentReportText("[1,2,3]"), {});
});
