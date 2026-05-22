import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function gitSucceeds(args, cwd) {
  try {
    runGit(args, cwd);
    return true;
  } catch {
    return false;
  }
}

export async function createGitRepository(t) {
  const repositoryDir = await mkdtemp(join(tmpdir(), "simple-workflow-runs-"));
  t.after(() => rm(repositoryDir, { recursive: true, force: true }));

  runGit(["init", "-b", "main"], repositoryDir);
  await writeFile(join(repositoryDir, "README.md"), "test repository\n");
  await writeFile(join(repositoryDir, ".gitignore"), ".workflow/\n");
  runGit(["add", "README.md", ".gitignore"], repositoryDir);
  runGit([
    "-c",
    "user.name=Simple Workflow Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "-m",
    "initial commit",
  ], repositoryDir);

  return repositoryDir;
}

export async function writePrompt(name) {
  const dir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), name);
  await mkdir(dir, { recursive: true });
  const promptPath = join(dir, "recommender-agent.prompt.md");
  await writeFile(promptPath, "推荐一个任务，但不要修改文件。");
  return promptPath;
}

export async function writeValidTasksDir(name, taskId = "task-001") {
  const tasksDir = join(process.cwd(), ".tmp-test-tasks", String(Date.now()), name, "tasks");
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, `${taskId}.yaml`),
    [
      `id: ${taskId}`,
      "title: 展示任务真源",
      "type: feature",
      "description: 展示任务",
      "acceptance:",
      "  - 可以看到任务",
      "",
    ].join("\n"),
  );
  return tasksDir;
}

export function buildIntentJson(taskId = "task-001") {
  return JSON.stringify({
    appendRequest: {
      packageId: `task-context-package:tasks/${taskId}.yaml`,
      artifactType: "executionIntent",
      artifact: {
        recommendedPackageId: `task-context-package:tasks/${taskId}.yaml`,
        confidence: "medium",
        selectionReasoning: ["任务可执行"],
        candidateComparison: [
          {
            packageId: `task-context-package:tasks/${taskId}.yaml`,
            decision: "selected",
            reason: "当前最适合执行",
          },
        ],
        executionBrief: {
          goalInterpretation: `优先实现 ${taskId}。`,
          expectedOutcome: ["任务完成后满足验收标准"],
          implementationHints: ["先阅读现有实现"],
          riskSignals: [],
          openQuestions: [],
        },
      },
    },
  });
}
