import { test } from "node:test";
import assert from "node:assert/strict";
import { createRecommendationRunControllerRegistry } from "../src/workflow/recommendation-run-controller-registry.js";

function createControllerProbe(signal) {
  return {
    aborted: false,
    signal,
    abort() {
      this.aborted = true;
    },
  };
}

test("recommendation run controller registry creates and returns signals by run id", () => {
  const signal = { aborted: false };
  const registry = createRecommendationRunControllerRegistry({
    createController: () => createControllerProbe(signal),
  });

  const controller = registry.create("recommendation-run-1");

  assert.equal(controller.signal, signal);
  assert.equal(registry.signalFor("recommendation-run-1"), signal);
  assert.equal(registry.signalFor("missing-run"), undefined);
});

test("recommendation run controller registry aborts and deletes controllers by run id", () => {
  const controller = createControllerProbe({ aborted: false });
  const registry = createRecommendationRunControllerRegistry({
    createController: () => controller,
  });
  registry.create("recommendation-run-1");

  assert.equal(registry.abort("missing-run"), false);
  assert.equal(registry.abort("recommendation-run-1"), true);
  assert.equal(controller.aborted, true);
  assert.equal(registry.delete("recommendation-run-1"), true);
  assert.equal(registry.signalFor("recommendation-run-1"), undefined);
  assert.equal(registry.delete("recommendation-run-1"), false);
});
