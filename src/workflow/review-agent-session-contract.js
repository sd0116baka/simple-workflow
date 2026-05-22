import { extractAgentJsonOutputText } from "./agent-json-output.js";
import { inputArtifactRefsForReview } from "./agent-input-refs.js";
import { artifactBody, latestArtifactBody, latestArtifactRecord } from "./task-package-artifacts.js";

function normalizeOutcome(value) {
  return value === "failed" ? "failed" : "passed";
}

function normalizeFindings(value) {
  return Array.isArray(value) ? value : [];
}

export function parseReviewAgentReportText(text) {
  try {
    const parsed = JSON.parse(extractAgentJsonOutputText(text));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return {
      ...parsed,
      outcome: normalizeOutcome(parsed.outcome),
      findings: normalizeFindings(parsed.findings),
    };
  } catch {
    return {};
  }
}

export function buildReviewAgentPrompt({
  taskContextPackage,
  runId,
  inputArtifactRefs = inputArtifactRefsForReview(
    taskContextPackage,
    latestArtifactRecord(taskContextPackage, "executionReport"),
  ),
} = {}) {
  const payload = {
    packageId: taskContextPackage.packageId,
    runId,
    inputArtifactRefs,
    taskDraft: taskContextPackage.taskDraft,
    executionAuthorization: artifactBody(taskContextPackage, "executionAuthorization"),
    isolatedWorkspace: artifactBody(taskContextPackage, "isolatedWorkspace"),
    executionReport: latestArtifactBody(taskContextPackage, "executionReport"),
    convergenceAdvice: latestArtifactBody(taskContextPackage, "convergenceAdvice"),
    humanConvergenceGuidance: latestArtifactBody(taskContextPackage, "humanConvergenceGuidance"),
  };

  return [
    "你是 simple-workflow 的 review agent。",
    "你只审查当前隔离工作树中的执行结果，不要修改文件，不要提交或合并。",
    "根据输入 JSON 和当前工作树判断任务是否满足验收标准。",
    "完成后只输出 fenced JSON，不要输出额外说明。",
    "JSON 字段：outcome 为 passed 或 failed；summary 字符串；findings 数组。",
    "",
    "输入 JSON：",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
  ].join("\n");
}
