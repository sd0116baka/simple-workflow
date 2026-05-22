export function createTaskSource(options = {}) {
  const id = options.id ?? "task-003";
  const fileName = options.fileName ?? `${id}.yaml`;
  const title = Object.hasOwn(options, "title") ? options.title : "监听任务文件变化";
  const type = Object.hasOwn(options, "type") ? options.type : "feature";
  const priority = Object.hasOwn(options, "priority") ? options.priority : "high";
  const description = Object.hasOwn(options, "description")
    ? options.description
    : "监听 tasks 目录变化";
  const acceptance = Object.hasOwn(options, "acceptance")
    ? options.acceptance
    : ["修改任务源文件后界面自动刷新"];
  const parseError = options.parseError ?? null;
  const validation = options.validation ?? { status: "valid", errors: [] };

  return {
    id,
    fileName,
    parsed: parseError === null
      ? {
          id,
          title,
          type,
          priority,
          description,
          acceptance,
        }
      : null,
    parseError,
    validation,
  };
}

export function createExistingTaskContextPackage({
  packageId = "task-context-package:tasks/task-003.yaml",
  currentWorkStage = "closed",
  artifacts = {},
  agentRuns = [],
  timeline = [],
} = {}) {
  return {
    packageId,
    currentWorkStage,
    artifacts,
    agentRuns,
    timeline,
  };
}

export function createTask003Source() {
  return createTaskSource();
}
