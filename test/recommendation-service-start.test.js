import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createStubAgentSession } from "../src/workflow/agent-session-contract.js";
import { runStubExecutionAgentSession } from "../src/workflow/execution-agent-stub-session.js";
import { createWorkflowService } from "../src/workflow/workflow-service.js";
import { saveTaskContextPackage } from "../src/workflow/task-context-package-store.js";
import {
  buildIntentJson,
  createGitRepository,
  writePrompt,
} from "./support/recommendation-service-fixtures.js";

test("recommender prompt asks for a structured JSON artifact", async () => {
  const prompt = await readFile(join(process.cwd(), "project_profiles", "recommender-agent.prompt.md"), "utf8");

  assert.match(prompt, /fenced JSON/);
  assert.match(prompt, /candidateTasks/);
  assert.doesNotMatch(prompt, /schemaVersion/);
  assert.match(prompt, /recommendedPackageId/);
  assert.match(prompt, /candidateComparison/);
  assert.match(prompt, /不要读取 `tasks\/` 原始目录/);
  assert.match(prompt, /不要修改任何文件/);
});

test("workflow service does not expose invalid tasks to the recommender prompt", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("recommendation-candidates");
  const tasksDir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "candidate-tasks");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, "task-ready.yaml"),
    [
      "id: task-ready",
      "title: 可推荐任务",
      "type: feature",
      "description: 已通过校验",
      "acceptance:",
      "  - 推荐器能看到它",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(tasksDir, "task-invalid.yaml"),
    [
      "id: task-invalid",
      "type: feature",
      "description: 缺少 title",
      "acceptance:",
      "  - 推荐器不能看到它",
      "",
    ].join("\n"),
  );

  const service = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: async ({ prompt }) => {
      assert.match(prompt, /task-ready/);
      assert.doesNotMatch(prompt, /task-invalid/);
      return {
        stdout: `\`\`\`json\n${buildIntentJson("task-ready")}\n\`\`\``,
        stderr: "",
        exitCode: 0,
        error: null,
      };
    },
    runExecutionAgentSession: runStubExecutionAgentSession,
    runReviewAgentSession: createStubAgentSession,
  });

  const completed = new Promise((resolve) => {
    service.onEvent((event) => {
      if (event.type === "recommendation-run-changed" && event.run.status === "succeeded") {
        resolve(event.run);
      }
    });
  });

  await service.createRecommendationRun();
  const finished = await completed;

  assert.equal(finished.executionAdmission.appendRequest.artifactType, "executionAuthorization");
});

test("workflow service does not run recommender when startup check fails", async () => {
  const promptPath = await writePrompt("recommendation-startup-blocked");
  const service = createWorkflowService({
    tasksDir: join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "tasks"),
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({
      clean: false,
      entries: [{ code: "M", path: "public/app.js" }],
    }),
    runRecommendationCommand: async () => {
      throw new Error("should not run");
    },
  });

  const run = await service.createRecommendationRun();

  assert.equal(run.status, "blocked");
  assert.equal(run.command, null);
  assert.equal(run.startupCheck.canStartWork, false);
  assert.match(run.error, /启动检查未通过/);
});

test("workflow service does not run recommender when a task workflow is active", async (t) => {
  const repositoryDir = await createGitRepository(t);
  const promptPath = await writePrompt("recommendation-active-work");
  const tasksDir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "active-work-tasks");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, "task-004.yaml"),
    [
      "id: task-004",
      "title: 任务池状态模型",
      "type: design",
      "description: 设计任务池状态",
      "acceptance:",
      "  - 明确状态",
      "",
    ].join("\n"),
  );
  await saveTaskContextPackage({
    storeDir: join(repositoryDir, ".workflow", "task-context-packages"),
    taskContextPackage: {
      packageId: "task-context-package:tasks/task-004.yaml",
      currentWorkStage: "human-decision",
      source: {
        path: "tasks/task-004.yaml",
        format: "yaml",
        contentHash: "unavailable",
      },
      recognition: { outcome: "recognized", findings: [] },
      taskDraft: {
        id: "task-004",
        name: "任务池状态模型",
        kind: "design",
        priority: "normal",
        goal: "设计任务池状态",
        acceptanceCriteria: ["明确状态"],
        maxIterations: "default",
      },
      qualityGate: { outcome: "pass" },
      artifacts: {
        humanDecisionRequest: {
          artifactId: "humanDecisionRequest",
          body: {},
          appendedAt: "2026-05-19T00:00:00.000Z",
        },
      },
      agentRuns: [],
      timeline: [],
    },
  });
  const service = createWorkflowService({
    tasksDir,
    repositoryDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: async () => {
      throw new Error("should not run");
    },
  });

  const run = await service.createRecommendationRun();

  assert.equal(run.status, "blocked");
  assert.equal(run.startupCheck.canStartWork, false);
  assert.equal(run.startupCheck.findings[0].code, "ACTIVE_WORK_EXISTS");
  assert.equal(run.startupCheck.runtimeSnapshot.activeWork.packageId, "task-context-package:tasks/task-004.yaml");
});
