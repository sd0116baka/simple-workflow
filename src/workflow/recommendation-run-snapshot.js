import { cloneJsonValue } from "./json-value.js";
import {
  createEmptyRecommendationRunFields,
  RECOMMENDATION_RUN_FIELD_CLONE_GROUPS,
} from "./recommendation-run-field-defaults.js";

function cloneJsonOrNull(value) {
  return value ? cloneJsonValue(value) : null;
}

function cloneJsonFieldOrDefault(run, defaults, fieldName) {
  return run[fieldName] ? cloneJsonValue(run[fieldName]) : defaults[fieldName];
}

function cloneStringArrayFieldOrDefault(run, defaults, fieldName) {
  return run[fieldName] ? [...run[fieldName]] : defaults[fieldName];
}

export function toRecommendationSnapshot(run) {
  if (!run) {
    return null;
  }

  const defaults = createEmptyRecommendationRunFields();
  const snapshot = {
    ...defaults,
    ...run,
    args: run.args ? [...run.args] : [],
    stageSwitches: run.stageSwitches ? cloneJsonValue(run.stageSwitches) : defaults.stageSwitches,
    startupCheck: cloneJsonOrNull(run.startupCheck),
    progress: run.progress ? run.progress.map((entry) => ({ ...entry })) : defaults.progress,
  };

  for (const fieldName of RECOMMENDATION_RUN_FIELD_CLONE_GROUPS.jsonOrNull) {
    snapshot[fieldName] = cloneJsonFieldOrDefault(run, defaults, fieldName);
  }
  for (const fieldName of RECOMMENDATION_RUN_FIELD_CLONE_GROUPS.jsonArray) {
    snapshot[fieldName] = cloneJsonFieldOrDefault(run, defaults, fieldName);
  }
  for (const fieldName of RECOMMENDATION_RUN_FIELD_CLONE_GROUPS.stringArray) {
    snapshot[fieldName] = cloneStringArrayFieldOrDefault(run, defaults, fieldName);
  }
  for (const fieldName of Object.keys(RECOMMENDATION_RUN_FIELD_CLONE_GROUPS.scalarDefaults)) {
    snapshot[fieldName] = run[fieldName] ?? defaults[fieldName];
  }

  return snapshot;
}
