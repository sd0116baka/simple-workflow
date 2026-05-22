import { extractAgentJsonOutputText } from "./agent-json-output.js";
import { artifactBody, latestArtifactBody } from "./task-package-artifacts.js";

export function parseExecutionAgentReportText(text) {
  try {
    const parsed = JSON.parse(extractAgentJsonOutputText(text));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
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
    executionIntent: artifactBody(taskContextPackage, "executionIntent"),
    executionAuthorization: artifactBody(taskContextPackage, "executionAuthorization"),
    isolatedWorkspace: artifactBody(taskContextPackage, "isolatedWorkspace"),
    convergenceAdvice: latestArtifactBody(taskContextPackage, "convergenceAdvice"),
    convergenceFailure: latestArtifactBody(taskContextPackage, "convergenceFailure"),
    humanConvergenceGuidance: latestArtifactBody(taskContextPackage, "humanConvergenceGuidance"),
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
