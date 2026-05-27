import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { basename, relative, resolve } from "node:path";
import { normalizePathForGit } from "./git-path.js";
import { createRawTaskSource } from "./task-source.js";

const execFileAsync = promisify(execFile);
const TASK_DRAFT_COMMIT_MESSAGE = "feat(tasks): 添加任务起草任务";

async function runGit(args, { cwd }) {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

function taskSourcePath({ repositoryDir, tasksDir, fileName }) {
  if (!fileName || basename(fileName) !== fileName) {
    throw new Error("task source fileName must be a plain file name");
  }
  const absolutePath = resolve(tasksDir, fileName);
  const relativeToTasks = relative(tasksDir, absolutePath);
  if (relativeToTasks.startsWith("..") || relativeToTasks === "") {
    throw new Error("task source file must stay inside tasks directory");
  }
  return normalizePathForGit(relative(repositoryDir, absolutePath));
}

export async function commitTaskSourceFile({
  repositoryDir,
  tasksDir,
  fileName,
  message = TASK_DRAFT_COMMIT_MESSAGE,
  runGitCommand = runGit,
} = {}) {
  const path = taskSourcePath({ repositoryDir, tasksDir, fileName });
  await runGitCommand(["add", "--", path], { cwd: repositoryDir });
  await runGitCommand(["commit", "--only", "-m", message, "--", path], { cwd: repositoryDir });
  const commitSha = await runGitCommand(["rev-parse", "HEAD"], { cwd: repositoryDir });
  return {
    commitSha,
    fileName,
    message,
    path,
  };
}

export function createTaskSourceMutationService({
  repositoryDir = process.cwd(),
  tasksDir,
  emitTaskChange,
  now = () => new Date().toISOString(),
  createTaskSource = createRawTaskSource,
  commitTaskSource = commitTaskSourceFile,
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

    async commitTaskSourceFromDraft({ fileName } = {}) {
      const commit = await commitTaskSource({
        repositoryDir,
        tasksDir,
        fileName,
      });
      emitTaskChange?.({
        eventType: "commit-task-source",
        fileName: commit.fileName,
        commitSha: commit.commitSha,
        timestamp: now(),
      });
      return commit;
    },
  };
}
