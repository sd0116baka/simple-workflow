export function createElement(documentRef, tagName, { className = "", textContent = "" } = {}) {
  const element = documentRef.createElement(tagName);
  if (className) element.className = className;
  if (textContent) element.textContent = textContent;
  return element;
}

export function appendTextItems(documentRef, container, tagName, className, items = []) {
  if (items.length === 0) return null;
  const list = createElement(documentRef, tagName, { className });
  for (const itemText of items) {
    list.append(createElement(documentRef, "li", { textContent: itemText }));
  }
  container.append(list);
  return list;
}

export function renderInputs(documentRef, container, inputs = []) {
  container.replaceChildren();
  const list = createElement(documentRef, "ul", { className: "stage-input-list" });
  for (const input of inputs) {
    const item = createElement(documentRef, "li");
    item.append(
      createElement(documentRef, "strong", { textContent: input.label }),
      createElement(documentRef, "span", { textContent: input.value }),
    );
    list.append(item);
  }
  container.append(list);
  return list;
}

export function appendEmptyState(documentRef, container, emptyText) {
  const empty = createElement(documentRef, "p", {
    className: "empty-state",
    textContent: emptyText,
  });
  container.append(empty);
  return empty;
}
