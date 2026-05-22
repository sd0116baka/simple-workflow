import { createElement } from "./dom-renderer-helpers.js";
import { buildHumanDecisionPanelViewModel } from "./human-decision-panel-view-model.js";

function bindAction(button, action, showError) {
  button.addEventListener("click", () => {
    action().catch(showError);
  });
}

function createActionButton(documentRef, textContent, className) {
  const button = createElement(documentRef, "button", {
    className,
    textContent,
  });
  button.type = "button";
  return button;
}

export function createHumanDecisionPanel(
  documentRef,
  taskContextPackage,
  {
    onAcceptConvergence,
    onContinueConvergenceWithGuidance,
    onCancelTask,
    showError = (error) => {
      throw error;
    },
  } = {},
) {
  const viewModel = buildHumanDecisionPanelViewModel(taskContextPackage);
  if (!viewModel) return null;

  const notice = createElement(documentRef, "div", { className: "human-decision-notice" });
  notice.append(
    createElement(documentRef, "div", {
      className: "human-decision-title",
      textContent: viewModel.title,
    }),
    createElement(documentRef, "div", {
      className: "human-decision-reason",
      textContent: viewModel.reason,
    }),
    createElement(documentRef, "div", {
      className: "human-decision-meta",
      textContent: viewModel.meta,
    }),
  );

  if (viewModel.badges.length > 0) {
    const options = createElement(documentRef, "div", { className: "human-decision-options" });
    for (const badgeText of viewModel.badges) {
      options.append(createElement(documentRef, "span", { textContent: badgeText }));
    }
    notice.append(options);
  }

  if (viewModel.guidanceForm) {
    const guidanceInput = createElement(documentRef, "textarea", {
      className: "human-guidance-input",
    });
    guidanceInput.rows = 5;
    guidanceInput.placeholder = "输入人工收敛意见...";
    guidanceInput.dataset.field = "guidance";

    const expectedInput = createElement(documentRef, "textarea", {
      className: "human-guidance-input",
    });
    expectedInput.rows = 3;
    expectedInput.placeholder = "下一轮期望看到的变化...";
    expectedInput.dataset.field = "expectedNextOutcome";

    const actions = createElement(documentRef, "div", { className: "human-decision-actions" });
    const continueButton = createActionButton(
      documentRef,
      "带意见继续收敛",
      "primary-button human-decision-action",
    );
    bindAction(continueButton, () => onContinueConvergenceWithGuidance({
      guidance: guidanceInput.value,
      expectedNextOutcome: expectedInput.value,
      actionButton: continueButton,
    }), showError);

    const acceptButton = createActionButton(
      documentRef,
      "接受收敛成功",
      "primary-button human-decision-action",
    );
    bindAction(acceptButton, () => onAcceptConvergence(acceptButton), showError);

    const cancelButton = createActionButton(
      documentRef,
      "取消任务",
      "secondary-button danger-button human-decision-action",
    );
    bindAction(cancelButton, () => onCancelTask(cancelButton), showError);

    const actionButtons = {
      "accept-convergence": acceptButton,
      "continue-convergence-with-guidance": continueButton,
      "cancel-task": cancelButton,
    };
    actions.append(...viewModel.actions.map((action) => actionButtons[action]));
    notice.append(guidanceInput, expectedInput, actions);
  } else if (viewModel.actions.includes("accept-convergence")) {
    const acceptButton = createActionButton(
      documentRef,
      "接受收敛成功",
      "primary-button human-decision-action",
    );
    bindAction(acceptButton, () => onAcceptConvergence(acceptButton), showError);
    notice.append(acceptButton);
  }

  return notice;
}
