import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRecommendationRaw,
  buildRecommendationRunViewModel,
} from "../public/recommendation-run-view-model.js";
import {
  createRecommendationRunFixture,
  createRunningRecommendationRunFixture,
  createSucceededRecommendationRunFixture,
} from "./support/recommendation-run-fixtures.js";

test("recommendation run view model renders the empty state", () => {
  const viewModel = buildRecommendationRunViewModel({
    recommendationRun: null,
    poolEntryCount: 3,
    startupCheck: { canStartWork: true },
  });

  assert.equal(viewModel.hasRun, false);
  assert.equal(viewModel.rawText, "尚未触发推荐器。");
  assert.equal(viewModel.recommendationStatus, "未运行");
  assert.equal(viewModel.admissionStatus, "等待输入");
  assert.equal(viewModel.recommendationResultText, "尚未触发推荐器。");
  assert.equal(viewModel.recommendationIntentText, "尚未解析。");
  assert.equal(viewModel.admissionPanelText, "等待推荐器输出。");
  assert.deepEqual(viewModel.controls, {
    runDisabled: false,
    cancelHidden: true,
    cancelDisabled: false,
    cancelText: "取消运行",
  });
  assert.deepEqual(viewModel.admissionInputs, [
    { label: "执行意图", value: "未生成" },
    { label: "任务池", value: "3 个条目" },
    { label: "启动检查", value: "true" },
  ]);
  assert.deepEqual(viewModel.recommendationInputs[0], {
    label: "模式",
    value: "完整 Agent 流程",
  });
});

test("recommendation run view model renders a running run", () => {
  const viewModel = buildRecommendationRunViewModel({
    now: () => new Date("2026-05-21T10:00:05.000Z").getTime(),
    poolEntryCount: 1,
    startupCheck: { canStartWork: false },
    recommendationRun: createRunningRecommendationRunFixture({
      id: "recommendation-run:001",
      startedAt: "2026-05-21T10:00:00.000Z",
      args: ["run", "--format", "json"],
      terminalSessionId: "terminal-session-1",
      progress: [{ message: "启动推荐器" }],
      executionIntent: {
        recommendedPackageId: "task-context-package:tasks/task-001.yaml",
      },
    }),
  });

  assert.equal(viewModel.hasRun, true);
  assert.equal(viewModel.recommendationStatus, "running · 00:05");
  assert.deepEqual(viewModel.summary, {
    className: "recommendation-summary running",
    text: "探针正在运行... 00:05",
  });
  assert.equal(viewModel.metaText, "opencode run --format json");
  assert.equal(viewModel.controls.runDisabled, true);
  assert.equal(viewModel.controls.cancelHidden, false);
  assert.deepEqual(viewModel.recommendationInputs.at(-1), {
    label: "终端会话",
    value: "terminal-session-1",
  });
  assert.equal(viewModel.admissionInputs[0].value, "task-context-package:tasks/task-001.yaml");
  assert.match(viewModel.rawText, /运行进度/);
});

test("recommendation run view model labels probe mode as recommendation only", () => {
  const viewModel = buildRecommendationRunViewModel({
    recommendationRun: createSucceededRecommendationRunFixture({
      mode: "probe",
    }),
  });

  assert.deepEqual(viewModel.recommendationInputs[0], {
    label: "模式",
    value: "推荐探针（不启动后续 Agent）",
  });
});

test("recommendation run view model summarizes stage switches", () => {
  const viewModel = buildRecommendationRunViewModel({
    recommendationRun: createSucceededRecommendationRunFixture({
      stageSwitches: {
        executionAdmission: true,
        isolatedWorkspace: false,
        mainAgent: true,
        executionAgent: false,
        reviewAgent: false,
        convergence: false,
      },
    }),
  });

  assert.deepEqual(viewModel.recommendationInputs[1], {
    label: "流程开关",
    value: "执行准入、main agent",
  });
});

test("recommendation run view model renders terminal states and output", () => {
  const blocked = buildRecommendationRunViewModel({
    recommendationRun: createRecommendationRunFixture({
      status: "blocked",
      startedAt: "2026-05-21T10:00:00.000Z",
      finishedAt: "2026-05-21T10:00:02.000Z",
      command: null,
      args: [],
      error: "\u001b[31m启动检查未通过\u001b[0m",
    }),
  });
  const cancelled = buildRecommendationRunViewModel({
    recommendationRun: createRecommendationRunFixture({
      status: "cancelled",
      startedAt: "2026-05-21T10:00:00.000Z",
      finishedAt: "2026-05-21T10:00:03.000Z",
      args: [],
    }),
  });
  const succeeded = buildRecommendationRunViewModel({
    recommendationRun: createSucceededRecommendationRunFixture({
      startedAt: "2026-05-21T10:00:00.000Z",
      finishedAt: "2026-05-21T10:00:04.000Z",
      command: null,
      args: [],
      exitCode: 0,
      stdout: "\u001b[32m{\"ok\":true}\u001b[0m",
      executionIntentError: "invalid JSON",
    }),
  });

  assert.equal(blocked.summary.text, "启动检查未通过，推荐器未运行。");
  assert.equal(blocked.metaText, "未启动外部命令");
  assert.match(blocked.rawText, /错误\(error\)\n启动检查未通过/);
  assert.equal(cancelled.summary.text, "用户已取消 · 用时 00:03");
  assert.equal(succeeded.summary.text, "exitCode: 0 · 用时 00:04");
  assert.equal(succeeded.admissionStatus, "等待输入");
  assert.equal(succeeded.recommendationIntentText, "解析失败：invalid JSON");
  assert.match(succeeded.outputText, /解析失败\ninvalid JSON/);
  assert.match(succeeded.outputText, /结构化产物\(stdout\)\n\{"ok":true\}/);
});

test("recommendation run view model preserves unknown admission artifact state", () => {
  const viewModel = buildRecommendationRunViewModel({
    recommendationRun: createSucceededRecommendationRunFixture({
      startedAt: "2026-05-21T10:00:00.000Z",
      finishedAt: "2026-05-21T10:00:04.000Z",
      command: null,
      args: [],
      exitCode: 0,
      executionAdmission: {},
    }),
  });

  assert.equal(viewModel.admissionStatus, "未知");
  assert.equal(viewModel.admissionPanelText, null);
});

test("recommendation raw output falls back to waiting text", () => {
  assert.equal(buildRecommendationRaw({ progress: [] }), "等待输出...");
});
