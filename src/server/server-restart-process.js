import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { rootDir } from "./server-runtime-config.js";

function quotePowerShellSingle(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function restartCommand({
  currentPid = process.pid,
  cwd = rootDir,
  nodePath = process.execPath,
  serverPath = fileURLToPath(new URL("server.js", import.meta.url)),
  platform = process.platform,
} = {}) {
  if (platform === "win32") {
    const restartScript = [
      "$ErrorActionPreference = 'Stop'",
      `Wait-Process -Id ${currentPid} -ErrorAction SilentlyContinue`,
      "Start-Sleep -Milliseconds 300",
      `Set-Location ${quotePowerShellSingle(cwd)}`,
      `& ${quotePowerShellSingle(nodePath)} ${quotePowerShellSingle(serverPath)}`,
    ].join("; ");
    const launcherScript = [
      "Start-Process",
      `-FilePath ${quotePowerShellSingle("powershell.exe")}`,
      `-ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ${quotePowerShellSingle(restartScript)})`,
      "-WindowStyle Hidden",
    ].join(" ");
    return {
      command: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", launcherScript],
    };
  }

  const script = [
    `while kill -0 ${currentPid} 2>/dev/null; do sleep 0.2; done`,
    `cd "$1"`,
    `nohup "$2" "$3" >/dev/null 2>&1 &`,
  ].join("; ");
  return {
    command: "sh",
    args: ["-c", script, "simple-workflow-restart", cwd, nodePath, serverPath],
  };
}

export function spawnRestartProcess(options = {}) {
  const { command, args } = restartCommand(options);
  if ((options.platform ?? process.platform) === "win32") {
    spawnSync(command, args, {
      cwd: options.cwd,
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  spawn(command, args, {
    cwd: options.cwd,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  }).unref();
}
