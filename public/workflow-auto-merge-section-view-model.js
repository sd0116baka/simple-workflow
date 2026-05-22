import { artifactRecord } from "./task-package-artifacts.js";
import {
  isCancelledStage,
  isClosedStage,
} from "./workflow-section-stage-state.js";

export function buildAutoMergeSectionViewModel(taskContextPackage) {
  const humanDecision = artifactRecord(taskContextPackage, "humanDecision");
  const plan = artifactRecord(taskContextPackage, "autoMergePlan");
  const rejection = artifactRecord(taskContextPackage, "autoMergeRejection");
  const executionFailure = artifactRecord(taskContextPackage, "autoMergeFailure");
  const base = {
    rawObject: {
      humanDecision,
      autoMergePlan: plan,
      autoMergeRejection: rejection,
    },
    inputs: [
      { label: "人工决策", value: humanDecision?.body?.decision ?? "未接受" },
      { label: "当前环节", value: taskContextPackage?.currentWorkStage ?? "未生成" },
      { label: "合并计划", value: plan?.artifactId ?? "未生成" },
      { label: "拒绝记录", value: rejection?.artifactId ?? "未生成" },
    ],
  };

  if (isCancelledStage(taskContextPackage)) {
    return {
      ...base,
      statusText: "已取消",
      panel: null,
      text: "任务已取消，不需要自动合并。",
    };
  }

  if (plan) {
    return {
      ...base,
      statusText: isClosedStage(taskContextPackage)
        ? "已完成"
        : executionFailure ? "计划已生成" : "可执行合并",
      panel: { kind: "autoMergePlan" },
      text: null,
    };
  }

  if (rejection) {
    return {
      ...base,
      statusText: "未通过",
      panel: { kind: "autoMergePlan" },
      text: null,
    };
  }

  if (isClosedStage(taskContextPackage)) {
    return {
      ...base,
      statusText: "已完成",
      panel: null,
      text: "任务已关闭。",
    };
  }

  if (taskContextPackage?.currentWorkStage === "auto-merge-planning") {
    return {
      ...base,
      statusText: "自动检查中",
      panel: null,
      text: "人工已接受收敛成功，系统正在生成自动合并计划。",
    };
  }

  return {
    ...base,
    statusText: humanDecision ? "等待自动合并" : "等待输入",
    panel: null,
    text: humanDecision
      ? "等待任务进入 auto-merge-planning 环节。"
      : "等待人工接受收敛成功。",
  };
}
