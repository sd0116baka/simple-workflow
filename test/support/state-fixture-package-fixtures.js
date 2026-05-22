import { STAGE_FIXTURES } from "../../src/workflow/state-fixture-catalog.js";
import { buildFixtureTaskContextPackage } from "../../src/workflow/state-fixture-packages.js";

export function findStageFixture(fixtureKey) {
  return STAGE_FIXTURES.find((item) => item.fixtureKey === fixtureKey);
}

export function buildStateFixturePackage({
  fixtureKey,
  baseCommit,
  timestamp = "2026-05-21T00:00:00.000Z",
}) {
  const fixture = findStageFixture(fixtureKey);
  return buildFixtureTaskContextPackage({
    fixture: {
      ...fixture,
      baseCommit,
    },
    timestamp,
    baseCommit,
  });
}
