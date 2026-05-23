import { createRawTaskSource } from "./task-source.js";

export function createTaskSourceMutationService({
  tasksDir,
  emitTaskChange,
  now = () => new Date().toISOString(),
  createTaskSource = createRawTaskSource,
} = {}) {
  return {
    async createTaskSourceFromText({ taskSourceText } = {}) {
      const taskSource = await createTaskSource({
        tasksDir,
        taskSourceText,
      });
      emitTaskChange?.({
        eventType: "create-task-source",
        fileName: taskSource.fileName,
        timestamp: now(),
      });
      return taskSource;
    },
  };
}
