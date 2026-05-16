import { spawn } from "node:child_process";

export function runOpencodeRecommendation({
  prompt,
  command = "opencode",
  args = ["run"],
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: process.platform === "win32",
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    function finish(result) {
      if (settled) return;
      settled = true;
      resolve(result);
    }

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      finish({
        stdout,
        stderr,
        exitCode: null,
        error: error.message,
      });
    });

    child.on("close", (exitCode) => {
      finish({
        stdout,
        stderr,
        exitCode,
        error: null,
      });
    });

    if (prompt) {
      child.stdin?.write(prompt);
    }
    child.stdin?.end();
  });
}
