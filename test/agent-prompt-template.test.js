import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  projectProfilePromptPath,
  readAgentPromptTemplate,
  renderAgentPromptTemplate,
} from "../src/workflow/agent-prompt-template.js";

test("agent prompt templates are read from project profile markdown files", async () => {
  const promptPath = projectProfilePromptPath("execution-agent.prompt.md");
  const template = readAgentPromptTemplate(promptPath);
  const fileText = await readFile(join(process.cwd(), "project_profiles", "execution-agent.prompt.md"), "utf8");

  assert.equal(template, fileText);
  assert.match(template, /{{INPUT_JSON}}/);
});

test("agent prompt template renderer injects runtime JSON payload", () => {
  const prompt = renderAgentPromptTemplate("before\n{{INPUT_JSON}}\nafter", "{\"ok\":true}");

  assert.equal(prompt, "before\n{\"ok\":true}\nafter");
});
