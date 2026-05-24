import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = fileURLToPath(new URL("../..", import.meta.url));
export const publicDir = join(rootDir, "public");

export function serverPortFromEnv(env = process.env) {
  return Number(env.PORT ?? 5173);
}

export function runtimeConfigFromEnv(env = process.env, cwd = rootDir) {
  const repositoryDir = resolve(env.SIMPLE_WORKFLOW_REPOSITORY_DIR ?? cwd);
  const tasksDir = resolve(env.SIMPLE_WORKFLOW_TASKS_DIR ?? join(repositoryDir, "tasks"));
  const taskContextPackageStoreDir = resolve(
    env.SIMPLE_WORKFLOW_CONTEXT_STORE_DIR ?? join(repositoryDir, ".workflow", "task-context-packages"),
  );
  const recommendationRunProgressLogDir = resolve(
    env.SIMPLE_WORKFLOW_RECOMMENDATION_RUN_LOG_DIR
      ?? join(repositoryDir, ".workflow", "recommendation-run-logs"),
  );
  const recommendationPromptPath = resolve(
    env.SIMPLE_WORKFLOW_RECOMMENDATION_PROMPT_PATH
      ?? join(cwd, "project_profiles", "recommender-agent.prompt.md"),
  );
  return {
    repositoryDir,
    tasksDir,
    taskContextPackageStoreDir,
    recommendationRunProgressLogDir,
    recommendationPromptPath,
  };
}
