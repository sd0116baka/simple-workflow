import {
  packageIdFor,
  sourcePathFor,
} from "./state-fixture-paths.js";
import { buildFixtureArtifactTrace } from "./state-fixture-artifact-trace.js";

function basePackage({ id, title, currentWorkStage, timestamp, baseCommit }) {
  const sourcePath = sourcePathFor(id);
  return {
    packageId: packageIdFor(`${id}.yaml`),
    currentWorkStage,
    source: {
      path: sourcePath,
      format: "yaml",
      contentHash: "fixture",
    },
    recognition: {
      outcome: "recognized",
      findings: [],
    },
    taskDraft: {
      id,
      name: title,
      kind: "fixture",
      priority: "low",
      goal: `用于测试 ${currentWorkStage} 环节展示。`,
      acceptanceCriteria: [`页面可以展示 ${currentWorkStage} 状态`],
      maxIterations: 2,
    },
    qualityGate: {
      outcome: "pass",
    },
    artifacts: {},
    agentRuns: [],
    timeline: [],
    fixture: {
      generatedBy: "test-state-seed",
      generatedAt: timestamp,
      baseCommit,
    },
  };
}

export function buildFixtureTaskContextPackage({
  fixture,
  timestamp,
  baseCommit,
}) {
  const taskPackage = basePackage({
    ...fixture,
    timestamp,
    baseCommit,
  });
  buildFixtureArtifactTrace(taskPackage, {
    ...fixture,
    timestamp,
  });
  return taskPackage;
}
