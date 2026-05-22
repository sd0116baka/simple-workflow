export function updateActionFeedback(
  actionTarget,
  { text, disabled, hidden, pending } = {},
) {
  if (!actionTarget) return;
  if (actionTarget.dataset) {
    if (pending === true) actionTarget.dataset.pending = "true";
    if (pending === false) delete actionTarget.dataset.pending;
  }
  if (typeof disabled === "boolean") actionTarget.disabled = disabled;
  if (typeof hidden === "boolean") actionTarget.hidden = hidden;
  if (typeof text === "string") actionTarget.textContent = text;
}

export function beginActionFeedback(actionButton, { text, pending = false } = {}) {
  updateActionFeedback(actionButton, { text, disabled: true, pending });
}

export function resetActionFeedback(actionButton, { text, disabled = false } = {}) {
  updateActionFeedback(actionButton, { text, disabled, pending: false });
}

export function isActionFeedbackPending(actionButton) {
  return actionButton?.dataset?.pending === "true";
}

export function findActionFeedbackTarget(
  actionButton,
  { panelSelector, feedbackSelector } = {},
) {
  if (!actionButton || !panelSelector || !feedbackSelector) return null;
  return actionButton.closest(panelSelector)?.querySelector(feedbackSelector) ?? null;
}

export function setFeedbackText(feedbackTarget, text) {
  updateActionFeedback(feedbackTarget, { text });
}

export function scheduleActionFeedbackReset(
  actionButton,
  { text, delayMs, setTimeoutFn = setTimeout } = {},
) {
  setTimeoutFn(() => {
    resetActionFeedback(actionButton, { text });
  }, delayMs);
}
