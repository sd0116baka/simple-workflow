function emitResponse(response) {
  return {
    shouldEmit: true,
    response,
  };
}

export function acceptanceFailureResult(error) {
  return emitResponse({
    accepted: false,
    error,
  });
}

export function planningFailureResult(error) {
  return emitResponse({
    accepted: true,
    planned: false,
    closed: false,
    error,
  });
}

export function planningIncompleteResult() {
  return emitResponse({
    accepted: true,
    planned: false,
    executed: false,
    closed: false,
    error: null,
  });
}

export function executionFailureResult(error) {
  return emitResponse({
    accepted: true,
    planned: true,
    executed: false,
    error,
  });
}

export function executionIncompleteResult() {
  return emitResponse({
    accepted: true,
    planned: true,
    executed: false,
    closed: false,
    error: null,
  });
}

export function closeoutFailureResult(error) {
  return emitResponse({
    accepted: true,
    planned: true,
    executed: true,
    closed: false,
    error,
  });
}

export function acceptedAutoMergeResult({
  planningOutcome,
  executionOutcome,
  closeoutOutcome,
}) {
  return emitResponse({
    accepted: true,
    planned: planningOutcome.planned,
    executed: executionOutcome.executed,
    closed: closeoutOutcome.closed,
    error: null,
  });
}

export function replanFailureResult(error) {
  return emitResponse({
    planned: false,
    error,
  });
}

export function replanAutoMergeResult({ planningOutcome }) {
  return emitResponse({
    planned: planningOutcome.planned,
    error: null,
  });
}
