import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildNoCandidateStartupCheck,
  decideRecommendationRunStart,
} from "../src/workflow/recommendation-run-start-decision.js";

function taskSource() {
  return [
    {
      id: "task-001",
      fileName: "task-001.yaml",
      parsed: {
        id: "task-001",
        title: "展示任务真源",
        type: "feature",
        priority: "normal",
        description: "展示任务",
        acceptance: ["可以看到任务"],
      },
      parseError: null,
      validation: { status: "valid", errors: [] },
    },
  ];
}

function validStartupCheck() {
  return {
    canStartWork: true,
    findings: [],
    runtimeSnapshot: {
      activeWork: null,
      worktree: {
        clean: true,
        changedFiles: [],
      },
    },
  };
}

test("recommendation run start decision creates a running run with prompt candidates", async () => {
  const result = await decideRecommendationRunStart({
    id: "recommendation-run:001",
    tasks: taskSource(),
    startupCheck: validStartupCheck(),
    recommendationPromptPath: "prompts/recommender-agent.prompt.md",
    now: () => "2026-05-22T10:00:00.000Z",
    readPrompt: async (promptPath) => `prompt from ${promptPath}`,
  });

  assert.equal(result.run.status, "running");
  assert.match(result.run.prompt, /prompt from prompts\/recommender-agent\.prompt\.md/);
  assert.match(result.run.prompt, /candidateTasks/);
  assert.match(result.run.prompt, /task-001/);
  assert.equal(result.taskPool.views.candidateTasks.length, 1);
});

test("recommendation run start decision blocks startup failures without reading prompt", async () => {
  let promptRead = false;
  const result = await decideRecommendationRunStart({
    id: "recommendation-run:blocked",
    tasks: taskSource(),
    startupCheck: {
      ...validStartupCheck(),
      canStartWork: false,
      error: "worktree dirty",
      findings: [
        {
          field: "worktree",
          severity: "blocking",
          code: "DIRTY_WORKTREE",
          message: "工作区不干净。",
        },
      ],
    },
    recommendationPromptPath: "unused",
    now: () => "2026-05-22T10:01:00.000Z",
    readPrompt: async () => {
      promptRead = true;
      return "unused";
    },
  });

  assert.equal(promptRead, false);
  assert.equal(result.run.status, "blocked");
  assert.equal(result.run.error, "worktree dirty");
  assert.equal(result.taskPool.views.candidateTasks.length, 1);
});

test("recommendation run start decision blocks when the task pool has no candidates", async () => {
  const result = await decideRecommendationRunStart({
    id: "recommendation-run:no-candidates",
    tasks: [
      {
        id: "task-invalid",
        fileName: "task-invalid.yaml",
        parsed: {
          id: "task-invalid",
          type: "feature",
        },
        parseError: null,
        validation: { status: "invalid", errors: ["title must be a non-empty string"] },
      },
    ],
    startupCheck: validStartupCheck(),
    recommendationPromptPath: "unused",
    now: () => "2026-05-22T10:02:00.000Z",
    readPrompt: async () => {
      throw new Error("prompt should not be read");
    },
  });

  assert.equal(result.run.status, "blocked");
  assert.equal(result.run.error, "没有可推荐候选任务。");
  assert.equal(result.run.startupCheck.canStartWork, false);
  assert.equal(result.run.startupCheck.findings[0].code, "NO_CANDIDATE_TASKS");
  assert.equal(result.taskPool.views.candidateTasks.length, 0);
});

test("no candidate startup check preserves existing findings", () => {
  const startupCheck = buildNoCandidateStartupCheck({
    ...validStartupCheck(),
    findings: [
      {
        field: "projectProfile",
        severity: "warning",
        code: "DEFAULT_PROFILE",
        message: "使用默认配置。",
      },
    ],
  });

  assert.equal(startupCheck.canStartWork, false);
  assert.equal(startupCheck.error, "没有可推荐候选任务。");
  assert.deepEqual(
    startupCheck.findings.map((finding) => finding.code),
    ["DEFAULT_PROFILE", "NO_CANDIDATE_TASKS"],
  );
});
