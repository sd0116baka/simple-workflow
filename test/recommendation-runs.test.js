import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/server/server.js";
import { createWorkflowService } from "../src/workflow/workflow-service.js";

async function writePrompt(name) {
  const dir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), name);
  await mkdir(dir, { recursive: true });
  const promptPath = join(dir, "recommender-agent.prompt.md");
  await writeFile(promptPath, "推荐一个任务，但不要修改文件。");
  return promptPath;
}

function buildIntentJson(taskId = "task-001") {
  return JSON.stringify({
    recommendedPackageId: `task-context-package:tasks/${taskId}.yaml`,
    confidence: "medium",
    selectionReasoning: ["任务可执行"],
    candidateComparison: [
      {
        packageId: `task-context-package:tasks/${taskId}.yaml`,
        decision: "selected",
        reason: "当前最适合执行",
      },
    ],
    executionBrief: {
      goalInterpretation: `优先实现 ${taskId}。`,
      expectedOutcome: ["任务完成后满足验收标准"],
      implementationHints: ["先阅读现有实现"],
      riskSignals: [],
      openQuestions: [],
    },
  });
}

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

test("workflow service captures a successful recommendation run", async () => {
  const promptPath = await writePrompt("recommendation-success");
  const tasksDir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "tasks");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, "task-001.yaml"),
    [
      "id: task-001",
      "title: 展示任务真源",
      "type: feature",
      "description: 展示任务",
      "acceptance:",
      "  - 可以看到任务",
      "",
    ].join("\n"),
  );
  const service = createWorkflowService({
    tasksDir,
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: async ({ prompt }) => {
      assert.match(prompt, /candidateTasks/);
      assert.match(prompt, /task-001/);
      assert.match(prompt, /不要修改文件/);
      return {
        stdout: `\`\`\`json\n${buildIntentJson()}\n\`\`\``,
        stderr: "",
        exitCode: 0,
        error: null,
      };
    },
  });

  const completed = new Promise((resolve) => {
    service.onEvent((event) => {
      if (event.type === "recommendation-run-changed" && event.run.status === "succeeded") {
        resolve(event.run);
      }
    });
  });

  const running = await service.createRecommendationRun();
  const finished = await completed;

  assert.equal(running.status, "running");
  assert.equal(finished.status, "succeeded");
  assert.match(finished.stdout, /task-001/);
  assert.equal(finished.executionIntent.recommendedPackageId, "task-context-package:tasks/task-001.yaml");
  assert.equal(finished.executionIntentError, null);
  assert.equal(finished.executionAdmission.appendRequest.artifactType, "executionAuthorization");
  assert.equal(finished.taskContextPackage.currentWorkStage, "execution-admission");
  assert.equal(finished.taskContextPackage.artifacts.executionAuthorization.termination.maxIterations, 3);
  assert.equal(finished.exitCode, 0);
  assert.equal(service.getLatestRecommendationRun().status, "succeeded");
});

test("workflow service does not expose invalid tasks to the recommender prompt", async () => {
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

test("workflow service keeps successful runs when recommendation intent parsing fails", async () => {
  const promptPath = await writePrompt("recommendation-parse-failure");
  const service = createWorkflowService({
    tasksDir: join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "tasks"),
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: async () => ({
      stdout: "不是 JSON",
      stderr: "",
      exitCode: 0,
      error: null,
    }),
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

  assert.equal(finished.status, "succeeded");
  assert.equal(finished.executionIntent, null);
  assert.match(finished.executionIntentError, /Unexpected token|JSON/);
});

test("workflow service emits running progress for recommendation runs", async () => {
  const promptPath = await writePrompt("recommendation-progress");
  const service = createWorkflowService({
    tasksDir: join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "tasks"),
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: async ({ onProgress }) => {
      onProgress({ type: "step_start", message: "开始运行 opencode" });
      return {
        stdout: "建议先做 task-001",
        stderr: "",
        exitCode: 0,
        error: null,
      };
    },
  });

  const progressEvent = new Promise((resolve) => {
    service.onEvent((event) => {
      if (event.type === "recommendation-run-changed" && event.run.progress.length > 0) {
        resolve(event.run);
      }
    });
  });

  await service.createRecommendationRun();
  const running = await progressEvent;

  assert.equal(running.status, "running");
  assert.equal(running.progress[0].message, "开始运行 opencode");
});

test("workflow service marks non-zero recommendation exits as failed", async () => {
  const promptPath = await writePrompt("recommendation-failure");
  const service = createWorkflowService({
    tasksDir: join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "tasks"),
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: async () => ({
      stdout: "",
      stderr: "模型调用失败",
      exitCode: 2,
      error: null,
    }),
  });

  const completed = new Promise((resolve) => {
    service.onEvent((event) => {
      if (event.type === "recommendation-run-changed" && event.run.status === "failed") {
        resolve(event.run);
      }
    });
  });

  await service.createRecommendationRun();
  const finished = await completed;

  assert.equal(finished.status, "failed");
  assert.equal(finished.stderr, "模型调用失败");
  assert.equal(finished.exitCode, 2);
});

test("workflow service marks thrown recommendation commands as failed", async () => {
  const promptPath = await writePrompt("recommendation-throw");
  const service = createWorkflowService({
    tasksDir: join(process.cwd(), ".tmp-test-tasks", String(Date.now()), "tasks"),
    recommendationPromptPath: promptPath,
    getRepositoryStatus: async () => ({ clean: true, entries: [] }),
    runRecommendationCommand: () => {
      throw new Error("命令启动失败");
    },
  });

  const completed = new Promise((resolve) => {
    service.onEvent((event) => {
      if (event.type === "recommendation-run-changed" && event.run.status === "failed") {
        resolve(event.run);
      }
    });
  });

  const running = await service.createRecommendationRun();
  const finished = await completed;

  assert.equal(running.status, "running");
  assert.equal(finished.status, "failed");
  assert.equal(finished.error, "命令启动失败");
});

test("POST /api/recommendation-runs starts a run and latest returns the snapshot", async (t) => {
  const latestRun = {
    id: "recommendation-run-test",
    status: "running",
    startedAt: "2026-05-16T00:00:00.000Z",
    finishedAt: null,
    command: "opencode",
    args: ["run", "--format", "json"],
    progress: [],
    stdout: "",
    stderr: "",
    exitCode: null,
    error: null,
  };
  const workflowService = {
    async createRecommendationRun() {
      return latestRun;
    },
    getLatestRecommendationRun() {
      return latestRun;
    },
    onEvent() {
      return () => {};
    },
  };
  const server = createApp({ workflowService });
  server.listen(0);
  t.after(() => server.close());
  await once(server, "listening");

  const baseUrl = `http://localhost:${server.address().port}`;
  const createResponse = await fetch(`${baseUrl}/api/recommendation-runs`, { method: "POST" });
  const createPayload = await createResponse.json();
  const latestResponse = await fetch(`${baseUrl}/api/recommendation-runs/latest`);
  const latestPayload = await latestResponse.json();

  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.recommendationRun.status, "running");
  assert.equal(latestResponse.status, 200);
  assert.equal(latestPayload.recommendationRun.id, "recommendation-run-test");
});
