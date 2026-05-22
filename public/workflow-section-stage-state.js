export function isClosedStage(taskContextPackage) {
  return taskContextPackage?.currentWorkStage === "closed";
}

export function isCancelledStage(taskContextPackage) {
  return taskContextPackage?.currentWorkStage === "cancelled";
}
