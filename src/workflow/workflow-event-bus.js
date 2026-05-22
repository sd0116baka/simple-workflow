import { toRecommendationSnapshot } from "./recommendation-run-snapshot.js";

export function createWorkflowEventBus({
  now = () => new Date().toISOString(),
  toRecommendationRunSnapshot = toRecommendationSnapshot,
} = {}) {
  const listeners = new Set();

  function emit(event) {
    for (const listener of listeners) {
      listener(event);
    }
  }

  return {
    emit,

    emitTaskChange(event) {
      emit({
        type: "tasks-changed",
        ...event,
      });
    },

    emitRecommendationChanged(run) {
      emit({
        type: "recommendation-run-changed",
        run: toRecommendationRunSnapshot(run),
        timestamp: now(),
      });
    },

    emitTerminalSessionChanged(terminalSession) {
      emit({
        type: "terminal-session-changed",
        terminalSession,
        timestamp: now(),
      });
    },

    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    clear() {
      listeners.clear();
    },
  };
}
