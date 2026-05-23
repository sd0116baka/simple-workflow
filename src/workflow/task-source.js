import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import YAML from "yaml";
import { validateParsedTask } from "./task-validator.js";

const SUPPORTED_EXTENSIONS = new Map([
  [".yaml", "yaml"],
  [".yml", "yaml"],
]);

export function isSupportedTaskFile(fileName) {
  return Boolean(fileName) && SUPPORTED_EXTENSIONS.has(extname(String(fileName)).toLowerCase());
}

function parseRawTask(task) {
  try {
    return {
      parsed: YAML.parse(task.rawText),
      parseError: null,
    };
  } catch (error) {
    return {
      parsed: null,
      parseError: `YAML parse error: ${error.message}`,
    };
  }
}

function normalizeTaskSourceText(taskSourceText) {
  const text = String(taskSourceText ?? "").trim();
  return text ? `${text}\n` : "";
}

function parseTaskSourceText(taskSourceText) {
  try {
    return {
      parsed: YAML.parse(taskSourceText),
      parseError: null,
    };
  } catch (error) {
    return {
      parsed: null,
      parseError: `YAML parse error: ${error.message}`,
    };
  }
}

function taskSourceFileName(taskId) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(taskId ?? "")) {
    throw new Error("task id must be kebab-case lowercase letters and numbers");
  }
  return `${taskId}.yaml`;
}

export async function listRawTasks(tasksDir) {
  let entries;
  try {
    entries = await readdir(tasksDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => isSupportedTaskFile(fileName))
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    files.map(async (fileName) => {
      const extension = extname(fileName).toLowerCase();
      const rawTask = {
        id: basename(fileName, extension),
        fileName,
        format: SUPPORTED_EXTENSIONS.get(extension),
        rawText: await readFile(join(tasksDir, fileName), "utf8"),
      };
      const parsedTask = parseRawTask(rawTask);
      const validation = validateParsedTask(parsedTask);
      return {
        ...rawTask,
        ...parsedTask,
        validation,
      };
    }),
  );
}

export async function createRawTaskSource({
  tasksDir,
  taskSourceText,
  ensureDirectory = mkdir,
  writeTaskFile = writeFile,
} = {}) {
  const rawText = normalizeTaskSourceText(taskSourceText);
  const parsedTask = parseTaskSourceText(rawText);
  const validation = validateParsedTask(parsedTask);
  if (validation.status !== "valid") {
    const reason = parsedTask.parseError ?? validation.errors.join("; ");
    throw new Error(`task source is invalid: ${reason}`);
  }

  const fileName = taskSourceFileName(parsedTask.parsed.id);
  await ensureDirectory(tasksDir, { recursive: true });
  try {
    await writeTaskFile(join(tasksDir, fileName), rawText, { flag: "wx" });
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(`task source already exists: ${fileName}`);
    }
    throw error;
  }

  return {
    id: parsedTask.parsed.id,
    fileName,
    format: "yaml",
    rawText,
    ...parsedTask,
    validation,
  };
}
