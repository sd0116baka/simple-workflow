import { createTaskContextPackageFixture } from "./task-context-package-fixtures.js";

export function packageWith({ stage = "task-pool", artifacts = {} } = {}) {
  return createTaskContextPackageFixture({
    currentWorkStage: stage,
    artifacts,
  });
}

export function artifact(artifactId, body = {}) {
  return { artifactId, body };
}
