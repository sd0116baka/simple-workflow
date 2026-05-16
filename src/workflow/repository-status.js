import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function parseGitPorcelainStatus(output) {
  const entries = output
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => {
      const rawCode = line.slice(0, 2);
      const code = rawCode.trim() === "" ? rawCode : rawCode.trim();
      return {
        code,
        path: line.slice(3),
      };
    });

  return {
    clean: entries.length === 0,
    entries,
  };
}

export async function getRepositoryStatus({ cwd }) {
  const { stdout } = await execFileAsync("git", ["status", "--porcelain"], { cwd });
  return parseGitPorcelainStatus(stdout);
}
