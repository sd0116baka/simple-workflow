import { join, resolve, win32 } from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = fileURLToPath(new URL("../..", import.meta.url));
export const publicDir = join(rootDir, "public");

function isWindowsAbsolutePath(value) {
  return typeof value === "string" && win32.isAbsolute(value);
}

function joinRuntimePath(basePath, ...parts) {
  if (isWindowsAbsolutePath(basePath)) {
    return win32.join(basePath, ...parts);
  }
  return join(basePath, ...parts);
}

function resolveRuntimePath(pathValue, cwd = rootDir) {
  if (isWindowsAbsolutePath(pathValue)) {
    return win32.normalize(pathValue);
  }
  if (isWindowsAbsolutePath(cwd)) {
    return win32.resolve(cwd, pathValue);
  }
  return resolve(pathValue);
}

export function serverPortFromEnv(env = process.env) {
  return Number(env.PORT ?? 5173);
}

export function runtimeConfigFromEnv(env = process.env, cwd = rootDir) {
  const repositoryDir = resolveRuntimePath(env.SIMPLE_WORKFLOW_REPOSITORY_DIR ?? cwd, cwd);
  const tasksDir = resolveRuntimePath(
    env.SIMPLE_WORKFLOW_TASKS_DIR ?? joinRuntimePath(repositoryDir, "tasks"),
    cwd,
  );
  const taskContextPackageStoreDir = resolveRuntimePath(
    env.SIMPLE_WORKFLOW_CONTEXT_STORE_DIR
      ?? joinRuntimePath(repositoryDir, ".workflow", "task-context-packages"),
    cwd,
  );
  const recommendationRunProgressLogDir = resolveRuntimePath(
    env.SIMPLE_WORKFLOW_RECOMMENDATION_RUN_LOG_DIR
      ?? joinRuntimePath(repositoryDir, ".workflow", "recommendation-run-logs"),
    cwd,
  );
  const recommendationPromptPath = resolveRuntimePath(
    env.SIMPLE_WORKFLOW_RECOMMENDATION_PROMPT_PATH
      ?? joinRuntimePath(cwd, "project_profiles", "recommender-agent.prompt.md"),
    cwd,
  );
  return {
    repositoryDir,
    tasksDir,
    taskContextPackageStoreDir,
    recommendationRunProgressLogDir,
    recommendationPromptPath,
  };
}
