import { test } from "node:test";
import assert from "node:assert/strict";
import { cloneJsonValue } from "../src/workflow/json-value.js";

test("clones JSON values without sharing nested references", () => {
  const value = {
    nested: {
      items: ["one"],
    },
  };

  const cloned = cloneJsonValue(value);
  cloned.nested.items.push("two");

  assert.deepEqual(value, { nested: { items: ["one"] } });
  assert.deepEqual(cloned, { nested: { items: ["one", "two"] } });
});
