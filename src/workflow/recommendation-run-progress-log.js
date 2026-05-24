import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendRecommendationRunCancellationProgress,
  appendRecommendationRunProgress,
} from "./recommendation-run-progress.js";

function safeRunId(runId) {
  const id = String(runId ?? "");
  if (!/^[A-Za-z0-9._:-]+$/.test(id)) {
    throw new Error("recommendationRunId contains unsupported characters");
  }
  return id;
}

function logFilePath(logDir, runId) {
  return join(logDir, `${safeRunId(runId)}.ndjson`);
}

function packageIdFor(run, event) {
  return event.packageId
    ?? run.progressLogPackageId
    ?? run.taskContextPackage?.packageId
    ?? null;
}

function normalizeLogEvent(run, event, now) {
  const packageId = packageIdFor(run, event);
  return {
    ...event,
    runId: run.id,
    ...(packageId ? { packageId } : {}),
    timestamp: event.timestamp ?? now(),
  };
}

function logWriteFailedEvent(error, now) {
  return {
    type: "log_write_failed",
    stream: "system",
    message: "持久运行日志写入失败，当前只能看到内存进度。",
    terminalLine: `progress log write failed: ${error.message}`,
    timestamp: now(),
  };
}

export function createRecommendationRunProgressLogStore({
  logDir,
  now = () => new Date().toISOString(),
} = {}) {
  if (!logDir) {
    throw new Error("recommendation run progress logDir is required");
  }

  function append(run, event) {
    if (!run?.id) {
      return { ok: false, error: "recommendation run id is required" };
    }
    try {
      mkdirSync(logDir, { recursive: true });
      const normalized = normalizeLogEvent(run, event, now);
      appendFileSync(logFilePath(logDir, run.id), `${JSON.stringify(normalized)}\n`, "utf8");
      return { ok: true, event: normalized };
    } catch (error) {
      run.progressLogError = error.message;
      return { ok: false, error: error.message, cause: error };
    }
  }

  function read(runId) {
    try {
      const text = readFileSync(logFilePath(logDir, runId), "utf8");
      return text
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  return {
    append,
    read,
    logDir,
  };
}

function appendLogFailureProgress(run, error, now) {
  const alreadyLatest = run.progress?.at(-1)?.type === "log_write_failed";
  if (alreadyLatest) return;
  appendRecommendationRunProgress(run, logWriteFailedEvent(error, now), { now });
}

export function createRecommendationRunProgressRecorder({
  progressLogStore,
  emitRecommendationChanged = () => {},
  now = () => new Date().toISOString(),
} = {}) {
  function recordLogEvent(run, event) {
    let result = { ok: true };
    try {
      result = progressLogStore?.append(run, event) ?? { ok: true };
    } catch (error) {
      run.progressLogError = error.message;
      result = { ok: false, error: error.message, cause: error };
    }
    if (!result.ok) {
      appendLogFailureProgress(run, result.cause ?? new Error(result.error), now);
    }
    return result;
  }

  function appendProgress(run, progress) {
    appendRecommendationRunProgress(run, progress, { now });
    recordLogEvent(run, run.progress.at(-1));
    emitRecommendationChanged(run);
  }

  function appendCancellationProgress(run, options = {}) {
    appendRecommendationRunCancellationProgress(run, {
      now: options.now ?? now,
    });
    recordLogEvent(run, run.progress.at(-1));
  }

  function recordSystemEvent(run, event) {
    recordLogEvent(run, {
      ...event,
      stream: event.stream ?? "system",
    });
  }

  function bindPackage(run, packageId) {
    if (!packageId || run.progressLogPackageId === packageId) return;
    if (run.progressLogPackageId && run.progressLogPackageId !== packageId) {
      recordSystemEvent(run, {
        type: "package_bind_conflict",
        message: `recommendation run 已绑定 ${run.progressLogPackageId}，不能再绑定 ${packageId}。`,
        packageId: run.progressLogPackageId,
      });
      throw new Error("recommendation run cannot bind multiple task packages");
    }
    run.progressLogPackageId = packageId;
    recordSystemEvent(run, {
      type: "package_bound",
      message: `recommendation run 绑定任务 ${packageId}`,
      packageId,
    });
  }

  function recordRunFinished(run) {
    recordSystemEvent(run, {
      type: "run_finished",
      message: `recommendation run finished: ${run.status}`,
      status: run.status,
      error: run.error ?? null,
      exitCode: run.exitCode ?? null,
    });
  }

  return {
    appendProgress,
    appendCancellationProgress,
    bindPackage,
    recordRunFinished,
    recordSystemEvent,
  };
}
