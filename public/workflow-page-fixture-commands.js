import {
  cleanupStateFixturesAction,
  seedStateFixturesAction,
} from "./workflow-page-fixture-actions.js";

export function createWorkflowPageFixtureCommands({
  workflowApi,
  getSelectedFileName,
  setSelectedFileName,
  setRecommendationRun,
  refreshPage,
  elements,
  setTimeoutFn = setTimeout,
} = {}) {
  async function seedStateFixtures() {
    return seedStateFixturesAction({
      workflowApi,
      seedStateFixtureSelect: elements.seedStateFixtureSelect,
      seedStateFixturesButton: elements.seedStateFixturesButton,
      getSelectedFileName,
      setSelectedFileName,
      setRecommendationRun,
      refreshPage,
      setTimeoutFn,
    });
  }

  async function cleanupStateFixtures() {
    return cleanupStateFixturesAction({
      workflowApi,
      cleanupStateFixturesButton: elements.cleanupStateFixturesButton,
      getSelectedFileName,
      setSelectedFileName,
      setRecommendationRun,
      refreshPage,
      setTimeoutFn,
    });
  }

  return {
    seedStateFixtures,
    cleanupStateFixtures,
  };
}
