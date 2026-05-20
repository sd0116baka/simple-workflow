import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { createStubAgentSession, normalizeAgentStatus } from "./agent-runner.js";
import { terminateProcessTree } from "./process-control.js";
import { extractTextFromJsonEvents } from "./recommendation-runner.js";
import { parseGitPorcelainStatus } from "./repository-status.js";

export const OPENCODE_EXECUTION_ARGS = ["run", "--format", "json"];

function truncateTerminalLine(text, maxLength = 4000) {
  const value = String(text ?? "");
  return value.length > maxLength
    ? `${value.slice(0, maxLength)}\n...[truncated ${value.length - maxLength} chars]`
    : value;
}

function hasExecutionAuthorization(taskContextPackage) {
  return Boolean(taskContextPackage?.artifacts?.executionAuthorization?.body);
}

function hasMainAgentInitialization(taskContextPackage) {
  return taskContextPackage?.agentRuns?.[0]?.role === "main";
}

function hasIsolatedWorkspace(taskContextPackage) {
  return Boolean(taskContextPackage?.artifacts?.isolatedWorkspace?.body);
}

function nextExecutionRunId(taskContextPackage) {
  const existingReports = taskContextPackage?.artifacts?.executionReport ?? [];
  const nextIndex = Array.isArray(existingReports) ? existingReports.length + 1 : 1;
  return `execution-agent:${String(nextIndex).padStart(3, "0")}`;
}

function latestArtifact(taskContextPackage, artifactType) {
  const artifacts = taskContextPackage?.artifacts?.[artifactType];
  return Array.isArray(artifacts) && artifacts.length > 0
    ? artifacts[artifacts.length - 1]
    : null;
}

function inputArtifactRefsForExecution(taskContextPackage) {
  const baseRefs = [
    "taskDraft",
    "executionIntent",
    "executionAuthorization",
  ];
  const convergenceAdvice = latestArtifact(taskContextPackage, "convergenceAdvice");
  const convergenceFailure = latestArtifact(taskContextPackage, "convergenceFailure");
  const humanConvergenceGuidance = latestArtifact(taskContextPackage, "humanConvergenceGuidance");
  const correctionRefs = [
    convergenceAdvice?.artifactId,
    convergenceFailure?.artifactId,
    humanConvergenceGuidance?.artifactId,
  ].filter(Boolean);
  return correctionRefs.length > 0
    ? [...baseRefs, ...correctionRefs, "isolatedWorkspace"]
    : [...baseRefs, "isolatedWorkspace"];
}

function isolatedWorkspacePath(taskContextPackage, repositoryDir) {
  const worktreePath = taskContextPackage.artifacts.isolatedWorkspace.body.worktreePath;
  return isAbsolute(worktreePath) ? worktreePath : resolve(repositoryDir, worktreePath);
}

function normalizePathForGit(filePath) {
  return filePath.replace(/\\/g, "/");
}

function safePathSegment(value) {
  const safeValue = String(value ?? "").replace(/[^a-zA-Z0-9._-]/g, "-");
  return safeValue || "unknown-task";
}

function baseCommitSegment(taskContextPackage) {
  const baseCommit = taskContextPackage.artifacts?.isolatedWorkspace?.body?.baseCommit;
  return safePathSegment(baseCommit ? String(baseCommit).slice(0, 12) : "unknown-base");
}

function gitChangedFiles(cwd) {
  const output = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return parseGitPorcelainStatus(output).entries.map((entry) => entry.path);
}

function writeStubExecutionProbe({ cwd, runId, taskContextPackage, inputArtifactRefs }) {
  const safeRunId = runId.replace(/[^a-zA-Z0-9.-]/g, "-");
  const safeTaskId = safePathSegment(taskContextPackage.taskDraft?.id ?? taskContextPackage.packageId);
  const safeBaseCommit = baseCommitSegment(taskContextPackage);
  const probeRelativePath = `.workflow-agent/${safeTaskId}/${safeBaseCommit}/${safeRunId}.txt`;
  const probePath = resolve(cwd, probeRelativePath);
  mkdirSync(dirname(probePath), { recursive: true });
  writeFileSync(
    probePath,
    [
      `runId: ${runId}`,
      `packageId: ${taskContextPackage.packageId}`,
      `cwd: ${cwd}`,
      `inputArtifactRefs: ${inputArtifactRefs.join(", ")}`,
      "",
    ].join("\n"),
    "utf8",
  );
  return normalizePathForGit(relative(cwd, probePath));
}

function stripJsonFence(text) {
  const trimmed = String(text ?? "").trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function parseExecutionReportText(text) {
  try {
    const parsed = JSON.parse(stripJsonFence(text));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function findSessionIdInJsonEvents(output) {
  const lines = String(output ?? "").split(/\r?\n/);
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const candidates = [
      event.sessionId,
      event.sessionID,
      event.session?.id,
      event.properties?.sessionId,
      event.properties?.sessionID,
    ].filter((value) => typeof value === "string" && value.length > 0);
    if (candidates.length > 0) return candidates[0];
  }
  return null;
}

function latestExecutionArtifact(taskContextPackage, artifactType) {
  return latestArtifact(taskContextPackage, artifactType)?.body ?? null;
}

export function buildExecutionAgentPrompt({
  taskContextPackage,
  runId,
  inputArtifactRefs,
} = {}) {
  const payload = {
    packageId: taskContextPackage.packageId,
    runId,
    inputArtifactRefs,
    taskDraft: taskContextPackage.taskDraft,
    executionIntent: taskContextPackage.artifacts.executionIntent?.body ?? null,
    executionAuthorization: taskContextPackage.artifacts.executionAuthorization?.body ?? null,
    isolatedWorkspace: taskContextPackage.artifacts.isolatedWorkspace?.body ?? null,
    convergenceAdvice: latestExecutionArtifact(taskContextPackage, "convergenceAdvice"),
    convergenceFailure: latestExecutionArtifact(taskContextPackage, "convergenceFailure"),
    humanConvergenceGuidance: latestExecutionArtifact(taskContextPackage, "humanConvergenceGuidance"),
  };

  return [
    "你是 simple-workflow 的 execution agent。",
    "你只能在当前工作树中实现任务，不要修改主工作树，也不要提交或合并。",
    "根据输入 JSON 完成任务；如果有 humanConvergenceGuidance，优先按人工收敛意见修正上一轮问题。",
    "完成后只输出 fenced JSON，不要输出额外说明。",
    "JSON 字段：summary 字符串；tests 数组；notes 数组。",
    "",
    "输入 JSON：",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
  ].join("\n");
}

export function runStubExecutionAgentSession({
  role,
  packageId,
  cwd,
  runId,
  taskContextPackage,
  inputArtifactRefs,
}) {
  const session = createStubAgentSession({ role, packageId });
  const probeFile = writeStubExecutionProbe({
    cwd,
    runId,
    taskContextPackage,
    inputArtifactRefs,
  });
  return {
    ...session,
    notes: [
      inputArtifactRefs.some((ref) => ref.startsWith("convergenceAdvice:"))
        ? `execution agent stub 已在隔离工作树写入 ${probeFile}，并接收上一轮收敛建议。`
        : `execution agent stub 已在隔离工作树写入 ${probeFile}。`,
    ],
  };
}

export function runOpencodeExecutionAgentSession({
  role,
  packageId,
  cwd,
  runId,
  taskContextPackage,
  inputArtifactRefs,
  command = "opencode",
  args = OPENCODE_EXECUTION_ARGS,
  env = process.env,
  shell = process.platform === "win32",
  onProgress,
  signal,
}) {
  const prompt = buildExecutionAgentPrompt({
    taskContextPackage,
    runId,
    inputArtifactRefs,
  });
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({
        role,
        packageId,
        sessionId: `opencode-session-cancelled:${runId}`,
        status: "cancelled",
        summary: "execution agent 已取消。",
        tests: [],
        notes: [],
        rawOutput: {
          stdout: "",
          stderr: "",
          exitCode: null,
          error: "cancelled",
        },
      });
      return;
    }

    const child = spawn(command, args, {
      cwd,
      env,
      shell,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let cancelled = false;
    let lastOutputAt = Date.now();
    const commandLine = [command, ...args].join(" ");

    onProgress?.({
      type: "execution_process_start",
      stream: "execution-agent",
      message: `启动 ${runId}：${commandLine}`,
      terminalLine: `$ ${commandLine}\ncwd: ${cwd}\nrunId: ${runId}\npid: ${child.pid ?? "unknown"}`,
    });

    const heartbeat = setInterval(() => {
      const idleSeconds = Math.floor((Date.now() - lastOutputAt) / 1000);
      onProgress?.({
        type: "execution_heartbeat",
        stream: "execution-agent",
        message: `${runId} 仍在运行，${idleSeconds}s 无新输出`,
        terminalLine: `${runId}: still running, no output for ${idleSeconds}s`,
      });
    }, 10000);

    function finish({ exitCode = null, error = null } = {}) {
      if (settled) return;
      settled = true;
      clearInterval(heartbeat);
      signal?.removeEventListener("abort", abortRun);
      const extractedText = extractTextFromJsonEvents(stdout);
      const report = parseExecutionReportText(extractedText);
      const status = cancelled ? "cancelled" : normalizeAgentStatus({ exitCode, error });
      const sessionId = findSessionIdInJsonEvents(stdout) ?? `opencode-session-unavailable:${runId}`;

      resolve({
        role,
        packageId,
        sessionId,
        status,
        summary: typeof report.summary === "string" && report.summary.trim().length > 0
          ? report.summary
          : extractedText.trim(),
        tests: Array.isArray(report.tests) ? report.tests : [],
        notes: Array.isArray(report.notes) ? report.notes : [],
        rawOutput: {
          stdout: extractedText,
          stderr,
          exitCode,
          error: cancelled ? "cancelled" : error,
        },
      });
    }

    function abortRun() {
      if (settled) return;
      cancelled = true;
      onProgress?.({
        type: "execution_process_cancelled",
        stream: "execution-agent",
        message: `${runId} 已由用户取消`,
        terminalLine: `${runId}: cancelled by user`,
      });
      terminateProcessTree(child);
    }

    signal?.addEventListener("abort", abortRun, { once: true });

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      lastOutputAt = Date.now();
      stdout += chunk;
      onProgress?.({
        type: "execution_stdout",
        stream: "execution-stdout",
        message: `${runId} stdout ${chunk.length} chars`,
        terminalLine: truncateTerminalLine(chunk.trimEnd()),
      });
    });
    child.stderr?.on("data", (chunk) => {
      lastOutputAt = Date.now();
      stderr += chunk;
      onProgress?.({
        type: "execution_stderr",
        stream: "execution-stderr",
        message: `${runId} stderr ${chunk.length} chars`,
        terminalLine: truncateTerminalLine(chunk.trimEnd()),
      });
    });
    child.on("error", (error) => {
      onProgress?.({
        type: "execution_process_error",
        stream: "execution-agent",
        message: `${runId} 启动失败：${error.message}`,
        terminalLine: `${runId}: error ${error.message}`,
      });
      finish({ error: cancelled ? "cancelled" : error.message });
    });
    child.on("close", (exitCode) => {
      onProgress?.({
        type: "execution_process_close",
        stream: "execution-agent",
        message: `${runId} 退出：${exitCode}`,
        terminalLine: `${runId}: exited with code ${exitCode}`,
      });
      finish({ exitCode });
    });
    child.stdin?.write(prompt);
    child.stdin?.end();
  });
}

export async function runExecutionAgent({
  taskContextPackage,
  runAgentSession = runStubExecutionAgentSession,
  repositoryDir = process.cwd(),
  now = () => new Date().toISOString(),
  onProgress,
  signal,
} = {}) {
  if (!taskContextPackage?.packageId) {
    throw new Error("taskContextPackage.packageId is required");
  }
  if (!hasExecutionAuthorization(taskContextPackage)) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少执行授权，不能运行 execution agent。",
    };
  }
  if (!hasIsolatedWorkspace(taskContextPackage)) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 isolatedWorkspace，不能运行 execution agent。",
    };
  }
  if (!hasMainAgentInitialization(taskContextPackage)) {
    return {
      appendRequest: null,
      error: "任务上下文包缺少 main agent 初始化记录，不能运行 execution agent。",
    };
  }

  const runId = nextExecutionRunId(taskContextPackage);
  const cwd = isolatedWorkspacePath(taskContextPackage, repositoryDir);
  if (!existsSync(cwd)) {
    return {
      appendRequest: null,
      error: `隔离工作树路径不存在，不能运行 execution agent：${taskContextPackage.artifacts.isolatedWorkspace.body.worktreePath}`,
    };
  }

  const startedAt = now();
  const inputArtifactRefs = inputArtifactRefsForExecution(taskContextPackage);
  const session = await runAgentSession({
    role: "execution",
    packageId: taskContextPackage.packageId,
    taskContextPackage,
    cwd,
    runId,
    inputArtifactRefs,
    onProgress,
    signal,
  });
  const changedFiles = gitChangedFiles(cwd);
  const finishedAt = now();
  const status = session.status ?? "succeeded";
  const error = status === "succeeded"
    ? null
    : session.rawOutput?.error
      ?? session.rawOutput?.stderr
      ?? "execution agent 运行失败。";

  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "executionReport",
      artifact: {
        summary: session.summary ?? "stub execution completed",
        status,
        cwd: normalizePathForGit(relative(repositoryDir, cwd)),
        changedFiles,
        tests: session.tests ?? [],
        notes: session.notes ?? [],
        rawOutput: session.rawOutput ?? null,
      },
      agentRun: {
        runId,
        role: "execution",
        sessionId: session.sessionId,
        inputArtifactRefs,
        outputArtifactRefs: [],
        status,
        startedAt,
        finishedAt,
      },
    },
    error,
  };
}
