export function createRecommendationRunControllerRegistry({
  createController = () => new AbortController(),
} = {}) {
  const controllers = new Map();

  function create(runId) {
    const controller = createController();
    controllers.set(runId, controller);
    return controller;
  }

  function signalFor(runId) {
    return controllers.get(runId)?.signal;
  }

  function abort(runId) {
    const controller = controllers.get(runId);
    controller?.abort();
    return Boolean(controller);
  }

  return {
    abort,
    create,
    delete(runId) {
      return controllers.delete(runId);
    },
    signalFor,
  };
}
