export const WORKFLOW_STAGE_SWITCH_DEFAULTS = Object.freeze({
  executionAdmission: true,
  isolatedWorkspace: true,
  mainAgent: true,
  executionAgent: true,
  reviewAgent: true,
  convergence: true,
});

export const WORKFLOW_STAGE_SWITCH_LABELS = Object.freeze({
  executionAdmission: "执行准入",
  isolatedWorkspace: "隔离工作区",
  mainAgent: "main agent",
  executionAgent: "execution agent",
  reviewAgent: "review agent",
  convergence: "convergence",
});

export function normalizeWorkflowStageSwitches(stageSwitches = {}) {
  const input = stageSwitches && typeof stageSwitches === "object" ? stageSwitches : {};
  return Object.fromEntries(
    Object.entries(WORKFLOW_STAGE_SWITCH_DEFAULTS).map(([key, defaultValue]) => [
      key,
      typeof input[key] === "boolean" ? input[key] : defaultValue,
    ]),
  );
}

export function isWorkflowStageEnabled(stageSwitches, stageKey) {
  return normalizeWorkflowStageSwitches(stageSwitches)[stageKey] === true;
}

export function describeWorkflowStageSwitches(stageSwitches) {
  const normalized = normalizeWorkflowStageSwitches(stageSwitches);
  const enabledLabels = Object.entries(normalized)
    .filter(([, enabled]) => enabled)
    .map(([key]) => WORKFLOW_STAGE_SWITCH_LABELS[key] ?? key);
  return enabledLabels.length > 0 ? enabledLabels.join("、") : "未开启";
}
