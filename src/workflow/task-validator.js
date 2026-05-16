const REQUIRED_STRING_FIELDS = ["id", "title", "type", "description"];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateParsedTask({ parsed, parseError }) {
  if (parseError) {
    return {
      status: "invalid",
      errors: ["Cannot validate until YAML parses successfully"],
    };
  }

  const errors = [];

  for (const field of REQUIRED_STRING_FIELDS) {
    if (!isNonEmptyString(parsed?.[field])) {
      errors.push(`${field} must be a non-empty string`);
    }
  }

  if (!Array.isArray(parsed?.acceptance)) {
    errors.push("acceptance must be a list");
  } else if (parsed.acceptance.length === 0) {
    errors.push("acceptance must contain at least one item");
  } else {
    parsed.acceptance.forEach((item, index) => {
      if (!isNonEmptyString(item)) {
        errors.push(`acceptance[${index}] must be a non-empty string`);
      }
    });
  }

  return {
    status: errors.length === 0 ? "valid" : "invalid",
    errors,
  };
}
