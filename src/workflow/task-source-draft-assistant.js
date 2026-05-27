import { readFile } from "node:fs/promises";
import YAML from "yaml";
import { extractTextFromJsonEvents } from "./opencode-json-events.js";
import { runAgentProcess } from "./agent-process-runner.js";
import { validateParsedTask } from "./task-validator.js";

const TASK_DRAFT_ARGS = ["run", "--format", "json"];
const VALID_MODES = new Set(["discuss", "finalize"]);

function normalizeMode(mode) {
  return VALID_MODES.has(mode) ? mode : "discuss";
}

function normalizeMessages(messages = []) {
  return Array.isArray(messages)
    ? messages
        .filter((message) => ["user", "assistant"].includes(message?.role))
        .map((message) => ({
          role: message.role,
          content: String(message.content ?? "").trim(),
        }))
        .filter((message) => message.content.length > 0)
    : [];
}

function extractFencedJson(text) {
  const match = String(text ?? "").match(/```json\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : String(text ?? "").trim();
}

function parseAssistantOutput(text) {
  try {
    const parsed = JSON.parse(extractFencedJson(text));
    if (parsed?.type === "error") {
      return {
        message: `任务起草助手运行失败：${parsed.error?.data?.message ?? parsed.error?.message ?? "未知错误"}`,
        taskSourceText: null,
        error: parsed.error ?? parsed,
      };
    }
    return {
      message: typeof parsed.message === "string" ? parsed.message.trim() : "",
      taskSourceText: typeof parsed.taskSourceText === "string" ? parsed.taskSourceText.trim() : null,
      error: null,
    };
  } catch {
    return {
      message: String(text ?? "").trim(),
      taskSourceText: null,
      error: null,
    };
  }
}

export function validateTaskSourceDraft(taskSourceText) {
  if (!taskSourceText) {
    return {
      status: "empty",
      errors: [],
      parsed: null,
      parseError: null,
    };
  }

  try {
    const parsed = YAML.parse(taskSourceText);
    const validation = validateParsedTask({ parsed, parseError: null });
    return {
      ...validation,
      parsed,
      parseError: null,
    };
  } catch (error) {
    return {
      status: "invalid",
      errors: ["Cannot validate until YAML parses successfully"],
      parsed: null,
      parseError: `YAML parse error: ${error.message}`,
    };
  }
}

export function buildTaskSourceDraftPrompt({
  basePrompt,
  mode = "discuss",
  messages = [],
  existingTasks = [],
} = {}) {
  return [
    basePrompt,
    "",
    "当前请求：",
    "",
    "```json",
    JSON.stringify({
      mode: normalizeMode(mode),
      messages: normalizeMessages(messages),
      existingTasks: existingTasks.map((task) => ({
        id: task.parsed?.id ?? task.id,
        title: task.parsed?.title ?? "",
        type: task.parsed?.type ?? "",
        fileName: task.fileName,
        validationStatus: task.validation?.status ?? null,
      })),
    }, null, 2),
    "```",
    "",
  ].join("\n");
}

export async function runOpencodeTaskSourceDraftAssistant({
  prompt,
  repositoryDir = process.cwd(),
  command = "opencode",
  args = TASK_DRAFT_ARGS,
  env = process.env,
  shell = false,
  runProcess = runAgentProcess,
} = {}) {
  const result = await runProcess({
    command,
    args,
    cwd: repositoryDir,
    env,
    shell,
    prompt,
  });
  return {
    ...result,
    stdout: extractTextFromJsonEvents(result.stdout),
  };
}

export function createTaskSourceDraftAssistant({
  repositoryDir = process.cwd(),
  promptPath,
  listTasks,
  readPrompt = (path) => readFile(path, "utf8"),
  runAssistant = runOpencodeTaskSourceDraftAssistant,
} = {}) {
  async function discussTaskSourceDraft({ mode = "discuss", messages = [] } = {}) {
    const normalizedMode = normalizeMode(mode);
    const normalizedMessages = normalizeMessages(messages);
    const basePrompt = await readPrompt(promptPath);
    const existingTasks = await listTasks();
    const prompt = buildTaskSourceDraftPrompt({
      basePrompt,
      mode: normalizedMode,
      messages: normalizedMessages,
      existingTasks,
    });
    const result = await runAssistant({
      prompt,
      repositoryDir,
    });
    const output = parseAssistantOutput(result.stdout);
    const taskSourceText = normalizedMode === "finalize" ? output.taskSourceText : null;

    return {
      mode: normalizedMode,
      assistantMessage: output.message || "我已经读完上下文，可以继续讨论。",
      taskSourceText,
      validation: validateTaskSourceDraft(taskSourceText),
      error: output.error,
      rawOutput: {
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        exitCode: result.exitCode ?? null,
        error: result.error ?? null,
      },
    };
  }

  return {
    discussTaskSourceDraft,
  };
}
