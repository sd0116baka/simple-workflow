import {
  beginActionFeedback,
  resetActionFeedback,
} from "./workflow-action-feedback.js";

function renderMessages({ messagesElement, messages }) {
  if (!messagesElement) return;
  if (messages.length === 0) {
    messagesElement.textContent = "还没有讨论记录。";
    return;
  }
  messagesElement.replaceChildren?.();
  const documentRef = messagesElement.ownerDocument ?? globalThis.document;
  if (!documentRef) {
    messagesElement.textContent = messages.map((message) => message.content).join("\n");
    return;
  }
  for (const message of messages) {
    const item = documentRef.createElement("div");
    item.className = `task-draft-message ${message.role}`;
    const role = message.role === "user" ? "你" : "AI";
    item.textContent = `${role}：${message.content}`;
    messagesElement.append(item);
  }
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function renderValidation({ validationElement, validation }) {
  if (!validationElement) return;
  if (!validation || validation.status === "empty") {
    validationElement.textContent = "等待生成";
    return;
  }
  validationElement.textContent = validation.status === "valid"
    ? "YAML 校验通过"
    : `YAML 校验失败：${validation.parseError ?? validation.errors?.join("；") ?? "未知错误"}`;
}

export function createWorkflowPageTaskDraftAssistantCommands({
  workflowApi,
  elements = {},
  refreshPage = async () => {},
  renderTaskDraftOutput = null,
} = {}) {
  const messages = [];
  let latestValidTaskSourceText = "";

  function setCreateButtonEnabled(enabled) {
    if (elements.taskDraftCreateButton) {
      elements.taskDraftCreateButton.disabled = !enabled;
    }
  }

  async function sendTaskDraftMessage({ mode = "discuss" } = {}) {
    const input = elements.taskDraftInput;
    const userMessage = String(input?.value ?? "").trim();
    if (!userMessage && messages.length === 0) return { ok: false, skipped: true };

    const button = mode === "finalize"
      ? elements.taskDraftFinalizeButton
      : elements.taskDraftDiscussButton;
    const buttonText = button?.textContent;
    beginActionFeedback(button, { text: mode === "finalize" ? "生成中" : "讨论中" });
    if (elements.taskDraftStatus) {
      elements.taskDraftStatus.textContent = mode === "finalize" ? "生成中" : "讨论中";
    }
    if (userMessage) {
      messages.push({ role: "user", content: userMessage });
      if (input) input.value = "";
      renderMessages({ messagesElement: elements.taskDraftMessages, messages });
    }

    try {
      const payload = await workflowApi.discussTaskSourceDraft({
        mode,
        messages,
      });
      const taskDraft = payload.taskDraft;
      messages.push({ role: "assistant", content: taskDraft.assistantMessage });
      renderMessages({ messagesElement: elements.taskDraftMessages, messages });
      if (elements.taskDraftStatus) {
        elements.taskDraftStatus.textContent = taskDraft.error
          ? "失败"
          : mode === "finalize" && !taskDraft.taskSourceText
            ? "未生成"
            : mode === "finalize" ? "已生成" : "等待继续";
      }
      if (taskDraft.taskSourceText && elements.taskDraftOutput && renderTaskDraftOutput) {
        renderTaskDraftOutput({
          outputElement: elements.taskDraftOutput,
          taskDraft,
        });
      } else if (taskDraft.taskSourceText && elements.taskDraftOutput) {
        elements.taskDraftOutput.textContent = taskDraft.taskSourceText;
      }
      renderValidation({
        validationElement: elements.taskDraftValidation,
        validation: taskDraft.validation,
      });
      if (taskDraft.error && elements.taskDraftValidation) {
        elements.taskDraftValidation.textContent = `生成失败：${taskDraft.error?.data?.message ?? taskDraft.error?.message ?? "未知错误"}`;
      } else if (mode === "finalize" && !taskDraft.taskSourceText && elements.taskDraftValidation) {
        elements.taskDraftValidation.textContent = "未生成任务文本";
      }
      latestValidTaskSourceText = taskDraft.validation?.status === "valid"
        ? taskDraft.taskSourceText
        : "";
      setCreateButtonEnabled(Boolean(latestValidTaskSourceText));
      return { ok: true, taskDraft };
    } catch (error) {
      if (elements.taskDraftStatus) {
        elements.taskDraftStatus.textContent = "失败";
      }
      throw error;
    } finally {
      resetActionFeedback(button, { text: buttonText });
    }
  }

  async function createTaskSourceFromDraft() {
    if (!latestValidTaskSourceText) return { ok: false, skipped: true };
    const button = elements.taskDraftCreateButton;
    const buttonText = button?.textContent;
    beginActionFeedback(button, { text: "写入中" });
    if (elements.taskDraftStatus) {
      elements.taskDraftStatus.textContent = "写入中";
    }

    try {
      const payload = await workflowApi.createTaskSourceFromDraft({
        taskSourceText: latestValidTaskSourceText,
      });
      if (elements.taskDraftStatus) {
        elements.taskDraftStatus.textContent = `已加入 ${payload.taskSource.fileName}`;
      }
      latestValidTaskSourceText = "";
      setCreateButtonEnabled(false);
      await refreshPage();
      return { ok: true, taskSource: payload.taskSource };
    } catch (error) {
      if (elements.taskDraftStatus) {
        elements.taskDraftStatus.textContent = "写入失败";
      }
      throw error;
    } finally {
      resetActionFeedback(button, { text: buttonText, disabled: !latestValidTaskSourceText });
    }
  }

  return {
    sendTaskDraftMessage,
    finalizeTaskDraft: () => sendTaskDraftMessage({ mode: "finalize" }),
    createTaskSourceFromDraft,
  };
}
