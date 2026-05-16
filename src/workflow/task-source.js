import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { parseRawTask } from "./task-parser.js";
import { validateParsedTask } from "./task-validator.js";

const SUPPORTED_EXTENSIONS = new Map([
  [".yaml", "yaml"],
  [".yml", "yaml"],
]);

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
    .filter((fileName) => SUPPORTED_EXTENSIONS.has(extname(fileName).toLowerCase()))
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
