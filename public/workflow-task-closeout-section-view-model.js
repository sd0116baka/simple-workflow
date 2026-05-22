import { artifactRecord } from "./task-package-artifacts.js";
import {
  isCancelledStage,
  isClosedStage,
} from "./workflow-section-stage-state.js";

export function buildTaskCloseoutSectionViewModel(taskContextPackage) {
  const autoMergeResult = artifactRecord(taskContextPackage, "autoMergeResult");
  const closeout = artifactRecord(taskContextPackage, "taskCloseout");
  const base = {
    rawObject: {
      autoMergeResult,
      taskCloseout: closeout,
    },
    inputs: [
      { label: "自动合并结果", value: autoMergeResult?.artifactId ?? "未生成" },
      { label: "当前环节", value: taskContextPackage?.currentWorkStage ?? "未生成" },
      { label: "收尾产物", value: closeout?.artifactId ?? "未生成" },
    ],
  };

  if (closeout) {
    return {
      ...base,
      statusText: closeout.body?.finalStage === "cancelled" ? "已取消" : "已关闭",
      panel: { kind: "taskCloseout" },
      text: null,
    };
  }

  if (isCancelledStage(taskContextPackage)) {
    return { ...base, statusText: "已取消", panel: null, text: "任务已取消。" };
  }

  if (isClosedStage(taskContextPackage)) {
    return { ...base, statusText: "已关闭", panel: null, text: "任务已关闭。" };
  }

  if (taskContextPackage?.currentWorkStage === "merged") {
    return {
      ...base,
      statusText: "收尾中",
      panel: null,
      text: "自动合并已完成，系统正在清理隔离工作树和任务分支。",
    };
  }

  return {
    ...base,
    statusText: autoMergeResult ? "等待收尾" : "等待输入",
    panel: null,
    text: autoMergeResult ? "等待任务进入 merged 环节。" : "等待自动合并结果。",
  };
}
