const CONFIDENCE_LEVELS = new Set(["high", "medium", "low"]);

function extractJsonText(output) {
  const text = String(output ?? "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fenced ? fenced[1].trim() : text;
}

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value;
}

function requireString(value, name) {
  if (typeof value !== "string") {
    throw new Error(`${name} must be a string`);
  }
  return value;
}

function requireStringArray(value, name) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${name} must be a string array`);
  }
  return value;
}

function normalizeTask(value, name) {
  const task = requireObject(value, name);
  return {
    id: requireString(task.id, `${name}.id`),
    sourceFile: requireString(task.sourceFile, `${name}.sourceFile`),
    title: requireString(task.title, `${name}.title`),
    priority: requireString(task.priority, `${name}.priority`),
    status: typeof task.status === "string" ? task.status : null,
  };
}

export function parseRecommendationIntent(output) {
  try {
    const payload = requireObject(JSON.parse(extractJsonText(output)), "recommendation intent");
    if (payload.schemaVersion !== 1) {
      throw new Error("schemaVersion must be 1");
    }
    if (!CONFIDENCE_LEVELS.has(payload.confidence)) {
      throw new Error("confidence must be high, medium, or low");
    }

    const repoStatus = requireObject(payload.repoStatus, "repoStatus");
    if (typeof repoStatus.clean !== "boolean") {
      throw new Error("repoStatus.clean must be a boolean");
    }

    return {
      intent: {
        schemaVersion: 1,
        recommendedTask: normalizeTask(payload.recommendedTask, "recommendedTask"),
        confidence: payload.confidence,
        rationale: requireStringArray(payload.rationale, "rationale"),
        repoStatus: {
          clean: repoStatus.clean,
          changedFiles: requireStringArray(repoStatus.changedFiles, "repoStatus.changedFiles"),
        },
        observedTasks: Array.isArray(payload.observedTasks)
          ? payload.observedTasks.map((task, index) => normalizeTask(task, `observedTasks.${index}`))
          : [],
        nextAction: requireString(payload.nextAction, "nextAction"),
      },
      error: null,
    };
  } catch (error) {
    return {
      intent: null,
      error: error.message,
    };
  }
}
