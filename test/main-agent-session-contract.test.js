import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMainAgentPrompt,
  parseMainAgentOutputText,
} from "../src/workflow/main-agent-session-contract.js";
import { MAIN_AGENT_INITIALIZATION_RUN_ID } from "../src/workflow/main-agent-contract.js";
import { createConvergenceReadyPackageFixture } from "./support/convergence-ready-package-fixtures.js";
import { createReviewReadyPackageFixture } from "./support/review-ready-package-fixtures.js";

test("parses fenced main agent JSON output", () => {
  const output = parseMainAgentOutputText([
    "```json",
    JSON.stringify({
      summary: "需要下一轮修正",
      nextAction: "让 execution agent 补测试",
      findings: [{ code: "missing-test" }],
    }),
    "```",
  ].join("\n"));

  assert.deepEqual(output, {
    summary: "需要下一轮修正",
    nextAction: "让 execution agent 补测试",
    findings: [{ code: "missing-test" }],
  });
});

test("builds initialization prompt with package context", () => {
  const prompt = buildMainAgentPrompt({
    taskContextPackage: createReviewReadyPackageFixture(),
    runId: MAIN_AGENT_INITIALIZATION_RUN_ID,
  });

  assert.match(prompt, /main agent/);
  assert.match(prompt, /初始化/);
  assert.match(prompt, /"phase": "initialization"/);
  assert.match(prompt, /"isolatedWorkspace"/);
});

test("builds convergence prompt with reviewed execution context", () => {
  const prompt = buildMainAgentPrompt({
    taskContextPackage: createConvergenceReadyPackageFixture(),
    runId: "main-agent:convergence:001",
    sessionId: "session:main",
  });

  assert.match(prompt, /收敛/);
  assert.match(prompt, /"phase": "convergence"/);
  assert.match(prompt, /"sessionId": "session:main"/);
  assert.match(prompt, /"executionReport"/);
  assert.match(prompt, /"reviewReport"/);
});
