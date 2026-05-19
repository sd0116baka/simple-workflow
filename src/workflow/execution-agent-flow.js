import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { createStubAgentSession } from "./agent-runner.js";
import { parseGitPorcelainStatus } from "./repository-status.js";

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
  return convergenceAdvice
    ? [...baseRefs, convergenceAdvice.artifactId, "isolatedWorkspace"]
    : [...baseRefs, "isolatedWorkspace"];
}

function isolatedWorkspacePath(taskContextPackage, repositoryDir) {
  const worktreePath = taskContextPackage.artifacts.isolatedWorkspace.body.worktreePath;
  return isAbsolute(worktreePath) ? worktreePath : resolve(repositoryDir, worktreePath);
}

function normalizePathForGit(filePath) {
  return filePath.replace(/\\/g, "/");
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
  const probeRelativePath = `.workflow-agent/${safeRunId}.txt`;
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

function runStubExecutionAgentSession({
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

export function runExecutionAgent({
  taskContextPackage,
  runAgentSession = runStubExecutionAgentSession,
  repositoryDir = process.cwd(),
  now = () => new Date().toISOString(),
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
  const session = runAgentSession({
    role: "execution",
    packageId: taskContextPackage.packageId,
    taskContextPackage,
    cwd,
    runId,
    inputArtifactRefs,
  });
  const changedFiles = gitChangedFiles(cwd);
  const finishedAt = now();

  return {
    appendRequest: {
      packageId: taskContextPackage.packageId,
      artifactType: "executionReport",
      artifact: {
        summary: "stub execution completed",
        cwd: normalizePathForGit(relative(repositoryDir, cwd)),
        changedFiles,
        tests: [],
        notes: session.notes ?? [],
      },
      agentRun: {
        runId,
        role: "execution",
        sessionId: session.sessionId,
        inputArtifactRefs,
        outputArtifactRefs: [],
        status: session.status,
        startedAt,
        finishedAt,
      },
    },
    error: null,
  };
}
