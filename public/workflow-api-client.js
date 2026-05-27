export class WorkflowApiError extends Error {
  constructor(message, { status, payload } = {}) {
    super(message);
    this.name = "WorkflowApiError";
    this.status = status ?? null;
    this.payload = payload ?? null;
  }
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export function createWorkflowApiClient({
  fetchImpl = fetch,
  now = () => Date.now(),
} = {}) {
  async function requestJson(path, {
    method = "GET",
    body,
    errorMessage,
  } = {}) {
    const response = await fetchImpl(path, {
      method,
      headers: body === undefined ? undefined : {
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await readJsonResponse(response);
    if (!response.ok) {
      throw new WorkflowApiError(payload.error ?? `${errorMessage ?? "请求失败"}：${response.status}`, {
        status: response.status,
        payload,
      });
    }
    return payload;
  }

  return {
    async loadWorkflowSnapshot() {
      const [tasksPayload, poolPayload, startupCheckPayload] = await Promise.all([
        requestJson("/api/tasks", { errorMessage: "读取任务失败" }),
        requestJson("/api/task-pool", { errorMessage: "读取任务池失败" }),
        requestJson("/api/startup-check", { errorMessage: "读取启动检查失败" }),
      ]);
      return {
        tasks: tasksPayload.tasks ?? [],
        taskPool: poolPayload.taskPool ?? null,
        startupCheck: startupCheckPayload.startupCheck ?? null,
      };
    },

    loadRecommendationRun() {
      return requestJson("/api/recommendation-runs/latest", {
        errorMessage: "读取推荐器失败",
      });
    },

    startRecommendationRun({ mode = "workflow", stageSwitches } = {}) {
      return requestJson("/api/recommendation-runs", {
        method: "POST",
        body: stageSwitches ? { mode, stageSwitches } : { mode },
        errorMessage: "启动推荐器失败",
      });
    },

    updateRecommendationRunStageSwitches({ stageSwitches } = {}) {
      return requestJson("/api/recommendation-runs/stage-switches", {
        method: "PATCH",
        body: { stageSwitches },
        errorMessage: "更新流程开关失败",
      });
    },

    cancelRecommendationRun() {
      return requestJson("/api/recommendation-runs/cancel", {
        method: "POST",
        errorMessage: "取消运行失败",
      });
    },

    acceptConvergence({ packageId }) {
      return requestJson("/api/human-decisions/accept-convergence", {
        method: "POST",
        body: { packageId },
        errorMessage: "接受收敛成功失败",
      });
    },

    continueConvergenceWithGuidance({
      packageId,
      guidance,
      expectedNextOutcome,
    }) {
      return requestJson("/api/human-decisions/continue-convergence-with-guidance", {
        method: "POST",
        body: {
          packageId,
          guidance,
          expectedNextOutcome,
        },
        errorMessage: "带意见继续收敛失败",
      });
    },

    cancelTask({ packageId }) {
      return requestJson("/api/human-decisions/cancel-task", {
        method: "POST",
        body: { packageId },
        errorMessage: "取消任务失败",
      });
    },

    replanAutoMerge({ packageId }) {
      return requestJson("/api/auto-merge/replan", {
        method: "POST",
        body: { packageId },
        errorMessage: "重新生成合并计划失败",
      });
    },

    discussTaskSourceDraft({ mode = "discuss", messages = [] } = {}) {
      return requestJson("/api/task-draft-assistant", {
        method: "POST",
        body: { mode, messages },
        errorMessage: "任务起草助手失败",
      });
    },

    createTaskSourceFromDraft({ taskSourceText } = {}) {
      return requestJson("/api/task-draft-assistant/task-source", {
        method: "POST",
        body: { taskSourceText },
        errorMessage: "写入任务真源失败",
      });
    },

    commitTaskSourceFromDraft({ fileName } = {}) {
      return requestJson("/api/task-draft-assistant/task-source/commit", {
        method: "POST",
        body: { fileName },
        errorMessage: "提交任务真源失败",
      });
    },

    restartServer() {
      return requestJson("/api/server/restart", {
        method: "POST",
        errorMessage: "重启失败",
      });
    },

    probeStartupCheck() {
      return fetchImpl(`/api/startup-check?restartProbe=${now()}`, {
        cache: "no-store",
      });
    },

    seedStateFixtures({ fixtureKey }) {
      return requestJson("/api/test-fixtures/state-stubs", {
        method: "POST",
        body: { fixtureKey },
        errorMessage: "生成测试状态失败",
      });
    },

    cleanupStateFixtures() {
      return requestJson("/api/test-fixtures/state-stubs", {
        method: "DELETE",
        errorMessage: "清理状态桩失败",
      });
    },

    loadLatestTerminalSession() {
      return requestJson("/api/terminal-sessions/latest", {
        errorMessage: "读取终端失败",
      });
    },

    startTerminalSession({ command, args = [] } = {}) {
      return requestJson("/api/terminal-sessions", {
        method: "POST",
        body: { command, args },
        errorMessage: "启动终端失败",
      });
    },

    writeTerminalSessionInput({ sessionId, input } = {}) {
      return requestJson("/api/terminal-sessions/input", {
        method: "POST",
        body: { sessionId, input },
        errorMessage: "发送终端输入失败",
      });
    },

    cancelTerminalSession({ sessionId } = {}) {
      return requestJson("/api/terminal-sessions/cancel", {
        method: "POST",
        body: { sessionId },
        errorMessage: "停止终端失败",
      });
    },
  };
}
