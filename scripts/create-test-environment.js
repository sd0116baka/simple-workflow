import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = fileURLToPath(new URL("..", import.meta.url));
const environmentDir = resolve(projectDir, ".workflow", "test-environment");
const repositoryDir = join(environmentDir, "repository");

function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function writeTask(fileName, content) {
  await writeFile(join(repositoryDir, "tasks", fileName), content, "utf8");
}

async function createRepository() {
  await rm(repositoryDir, { recursive: true, force: true });
  await mkdir(join(repositoryDir, "tasks"), { recursive: true });
  await writeFile(
    join(repositoryDir, "README.md"),
    [
      "# simple-workflow test repository",
      "",
      "这个仓库由 scripts/create-test-environment.js 生成，用于本地流程测试。",
      "可以安全重置；它不承载 simple-workflow 项目源码。",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeTask(
    "task-001.yaml",
    [
      "id: task-001",
      "title: 测试收敛流程",
      "type: feature",
      "priority: normal",
      "description: 在独立测试仓库中验证 workflow 的执行、审查、收敛和人工决策流程。",
      "acceptance:",
      "  - 流程产物写入测试仓库的 .workflow 目录",
      "  - 取消任务时隔离工作树和任务分支被清理",
      "",
    ].join("\n"),
  );
  await writeTask(
    "task-002.yaml",
    [
      "id: task-002",
      "title: 测试任务池候选过滤",
      "type: design",
      "priority: low",
      "description: 验证未启动任务可以出现在候选任务视图中。",
      "acceptance:",
      "  - candidateTasks 包含未启动且校验通过的任务",
      "",
    ].join("\n"),
  );

  runGit(["init", "-b", "main"], repositoryDir);
  runGit(["add", "."], repositoryDir);
  runGit([
    "-c",
    "user.name=Simple Workflow Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "seed test workflow repository",
  ], repositoryDir);
}

await createRepository();

if (!existsSync(join(repositoryDir, ".git"))) {
  throw new Error("failed to create test repository");
}

console.log(`SIMPLE_WORKFLOW_REPOSITORY_DIR=${repositoryDir}`);
console.log(`SIMPLE_WORKFLOW_TASKS_DIR=${join(repositoryDir, "tasks")}`);
console.log(`SIMPLE_WORKFLOW_CONTEXT_STORE_DIR=${join(repositoryDir, ".workflow", "task-context-packages")}`);
