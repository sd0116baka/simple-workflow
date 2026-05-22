import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STAGE_FIXTURES,
  yamlForFixture,
} from "../src/workflow/state-fixture-catalog.js";

test("state fixture catalog exposes fixture metadata and scenarios", () => {
  const failure = STAGE_FIXTURES.find((item) => item.fixtureKey === "convergence-failure");
  const guided = STAGE_FIXTURES.find((item) => item.fixtureKey === "human-guided-execution");

  assert.equal(failure.currentWorkStage, "human-decision");
  assert.equal(failure.humanDecisionScenario, "convergence-failure");
  assert.equal(guided.currentWorkStage, "execution-agent");
  assert.equal(guided.humanDecisionScenario, "human-guided-execution");
});

test("state fixture catalog builds fixture task yaml", () => {
  const fixture = STAGE_FIXTURES.find((item) => item.fixtureKey === "convergence-failure");
  const yaml = yamlForFixture(fixture);

  assert.match(yaml, /id: stub-convergence-failure/);
  assert.match(yaml, /type: fixture/);
  assert.match(yaml, /页面可以展示 human-decision 状态/);
});
