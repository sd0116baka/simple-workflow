import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReviewAgentPrompt,
  parseReviewAgentReportText,
} from "../src/workflow/review-agent-session-contract.js";
import { createReviewReadyPackageFixture } from "./support/review-ready-package-fixtures.js";

test("parses fenced review agent report JSON", () => {
  const report = parseReviewAgentReportText([
    "```json",
    JSON.stringify({
      outcome: "failed",
      summary: "验收未通过",
      findings: [{ code: "missing-test", message: "缺少测试" }],
    }),
    "```",
  ].join("\n"));

  assert.deepEqual(report, {
    outcome: "failed",
    summary: "验收未通过",
    findings: [{ code: "missing-test", message: "缺少测试" }],
  });
});

test("review agent prompt includes task package and latest execution context", () => {
  const prompt = buildReviewAgentPrompt({
    taskContextPackage: createReviewReadyPackageFixture(),
    runId: "review-agent:001",
    inputArtifactRefs: [
      "taskDraft",
      "executionAuthorization",
      "isolatedWorkspace",
      "executionReport:001",
    ],
  });

  assert.match(prompt, /review agent/);
  assert.match(prompt, /不要修改文件/);
  assert.match(prompt, /"runId": "review-agent:001"/);
  assert.match(prompt, /"executionReport"/);
  assert.match(prompt, /"inputArtifactRefs"/);
});
