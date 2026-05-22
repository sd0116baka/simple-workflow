import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { createStubAgentSession } from "./agent-session-contract.js";
import { normalizePathForGit } from "./git-path.js";
import { artifactBody } from "./task-package-artifacts.js";

function safePathSegment(value) {
  const safeValue = String(value ?? "").replace(/[^a-zA-Z0-9._-]/g, "-");
  return safeValue || "unknown-task";
}

function baseCommitSegment(taskContextPackage) {
  const baseCommit = artifactBody(taskContextPackage, "isolatedWorkspace")?.baseCommit;
  return safePathSegment(baseCommit ? String(baseCommit).slice(0, 12) : "unknown-base");
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
