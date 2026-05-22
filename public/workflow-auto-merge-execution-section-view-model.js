import { artifactRecord } from "./task-package-artifacts.js";
import {
  isCancelledStage,
  isClosedStage,
} from "./workflow-section-stage-state.js";

export function buildAutoMergeExecutionSectionViewModel(taskContextPackage) {
  const plan = artifactRecord(taskContextPackage, "autoMergePlan");
  const result = artifactRecord(taskContextPackage, "autoMergeResult");
  const failure = artifactRecord(taskContextPackage, "autoMergeFailure");
  const base = {
    rawObject: {
      autoMergePlan: plan,
      autoMergeResult: result,
      autoMergeFailure: failure,
    },
    inputs: [
      { label: "合并计划", value: plan?.artifactId ?? "未生成" },
      { label: "当前环节", value: taskContextPackage?.currentWorkStage ?? "未生成" },
      { label: "执行结果", value: result?.artifactId ?? "未生成" },
      { label: "失败记录", value: failure?.artifactId ?? "未生成" },
    ],
  };

  if (result) {
    return { ...base, statusText: "已合并", panel: { kind: "autoMergeExecution" }, text: null };
  }

  if (failure) {
    return { ...base, statusText: "失败", panel: { kind: "autoMergeExecution" }, text: null };
  }

  if (isCancelledStage(taskContextPackage)) {
    return {
      ...base,
      statusText: "已取消",
      panel: null,
      text: "任务已取消，不需要执行自动合并。",
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

  if (taskContextPackage?.currentWorkStage === "auto-merge-execution") {
    return {
      ...base,
      statusText: "等待执行",
      panel: {
        kind: "list",
        viewModel: {
          className: "auto-merge-panel autoMergePlan",
          title: "合并计划已生成",
          meta: "自动合并计划已生成。",
          listItems: [],
        },
      },
      text: null,
    };
  }

  return {
    ...base,
    statusText: plan ? "等待执行" : "等待输入",
    panel: null,
    text: plan ? "等待任务进入 auto-merge-execution 环节。" : "等待自动合并计划。",
  };
}
