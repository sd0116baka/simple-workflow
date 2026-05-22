export class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.eventListeners = new Map();
    this.className = "";
    this.type = "";
    this.hidden = false;
    this.disabled = false;
    this.scrollTop = 0;
    this.scrollHeight = 42;
    this.value = "";
    this.rows = 0;
    this.placeholder = "";
    this._textContent = "";
  }

  append(...children) {
    this.children.push(...children.filter(Boolean));
  }

  replaceChildren(...children) {
    this.children = [];
    this._textContent = "";
    this.append(...children);
  }

  addEventListener(eventName, listener) {
    const listeners = this.eventListeners.get(eventName) ?? [];
    listeners.push(listener);
    this.eventListeners.set(eventName, listeners);
  }

  click() {
    for (const listener of this.eventListeners.get("click") ?? []) {
      listener({ target: this });
    }
  }

  set textContent(value) {
    this._textContent = String(value);
  }

  get textContent() {
    return [
      this._textContent,
      ...this.children.map((child) => child.textContent ?? ""),
    ].join("");
  }
}

export function createFakeDocument() {
  return {
    createElement(tagName) {
      return new FakeElement(tagName);
    },
  };
}

export function findAll(element, predicate, matches = []) {
  if (predicate(element)) matches.push(element);
  for (const child of element.children ?? []) {
    findAll(child, predicate, matches);
  }
  return matches;
}

export function markerElement(textContent, { className = "", tagName = "section" } = {}) {
  const element = new FakeElement(tagName);
  element.className = className;
  element.textContent = textContent;
  return element;
}

export function fakeElements(names, tagName = "div") {
  return Object.fromEntries(names.map((name) => [name, new FakeElement(tagName)]));
}
