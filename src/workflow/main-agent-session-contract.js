import { extractAgentJsonOutputText } from "./agent-json-output.js";
import { inputArtifactRefsForConvergence } from "./agent-input-refs.js";
import {
  MAIN_AGENT_INITIALIZATION_INPUT_REFS,
  MAIN_AGENT_INITIALIZATION_RUN_ID,
} from "./main-agent-contract.js";
import { artifactBody, latestArtifactBody, latestArtifactRecord } from "./task-package-artifacts.js";

function normalizeFindings(value) {
  return Array.isArray(value) ? value : [];
}

export function parseMainAgentOutputText(text) {
  try {
    const parsed = JSON.parse(extractAgentJsonOutputText(text));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return {
      ...parsed,
      findings: normalizeFindings(parsed.findings),
    };
  } catch {
    return {};
  }
}

function buildInitializationPayload({ taskContextPackage, runId, inputArtifactRefs }) {
  return {
    phase: "initialization",
    packageId: taskContextPackage.packageId,
    runId,
    inputArtifactRefs,
    taskDraft: taskContextPackage.taskDraft,
    executionIntent: artifactBody(taskContextPackage, "executionIntent"),
    executionAuthorization: artifactBody(taskContextPackage, "executionAuthorization"),
    isolatedWorkspace: artifactBody(taskContextPackage, "isolatedWorkspace"),
  };
}

function buildConvergencePayload({ taskContextPackage, runId, inputArtifactRefs }) {
  return {
    phase: "convergence",
    packageId: taskContextPackage.packageId,
    runId,
    inputArtifactRefs,
    taskDraft: taskContextPackage.taskDraft,
    executionIntent: artifactBody(taskContextPackage, "executionIntent"),
    executionAuthorization: artifactBody(taskContextPackage, "executionAuthorization"),
    isolatedWorkspace: artifactBody(taskContextPackage, "isolatedWorkspace"),
    executionReport: latestArtifactBody(taskContextPackage, "executionReport"),
    reviewReport: latestArtifactBody(taskContextPackage, "reviewReport"),
    convergenceAdvice: latestArtifactBody(taskContextPackage, "convergenceAdvice"),
    convergenceFailure: latestArtifactBody(taskContextPackage, "convergenceFailure"),
    humanConvergenceGuidance: latestArtifactBody(taskContextPackage, "humanConvergenceGuidance"),
  };
}

export function buildMainAgentPrompt({
  taskContextPackage,
  runId,
  sessionId = null,
  inputArtifactRefs = runId === MAIN_AGENT_INITIALIZATION_RUN_ID
    ? MAIN_AGENT_INITIALIZATION_INPUT_REFS
    : inputArtifactRefsForConvergence(
        taskContextPackage,
        latestArtifactRecord(taskContextPackage, "executionReport"),
        latestArtifactRecord(taskContextPackage, "reviewReport"),
      ),
} = {}) {
  const isInitialization = runId === MAIN_AGENT_INITIALIZATION_RUN_ID;
  const payload = isInitialization
    ? buildInitializationPayload({ taskContextPackage, runId, inputArtifactRefs })
    : buildConvergencePayload({ taskContextPackage, runId, inputArtifactRefs });

  return [
    "你是 simple-workflow 的 main agent。",
    "你负责理解任务、保持执行上下文，并在收敛阶段根据执行和审查结果决定下一步。",
    "不要提交、合并或修改主工作树。只有 execution agent 负责实现文件改动。",
    isInitialization
      ? "当前阶段是初始化：建立任务上下文，确认后续执行目标。"
      : "当前阶段是收敛：判断是否需要下一轮执行建议，或总结完成/失败原因。",
    "完成后只输出 fenced JSON，不要输出额外说明。",
    "JSON 字段：summary 字符串；nextAction 字符串；findings 数组。",
    "",
    "输入 JSON：",
    "```json",
    JSON.stringify({ ...payload, sessionId }, null, 2),
    "```",
  ].join("\n");
}
