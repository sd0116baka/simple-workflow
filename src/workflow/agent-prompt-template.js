import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));

export function projectProfilePromptPath(fileName) {
  return join(rootDir, "project_profiles", fileName);
}

export function readAgentPromptTemplate(promptPath) {
  return readFileSync(promptPath, "utf8");
}

export function renderAgentPromptTemplate(template, inputJson) {
  return template.replace("{{INPUT_JSON}}", inputJson);
}
