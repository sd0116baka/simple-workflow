import { test } from "node:test";
import assert from "node:assert/strict";
import { renderUserInterface } from "../public/user-app.js";
import {
  FakeElement,
  createFakeDocument,
  findAll,
} from "./support/fake-dom.js";

async function waitFor(check, { attempts = 20 } = {}) {
  for (let index = 0; index < attempts; index += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("condition was not met");
}

test("user app renders task drafting on the left side", () => {
  const root = new FakeElement("main");
  const result = renderUserInterface({
    root,
    documentRef: createFakeDocument(),
    workflowApi: {
      async discussTaskSourceDraft() {
        return {
          taskDraft: {
            assistantMessage: "已生成。",
            taskSourceText: [
              "id: drafted-task",
              "title: 起草任务",
              "type: feature",
              "description: 测试",
              "acceptance:",
              "  - 通过",
            ].join("\n"),
            validation: {
              status: "valid",
              parsed: {
                id: "drafted-task",
                title: "起草任务",
                type: "feature",
                description: "测试",
                acceptance: ["通过"],
              },
            },
          },
        };
      },
      async createTaskSourceFromDraft() {
        return { taskSource: { fileName: "drafted-task.yaml" } };
      },
    },
  });

  const leftPanel = root.children[0].children[0];
  const timelineColumn = root.children[0].children[1];
  const workspace = root.children[0].children[2];
  const taskPoolPanel = leftPanel.children[0];
  const recommendationPanel = leftPanel.children[1];
  const taskDraftPanel = leftPanel.children[2];
  const ids = findAll(root, (element) => Boolean(element.id)).map((element) => element.id);

  assert.equal(leftPanel.tagName, "aside");
  assert.equal(leftPanel.className, "draft-panel");
  assert.equal(taskPoolPanel.className, "task-pool-panel");
  assert.equal(recommendationPanel.className, "recommendation-panel");
  assert.equal(taskDraftPanel.className, "task-draft-panel");
  assert.equal(timelineColumn.className, "timeline-column");
  assert.equal(workspace.className, "user-workspace");
  assert.equal(result.elements.taskDraftCreateButton.disabled, true);
  assert.deepEqual(ids, [
    "userTaskPoolTitle",
    "userTaskPoolCount",
    "userTaskPoolList",
    "userRecommendationTitle",
    "userRecommendationStatus",
    "userRecommendationSummary",
    "runUserRecommendationButton",
    "userTaskDraftTitle",
    "taskDraftStatus",
    "taskDraftMessages",
    "taskDraftInput",
    "taskDraftDiscussButton",
    "taskDraftFinalizeButton",
    "taskDraftValidation",
    "taskDraftOutput",
    "taskDraftCreateButton",
    "taskDraftCommitButton",
    "userStageTimelineTitle",
    "userStageTimelineStatus",
    "userStageTimelinePanel",
    "userWorkspaceTitle",
  ]);
});

test("user app enables committing after adding a drafted task", async () => {
  const root = new FakeElement("main");
  const calls = [];
  const result = renderUserInterface({
    root,
    documentRef: createFakeDocument(),
    workflowApi: {
      async loadWorkflowSnapshot() {
        return { taskPool: { entries: [], taskContextPackages: [] } };
      },
      async loadRecommendationRun() {
        return { recommendationRun: null };
      },
      async discussTaskSourceDraft() {
        return {
          taskDraft: {
            assistantMessage: "已生成。",
            taskSourceText: [
              "id: drafted-task",
              "title: 起草任务",
              "type: feature",
              "description: 测试",
              "acceptance:",
              "  - 通过",
            ].join("\n"),
            validation: {
              status: "valid",
              parsed: {
                id: "drafted-task",
                title: "起草任务",
                type: "feature",
                description: "测试",
                acceptance: ["通过"],
              },
            },
          },
        };
      },
      async createTaskSourceFromDraft(input) {
        calls.push(["createTaskSourceFromDraft", input]);
        return { taskSource: { fileName: "drafted-task.yaml" } };
      },
      async commitTaskSourceFromDraft(input) {
        calls.push(["commitTaskSourceFromDraft", input]);
        return { commit: { commitSha: "abcdef1234567890" } };
      },
    },
  });

  result.elements.taskDraftInput.value = "敲定";
  result.elements.taskDraftFinalizeButton.click();
  await waitFor(() => result.elements.taskDraftCreateButton.disabled === false);
  result.elements.taskDraftCreateButton.click();
  await waitFor(() => result.elements.taskDraftCommitButton.disabled === false);
  result.elements.taskDraftCommitButton.click();
  await waitFor(() => result.elements.taskDraftCommitButton.textContent === "已提交");

  assert.equal(result.elements.taskDraftCommitButton.textContent, "已提交");
  assert.equal(result.elements.taskDraftStatus.textContent, "已提交 abcdef1");
  assert.deepEqual(calls, [
    ["createTaskSourceFromDraft", {
      taskSourceText: [
        "id: drafted-task",
        "title: 起草任务",
        "type: feature",
        "description: 测试",
        "acceptance:",
        "  - 通过",
      ].join("\n"),
    }],
    ["commitTaskSourceFromDraft", { fileName: "drafted-task.yaml" }],
  ]);
});

test("user app renders task recommender below task pool", async () => {
  const root = new FakeElement("main");
  const calls = [];
  const result = renderUserInterface({
    root,
    documentRef: createFakeDocument(),
    workflowApi: {
      async loadRecommendationRun() {
        calls.push(["loadRecommendationRun"]);
        return {
          recommendationRun: {
            status: "completed",
            exitCode: 0,
            executionIntent: {
              recommendedPackageId: "task-context-package:tasks/task-001.yaml",
            },
          },
        };
      },
      async startRecommendationRun(input) {
        calls.push(["startRecommendationRun", input]);
        return {
          recommendationRun: {
            status: "running",
          },
        };
      },
      async loadWorkflowSnapshot() {
        calls.push(["loadWorkflowSnapshot"]);
        return { taskPool: { entries: [], taskContextPackages: [] } };
      },
      async discussTaskSourceDraft() {
        return { taskDraft: { assistantMessage: "继续讨论。" } };
      },
      async createTaskSourceFromDraft() {
        return { taskSource: { fileName: "drafted-task.yaml" } };
      },
    },
  });

  await result.refreshRecommendationRun();
  result.elements.runRecommendationButton.click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.match(result.elements.recommendationPanel.textContent, /任务推荐器/);
  assert.equal(result.elements.recommendationStatus.textContent, "已推荐");
  assert.match(result.elements.recommendationSummary.textContent, /task-001.yaml/);
  assert.equal(calls.some((call) =>
    call[0] === "startRecommendationRun" && call[1]?.mode === "probe"), true);
});

test("user app refreshes a running recommendation until it reaches a terminal state", async () => {
  const root = new FakeElement("main");
  const calls = [];
  const timers = [];
  const recommendationRuns = [
    { status: "running", taskRecommender: { status: "running" } },
    {
      status: "running",
      exitCode: 0,
      taskRecommender: {
        status: "succeeded",
        selectedPackageId: "task-context-package:tasks/hello-world-python.yaml",
      },
      executionIntent: {
        recommendedPackageId: "task-context-package:tasks/hello-world-python.yaml",
      },
    },
  ];
  const result = renderUserInterface({
    root,
    documentRef: createFakeDocument(),
    setTimeoutFn(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    },
    clearTimeoutFn() {},
    recommendationRefreshMs: 5,
    workflowApi: {
      async loadRecommendationRun() {
        calls.push(["loadRecommendationRun"]);
        return { recommendationRun: recommendationRuns.shift() ?? recommendationRuns.at(-1) };
      },
      async loadWorkflowSnapshot() {
        calls.push(["loadWorkflowSnapshot"]);
        return { taskPool: { entries: [], taskContextPackages: [] } };
      },
      async discussTaskSourceDraft() {
        return { taskDraft: { assistantMessage: "继续讨论。" } };
      },
      async createTaskSourceFromDraft() {
        return { taskSource: { fileName: "drafted-task.yaml" } };
      },
    },
  });

  await waitFor(() => result.elements.recommendationStatus.textContent === "推荐中");
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 5);

  timers[0].callback();
  await waitFor(() => result.elements.recommendationStatus.textContent === "已推荐");

  assert.match(result.elements.recommendationSummary.textContent, /hello-world-python.yaml/);
  assert.equal(calls.filter(([name]) => name === "loadRecommendationRun").length, 2);
  assert.equal(calls.some(([name]) => name === "loadWorkflowSnapshot"), true);
});

test("user app loads task pool entries above task drafting", async () => {
  const root = new FakeElement("main");
  const result = renderUserInterface({
    root,
    documentRef: createFakeDocument(),
    workflowApi: {
      async loadWorkflowSnapshot() {
        return {
          taskPool: {
            entries: [
              {
                id: "task-001",
                title: "整理用户界面",
                sourceFile: "task-001.yaml",
                status: "ready",
              },
            ],
          },
        };
      },
      async discussTaskSourceDraft() {
        return { taskDraft: { assistantMessage: "继续讨论。" } };
      },
      async createTaskSourceFromDraft() {
        return { taskSource: { fileName: "drafted-task.yaml" } };
      },
    },
  });

  await result.refreshTaskPool();

  assert.match(result.elements.taskPoolPanel.textContent, /任务池/);
  assert.match(result.elements.taskPoolList.textContent, /整理用户界面/);
  assert.match(result.elements.taskPoolList.textContent, /task-001\.yaml · ready/);
});

test("user app renders state timeline in the middle column", async () => {
  const root = new FakeElement("main");
  const result = renderUserInterface({
    root,
    documentRef: createFakeDocument(),
    workflowApi: {
      async loadWorkflowSnapshot() {
        return {
          taskPool: {
            entries: [
              {
                id: "task-001",
                title: "整理用户界面",
                packageId: "task-context-package:tasks/task-001.yaml",
                sourceFile: "task-001.yaml",
                status: "task-recommender",
              },
            ],
            taskContextPackages: [
              {
                packageId: "task-context-package:tasks/task-001.yaml",
                currentWorkStage: "task-recommender",
                taskDraft: { id: "task-001", name: "整理用户界面" },
                artifacts: {
                  executionIntent: {
                    artifactId: "executionIntent",
                    body: {
                      recommendedPackageId: "task-context-package:tasks/task-001.yaml",
                      confidence: "high",
                      executionBrief: {
                        goalInterpretation: "整理用户界面布局。",
                      },
                    },
                  },
                },
                timeline: [
                  {
                    artifactType: "executionIntent",
                    artifactId: "executionIntent",
                    appendedAt: "2026-05-27T06:55:56.000Z",
                  },
                ],
              },
            ],
          },
        };
      },
      async discussTaskSourceDraft() {
        return { taskDraft: { assistantMessage: "继续讨论。" } };
      },
      async createTaskSourceFromDraft() {
        return { taskSource: { fileName: "drafted-task.yaml" } };
      },
    },
  });

  await result.refreshTaskPool();

  const compactNodes = findAll(result.elements.timelinePanel, (element) =>
    element.className.includes?.("compact-stage-node"));

  assert.match(result.elements.timelineStatus.textContent, /任务推荐器/);
  assert.match(result.elements.timelinePanel.textContent, /任务池/);
  assert.match(result.elements.timelinePanel.textContent, /任务推荐器/);
  assert.equal(compactNodes.length, 2);
  assert.match(result.elements.timelinePanel.textContent, /阶段/);
  assert.match(result.elements.timelinePanel.textContent, /证据/);
  assert.match(result.elements.timelinePanel.textContent, /"recommendedPackageId": "task-context-package:tasks\/task-001.yaml"/);
  assert.match(result.elements.timelinePanel.textContent, /"confidence": "high"/);
  assert.match(result.elements.timelinePanel.textContent, /"goalInterpretation": "整理用户界面布局。"/);
  assert.doesNotMatch(result.elements.timelinePanel.textContent, /转移/);
  assert.equal(findAll(result.elements.timelinePanel, (element) =>
    element.className.split?.(" ").includes("current-status-step")).length, 0);
  assert.equal(findAll(result.elements.timelinePanel, (element) =>
    element.className.includes?.("stage-timeline-node")).length, 0);
});

test("user app renders raw artifact evidence in timeline detail", async () => {
  const root = new FakeElement("main");
  const result = renderUserInterface({
    root,
    documentRef: createFakeDocument(),
    workflowApi: {
      async loadWorkflowSnapshot() {
        return {
          taskPool: {
            entries: [
              {
                id: "task-001",
                title: "整理用户界面",
                packageId: "task-context-package:tasks/task-001.yaml",
                sourceFile: "task-001.yaml",
                status: "closed",
              },
            ],
            taskContextPackages: [
              {
                packageId: "task-context-package:tasks/task-001.yaml",
                currentWorkStage: "closed",
                taskDraft: { id: "task-001", name: "整理用户界面" },
                artifacts: {
                  executionAuthorization: {
                    artifactId: "executionAuthorization",
                    body: { decidedAt: "2026-05-27T06:55:56.000Z" },
                  },
                  executionReport: [
                    {
                      artifactId: "executionReport:001",
                      body: {
                        summary: "执行完成，生成 hello_world.py。",
                        tests: ["python hello_world.py 输出 hello world"],
                      },
                    },
                  ],
                  taskCloseout: {
                    artifactId: "taskCloseout",
                    body: {
                      finalStage: "closed",
                      closeoutReason: "merged",
                      closeoutAt: "2026-05-27T06:56:56.000Z",
                      cleanup: {
                        worktree: {
                          path: ".workflow/worktrees/tasks/task-001",
                          removed: true,
                        },
                        branch: {
                          name: "workflow/tasks/task-001",
                          deleted: true,
                        },
                      },
                    },
                  },
                },
                timeline: [
                  {
                    artifactType: "executionAuthorization",
                    artifactId: "executionAuthorization",
                    appendedAt: "2026-05-27T06:55:56.000Z",
                  },
                  {
                    agentRunId: "execution-agent:001",
                    appendedAt: "2026-05-27T06:56:00.000Z",
                  },
                ],
              },
            ],
          },
        };
      },
      async discussTaskSourceDraft() {
        return { taskDraft: { assistantMessage: "继续讨论。" } };
      },
      async createTaskSourceFromDraft() {
        return { taskSource: { fileName: "drafted-task.yaml" } };
      },
    },
  });

  await result.refreshTaskPool();

  assert.match(result.elements.timelinePanel.textContent, /"finalStage": "closed"/);
  assert.match(result.elements.timelinePanel.textContent, /"closeoutReason": "merged"/);
  assert.match(result.elements.timelinePanel.textContent, /"removed": true/);
  assert.match(result.elements.timelinePanel.textContent, /"deleted": true/);
  assert.doesNotMatch(result.elements.timelinePanel.textContent, /当前 · taskCloseout/);
});

test("user app expands agent run evidence to its report body", async () => {
  const root = new FakeElement("main");
  const result = renderUserInterface({
    root,
    documentRef: createFakeDocument(),
    workflowApi: {
      async loadWorkflowSnapshot() {
        return {
          taskPool: {
            entries: [
              {
                id: "task-001",
                title: "整理用户界面",
                packageId: "task-context-package:tasks/task-001.yaml",
                sourceFile: "task-001.yaml",
                status: "execution-agent",
              },
            ],
            taskContextPackages: [
              {
                packageId: "task-context-package:tasks/task-001.yaml",
                currentWorkStage: "execution-agent",
                taskDraft: { id: "task-001", name: "整理用户界面" },
                artifacts: {
                  executionReport: [
                    {
                      artifactId: "executionReport:001",
                      body: {
                        summary: "执行完成，生成 hello_world.py。",
                        tests: ["python hello_world.py 输出 hello world"],
                      },
                    },
                  ],
                },
                agentRuns: [
                  {
                    runId: "execution-agent:001",
                    role: "execution",
                    status: "succeeded",
                    finishedAt: "2026-05-27T06:56:00.000Z",
                  },
                ],
                timeline: [
                  {
                    artifactType: "executionReport",
                    artifactId: "executionReport:001",
                    appendedAt: "2026-05-27T06:55:58.000Z",
                  },
                  {
                    agentRunId: "execution-agent:001",
                    appendedAt: "2026-05-27T06:56:00.000Z",
                  },
                ],
              },
            ],
          },
        };
      },
      async discussTaskSourceDraft() {
        return { taskDraft: { assistantMessage: "继续讨论。" } };
      },
      async createTaskSourceFromDraft() {
        return { taskSource: { fileName: "drafted-task.yaml" } };
      },
    },
  });

  await result.refreshTaskPool();

  assert.match(result.elements.timelinePanel.textContent, /"summary": "执行完成，生成 hello_world.py。"/);
  assert.match(result.elements.timelinePanel.textContent, /"python hello_world.py 输出 hello world"/);
  assert.doesNotMatch(result.elements.timelinePanel.textContent, /当前 · execution-agent:001/);
});

test("user app renders finalized task draft as parsed fields", async () => {
  const root = new FakeElement("main");
  const result = renderUserInterface({
    root,
    documentRef: createFakeDocument(),
    workflowApi: {
      async loadWorkflowSnapshot() {
        return { taskPool: { entries: [] } };
      },
      async discussTaskSourceDraft() {
        return {
          taskDraft: {
            assistantMessage: "已生成。",
            taskSourceText: [
              "id: import-csv",
              "title: 导入 CSV",
              "type: feature",
              "priority: normal",
              "description: 支持导入 CSV 任务数据。",
              "acceptance:",
              "  - 可以选择 CSV 文件",
            ].join("\n"),
            validation: {
              status: "valid",
              parsed: {
                id: "import-csv",
                title: "导入 CSV",
                type: "feature",
                priority: "normal",
                description: "支持导入 CSV 任务数据。",
                acceptance: ["可以选择 CSV 文件"],
              },
            },
          },
        };
      },
      async createTaskSourceFromDraft() {
        return { taskSource: { fileName: "import-csv.yaml" } };
      },
    },
  });

  result.elements.taskDraftInput.value = "敲定";
  await result.commands.finalizeTaskDraft();

  assert.match(result.elements.taskDraftOutput.textContent, /导入 CSV/);
  assert.match(result.elements.taskDraftOutput.textContent, /import-csv/);
  assert.match(result.elements.taskDraftOutput.textContent, /任务说明/);
  assert.match(result.elements.taskDraftOutput.textContent, /支持导入 CSV 任务数据。/);
  assert.match(result.elements.taskDraftOutput.textContent, /验收标准/);
  assert.match(result.elements.taskDraftOutput.textContent, /可以选择 CSV 文件/);
  assert.doesNotMatch(result.elements.taskDraftOutput.textContent, /id: import-csv/);
});
