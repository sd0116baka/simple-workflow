export function packageIdFor(fileName) {
  return `task-context-package:tasks/${fileName}`;
}

export function sourcePathFor(id) {
  return `tasks/${id}.yaml`;
}

export function fixtureWorktreePath(id) {
  return `.workflow/worktrees/tasks/${id}`;
}

export function fixtureBranchName(id) {
  return `workflow/tasks/${id}`;
}

export function needsFixtureWorktree({ currentWorkStage }) {
  return ![
    "task-pool",
    "task-recommender",
    "execution-admission",
    "closed",
    "cancelled",
  ].includes(currentWorkStage);
}

export function isStubPackage(taskContextPackage) {
  return /^tasks\/stub-.*\.ya?ml$/i.test(taskContextPackage?.source?.path ?? "");
}
